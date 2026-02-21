import { useRef, useEffect, useState } from 'react';
import * as d3 from 'd3';

interface MerkleNode {
    id: string;
    hash: string;
    type: 'root' | 'internal' | 'leaf';
    attested: boolean;
    label?: string;
    children?: MerkleNode[];
}

interface VaultEvent {
    id: number;
    type: 'store' | 'retrieve' | 'session_commit';
    timestamp: number;
    source: 'api' | 'mcp';
    data: Record<string, any>;
}

const shortHash = (h: string) => h ? h.slice(0, 8) + '...' + h.slice(-4) : '-';

function buildTreeFromEvents(events: VaultEvent[]): MerkleNode {
    const storeEvents = events.filter(e => e.type === 'store');
    const commitEvent = events.find(e => e.type === 'session_commit');
    const isCommitted = !!commitEvent;

    const leaves: MerkleNode[] = storeEvents.map((e, i) => ({
        id: `leaf-${i}`,
        hash: e.data?.rootHash || e.data?.contentHash || `0x${i.toString(16).padStart(8, '0')}`,
        type: 'leaf' as const,
        attested: isCommitted,
        label: e.data?.label || `store_${i}`,
    }));

    if (leaves.length === 0) {
        return {
            id: 'root',
            hash: '0x0000...0000',
            type: 'root',
            attested: false,
            children: [],
        };
    }

    let currentLevel: MerkleNode[] = [...leaves];
    let internalCount = 0;

    while (currentLevel.length > 1) {
        const nextLevel: MerkleNode[] = [];
        for (let i = 0; i < currentLevel.length; i += 2) {
            const left = currentLevel[i];
            const right = currentLevel[i + 1];

            if (right) {
                const combinedHash = `0x${(parseInt(left.hash.slice(2, 10), 16) ^ parseInt(right.hash.slice(2, 10), 16)).toString(16).padStart(8, '0')}`;
                nextLevel.push({
                    id: `internal-${internalCount++}`,
                    hash: combinedHash,
                    type: 'internal',
                    attested: isCommitted,
                    children: [left, right],
                });
            } else {
                nextLevel.push(left);
            }
        }
        currentLevel = nextLevel;
    }

    const root = currentLevel[0];
    return {
        id: 'root',
        hash: commitEvent?.data?.merkleRoot || root.hash,
        type: 'root',
        attested: isCommitted,
        children: root.children || [root],
    };
}

export function MerkleTree({ events }: { events: VaultEvent[] }) {
    const svgRef = useRef<SVGSVGElement>(null);
    const [dimensions, setDimensions] = useState({ width: 800, height: 500 });

    useEffect(() => {
        const observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                setDimensions({ width, height: Math.max(400, height) });
            }
        });
        if (svgRef.current?.parentElement) {
            observer.observe(svgRef.current.parentElement);
        }
        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const { width, height } = dimensions;
        const margin = { top: 50, right: 40, bottom: 40, left: 40 };
        const innerW = width - margin.left - margin.right;
        const innerH = height - margin.top - margin.bottom;

        const g = svg
            .attr('width', width)
            .attr('height', height)
            .append('g')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

        const treeData = buildTreeFromEvents(events);
        const root = d3.hierarchy(treeData);

        const treeLayout = d3.tree<MerkleNode>()
            .size([innerW, innerH])
            .separation((a, b) => a.parent === b.parent ? 1.5 : 2);

        treeLayout(root);

        const links = g.selectAll('.link')
            .data(root.links())
            .enter()
            .append('path')
            .attr('class', 'link')
            .attr('d', d => {
                const sx = d.source.x!;
                const sy = d.source.y!;
                const tx = d.target.x!;
                const ty = d.target.y!;
                return `M${sx},${sy} C${sx},${(sy + ty) / 2} ${tx},${(sy + ty) / 2} ${tx},${ty}`;
            })
            .attr('fill', 'none')
            .attr('stroke', d => {
                const node = d.target.data;
                return node.attested ? '#0066FF' : 'rgba(107, 114, 128, 0.4)';
            })
            .attr('stroke-width', 1.5)
            .each(function () {
                const path = this as SVGPathElement;
                const length = path.getTotalLength();
                d3.select(path)
                    .attr('stroke-dasharray', length)
                    .attr('stroke-dashoffset', length);
            });

        links.transition()
            .duration(800)
            .delay((_, i) => i * 120)
            .ease(d3.easeCubicOut)
            .attr('stroke-dashoffset', 0);

        const nodeGroups = g.selectAll('.node')
            .data(root.descendants())
            .enter()
            .append('g')
            .attr('class', 'node')
            .attr('transform', d => `translate(${d.x},${d.y})`);

        nodeGroups.append('circle')
            .attr('r', d => {
                if (d.data.type === 'root') return 14;
                if (d.data.type === 'internal') return 8;
                return 6;
            })
            .attr('fill', d => {
                if (d.data.type === 'root') return d.data.attested ? '#0066FF' : '#1a1a1a';
                if (d.data.type === 'internal') return d.data.attested ? 'rgba(0, 102, 255, 0.4)' : '#1a1a1a';
                return d.data.attested ? 'rgba(0, 102, 255, 0.6)' : 'rgba(107, 114, 128, 0.3)';
            })
            .attr('stroke', d => {
                if (d.data.type === 'root') return '#0066FF';
                return d.data.attested ? 'rgba(0, 102, 255, 0.5)' : 'rgba(107, 114, 128, 0.3)';
            })
            .attr('stroke-width', d => d.data.type === 'root' ? 2 : 1)
            .attr('opacity', 0)
            .transition()
            .duration(400)
            .delay((_, i) => 200 + i * 100)
            .attr('opacity', d => d.data.attested ? 1 : 0.5);

        nodeGroups.filter(d => d.data.type === 'root')
            .append('circle')
            .attr('r', 14)
            .attr('fill', 'none')
            .attr('stroke', '#0066FF')
            .attr('stroke-width', 1)
            .attr('opacity', 0.6)
            .append('animate')
            .attr('attributeName', 'r')
            .attr('values', '14;22;14')
            .attr('dur', '2s')
            .attr('repeatCount', 'indefinite')
            .append('animate');

        nodeGroups.filter(d => d.data.type === 'root')
            .append('circle')
            .attr('r', 14)
            .attr('fill', 'none')
            .attr('stroke', '#0066FF')
            .attr('stroke-width', 0.5)
            .attr('opacity', 0.3)
            .append('animate')
            .attr('attributeName', 'r')
            .attr('values', '14;30;14')
            .attr('dur', '3s')
            .attr('repeatCount', 'indefinite');

        nodeGroups.append('text')
            .attr('dy', d => {
                if (d.data.type === 'root') return -22;
                if (d.data.type === 'leaf') return 18;
                return -14;
            })
            .attr('text-anchor', 'middle')
            .attr('fill', d => d.data.attested ? 'rgba(0, 102, 255, 0.8)' : 'rgba(107, 114, 128, 0.6)')
            .attr('font-family', '"JetBrains Mono", monospace')
            .attr('font-size', d => d.data.type === 'root' ? '11px' : '9px')
            .attr('opacity', 0)
            .text(d => shortHash(d.data.hash))
            .transition()
            .duration(300)
            .delay((_, i) => 400 + i * 100)
            .attr('opacity', 1);

        nodeGroups.filter(d => d.data.type === 'leaf')
            .append('text')
            .attr('dy', 30)
            .attr('text-anchor', 'middle')
            .attr('fill', 'rgba(107, 114, 128, 0.5)')
            .attr('font-family', '"JetBrains Mono", monospace')
            .attr('font-size', '8px')
            .attr('text-transform', 'uppercase')
            .attr('letter-spacing', '1px')
            .text(d => d.data.label || 'STORE');

        nodeGroups.filter(d => d.data.type === 'root')
            .append('text')
            .attr('dy', -36)
            .attr('text-anchor', 'middle')
            .attr('fill', '#0066FF')
            .attr('font-family', '"JetBrains Mono", monospace')
            .attr('font-size', '9px')
            .attr('letter-spacing', '3px')
            .text('MERKLE ROOT');

    }, [events, dimensions]);

    const storeCount = events.filter(e => e.type === 'store').length;
    const isCommitted = events.some(e => e.type === 'session_commit');

    return (
        <div className="w-full h-full min-h-[400px] relative">
            {storeCount === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center space-y-2">
                        <div className="w-8 h-8 mx-auto rounded-full border border-border flex items-center justify-center">
                            <div className="w-2 h-2 rounded-full bg-text-muted" />
                        </div>
                        <p className="label-caps">Awaiting first vault_store...</p>
                        <p className="text-xs text-text-muted">Nodes will appear as agents store data</p>
                    </div>
                </div>
            )}

            <div className="absolute top-0 left-0 right-0 flex items-center justify-between px-3 py-2 z-10">
                <div className="flex items-center gap-3">
                    <span className="label-caps">{storeCount} nodes</span>
                    <span className={`inline-flex items-center gap-1.5 label-caps ${isCommitted ? 'text-accent-commit' : 'text-text-muted'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${isCommitted ? 'bg-accent-commit' : 'bg-text-muted'}`} />
                        {isCommitted ? 'ATTESTED' : 'PENDING'}
                    </span>
                </div>
                <span className="label-caps text-primary">MERKLE PROOF</span>
            </div>

            <svg
                ref={svgRef}
                className="w-full h-full"
                style={{ minHeight: '400px' }}
            />
        </div>
    );
}
