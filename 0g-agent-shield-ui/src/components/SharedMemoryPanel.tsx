import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VaultEvent } from '../App';

export function SharedMemoryPanel({ events }: { events: VaultEvent[] }) {
    // Process stream of memory events
    const memoryEvents = useMemo(() => {
        return events
            .filter(e => e.type === 'shared_memory' || e.type === 'memory_write')
            .sort((a, b) => b.timestamp - a.timestamp);
    }, [events]);

    // Compute active channels directly from events to show real-time collaboration
    // In a real app the MCP server would push down the explicit channel list on init,
    // but building state from the event log is a robust way to demo.
    const channels = useMemo(() => {
        const unique = new Set<string>();
        memoryEvents.forEach(e => {
            if (e.data.channel) {
                unique.add(e.data.channel);
            }
        });
        return Array.from(unique);
    }, [memoryEvents]);

    return (
        <div className="max-w-5xl mx-auto space-y-6 flex flex-col h-full">
            <div>
                <h2 className="font-mono text-lg font-semibold tracking-wide flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-accent-warn animate-pulse-slow"></span>
                    Shared Memory Bus
                </h2>
                <p className="text-sm text-text-muted mt-1">
                    Real-time visualization of inter-agent communication and memory locking over 0G named channels.
                </p>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Channels Sidebar */}
                <div className="col-span-4 bg-base-elevated/40 border border-border rounded-lg p-4 flex flex-col gap-3">
                    <div className="label-caps mb-2">Active Channels</div>

                    {channels.length === 0 ? (
                        <div className="text-xs font-mono text-text-muted/60 mt-4 text-center">
                            Awaiting agent writes...
                        </div>
                    ) : (
                        <div className="space-y-2 overflow-y-auto pr-2">
                            {channels.map((channel) => {
                                const count = memoryEvents.filter(e => e.data.channel === channel).length;
                                return (
                                    <div key={channel} className="flex items-center justify-between p-2 rounded-md bg-base border border-border/50 group hover:border-accent-warn/30 transition-colors">
                                        <div className="flex items-center gap-2">
                                            <span className="text-accent-warn font-mono font-bold">#</span>
                                            <span className="font-mono text-sm group-hover:text-primary-soft transition-colors">{channel}</span>
                                        </div>
                                        <span className="text-[10px] font-mono font-bold text-text-muted bg-base-elevated px-1.5 py-0.5 rounded">
                                            {count} WRITES
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Memory Feed */}
                <div className="col-span-8 bg-base border border-border rounded-lg relative overflow-hidden flex flex-col">
                    <div className="sticky top-0 bg-base/90 backdrop-blur border-b border-border p-3 z-10 flex justify-between items-center">
                        <span className="label-caps text-text-muted">Global Event Stream</span>
                        {events.some(e => e.type === 'memory_fork') && (
                            <span className="text-[10px] font-mono text-accent-danger bg-accent-danger/10 px-2 py-0.5 rounded border border-accent-danger/20 flex items-center gap-1">
                                <span className="w-1.5 h-1.5 bg-accent-danger rounded-full"></span>
                                FORK DETECTED
                            </span>
                        )}
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        <AnimatePresence initial={false}>
                            {memoryEvents.map((event) => (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, y: -10, scale: 0.98 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    className={`
                                        p-3 rounded-lg border flex flex-col gap-2 relative overflow-hidden group
                                        ${event.type === 'memory_fork' ? 'bg-accent-danger/5 border-accent-danger/20' :
                                            'bg-base-elevated/30 border-border/50 hover:border-accent-warn/40 transition-colors'}
                                    `}
                                >
                                    {event.type === 'memory_write' && (
                                        <div className="absolute top-0 right-0 w-8 h-full bg-gradient-to-l from-accent-warn/10 to-transparent pointer-events-none" />
                                    )}

                                    <div className="flex justify-between items-start">
                                        <div className="flex items-baseline gap-2">
                                            {event.data.channel && (
                                                <span className="text-xs font-mono font-bold text-accent-warn">
                                                    #{event.data.channel}
                                                </span>
                                            )}
                                            <span className="text-[11px] font-mono text-text-muted bg-base px-1.5 py-0.5 rounded border border-border/50">
                                                v{event.data.version || 1}
                                            </span>
                                            {event.data.author && (
                                                <span className="text-[10px] font-mono text-primary-soft">
                                                    @{event.data.author}
                                                </span>
                                            )}
                                        </div>
                                        <span className="font-mono text-[10px] text-text-muted">
                                            {new Date(event.timestamp).toLocaleTimeString()}
                                        </span>
                                    </div>

                                    {event.data.merkleRoot && (
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[9px] uppercase tracking-widest text-text-muted/70">ROOT</span>
                                            <span className="font-mono text-[11px] text-text-muted truncate">
                                                {event.data.merkleRoot}
                                            </span>
                                        </div>
                                    )}

                                    {event.data.contentHash && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-[9px] uppercase tracking-widest text-text-muted/70">DATA</span>
                                            <span className="font-mono text-[11px] text-text-muted truncate">
                                                {event.data.contentHash}
                                            </span>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </AnimatePresence>

                        {memoryEvents.length === 0 && (
                            <div className="h-full flex items-center justify-center text-sm font-mono text-text-muted/50">
                                No writes traversing the 0G network...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
