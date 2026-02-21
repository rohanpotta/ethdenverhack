import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users, Lock, Unlock, ArrowRight, Copy, Check } from 'lucide-react';

interface VaultEvent {
    id: number;
    type: 'store' | 'retrieve' | 'session_commit';
    timestamp: number;
    source: 'api' | 'mcp';
    data: Record<string, any>;
}

/**
 * Multi-agent sharing view.
 * Two agent cards side-by-side with animated data transfer.
 */
export function AgentsPanel({ events }: { events: VaultEvent[] }) {
    const [transferActive, setTransferActive] = useState(false);
    const [copiedHash, setCopiedHash] = useState('');

    const storeEvents = events.filter(e => e.type === 'store');
    const latestStore = storeEvents[0];

    const copyHash = (hash: string) => {
        navigator.clipboard.writeText(hash);
        setCopiedHash(hash);
        setTimeout(() => setCopiedHash(''), 1500);
    };

    const simulateTransfer = () => {
        if (!latestStore) return;
        setTransferActive(true);
        setTimeout(() => setTransferActive(false), 2000);
    };

    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="font-mono text-lg font-semibold tracking-wide flex items-center gap-2">
                    <Users className="w-4 h-4 text-primary" />
                    Multi-Agent Sharing
                </h2>
                <p className="text-sm text-text-muted mt-1">
                    Agents share encrypted memories through 0G storage. No central relay.
                </p>
            </div>

            {/* Agent cards with transfer path */}
            <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
                {/* Agent A — Claude (amber) */}
                <div className="lg:col-span-5 glass-panel rounded p-4 space-y-4 border-accent-retrieve/20 border relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-accent-retrieve" />
                            <span className="label-caps text-accent-retrieve">Agent A · Claude</span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">MCP</span>
                    </div>

                    {/* Terminal-style display */}
                    <div className="bg-base rounded p-3 border border-border font-mono text-xs space-y-1">
                        <div className="text-text-muted">
                            <span className="text-accent-retrieve">❯</span> vault_share
                        </div>
                        {latestStore ? (
                            <>
                                <div className="text-accent-commit">✓ Encrypted & stored</div>
                                <div className="text-text-muted truncate">
                                    root: <span className="text-text-primary">{latestStore.data?.rootHash?.slice(0, 24)}...</span>
                                </div>
                                <div className="text-text-muted truncate">
                                    size: <span className="text-text-primary">{latestStore.data?.size || '?'} bytes</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-text-muted">
                                <span className="cursor-blink">▌</span>
                            </div>
                        )}
                    </div>

                    {latestStore && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyHash(latestStore.data?.rootHash || '')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-retrieve/10 border border-accent-retrieve/20 text-accent-retrieve font-mono text-[10px] uppercase tracking-widest rounded hover:bg-accent-retrieve/20 transition-all"
                            >
                                {copiedHash === latestStore.data?.rootHash ? (
                                    <><Check className="w-3 h-3" /> Copied</>
                                ) : (
                                    <><Copy className="w-3 h-3" /> Copy Hash</>
                                )}
                            </button>
                            <button
                                onClick={simulateTransfer}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary font-mono text-[10px] uppercase tracking-widest rounded hover:bg-primary/20 transition-all"
                            >
                                <ArrowRight className="w-3 h-3" /> Share to Agent B
                            </button>
                        </div>
                    )}
                </div>

                {/* Transfer path (center column) */}
                <div className="lg:col-span-1 flex items-center justify-center relative">
                    <svg className="w-full h-20 lg:h-full" viewBox="0 0 60 100" preserveAspectRatio="none">
                        {/* Connection path */}
                        <path
                            d="M 5 50 C 25 50, 35 50, 55 50"
                            fill="none"
                            stroke="rgba(30, 30, 56, 0.6)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                        />

                        {/* Animated traveling dot with trailing ghost orbs */}
                        {transferActive && (
                            <>
                                {/* 6 trailing ghost orbs — decreasing opacity, staggered delay */}
                                {[0.5, 0.35, 0.22, 0.14, 0.1, 0.06].map((opacity, i) => (
                                    <motion.circle
                                        key={`trail-${i}`}
                                        r={3.5 - i * 0.3}
                                        fill="#7C3AED"
                                        opacity={opacity}
                                        filter={`blur(${i * 0.5}px)`}
                                        initial={{ cx: 5, cy: 50 }}
                                        animate={{ cx: 55, cy: 50 }}
                                        transition={{ duration: 1.5, ease: 'easeInOut', delay: (i + 1) * 0.06 }}
                                    />
                                ))}
                                {/* Lead orb */}
                                <motion.circle
                                    r="4"
                                    fill="#7C3AED"
                                    initial={{ cx: 5, cy: 50 }}
                                    animate={{ cx: 55, cy: 50 }}
                                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                                >
                                    <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite" />
                                </motion.circle>
                            </>
                        )}
                    </svg>

                    {/* Lock/unlock icon */}
                    <div className="absolute">
                        {transferActive ? (
                            <motion.div
                                initial={{ scale: 1 }}
                                animate={{ scale: [1, 1.3, 1] }}
                                transition={{ duration: 0.6 }}
                            >
                                <Unlock className="w-4 h-4 text-accent-commit" />
                            </motion.div>
                        ) : (
                            <Lock className="w-4 h-4 text-text-muted" />
                        )}
                    </div>
                </div>

                {/* Agent B — Cursor (teal) */}
                <div className={`lg:col-span-5 glass-panel rounded p-4 space-y-4 border-primary/20 border relative transition-all duration-500 ${transferActive ? 'border-primary/60 shadow-[0_0_20px_rgba(0,229,195,0.1)]' : ''
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${transferActive ? 'bg-primary animate-pulse' : 'bg-text-muted'}`} />
                            <span className="label-caps text-primary">Agent B · Cursor</span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">MCP</span>
                    </div>

                    {/* Terminal-style display */}
                    <div className="bg-base rounded p-3 border border-border font-mono text-xs space-y-1">
                        <div className="text-text-muted">
                            <span className="text-primary">❯</span> vault_import
                        </div>
                        {transferActive ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.2 }}
                            >
                                <div className="text-accent-commit">✓ Decrypted & imported</div>
                                <div className="text-text-muted">
                                    <span className="text-text-primary">Shared memory received from Agent A</span>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="text-text-muted">
                                Waiting for shared memory...<span className="cursor-blink">▌</span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Shared memories log */}
            <div className="glass-panel rounded p-4 space-y-3">
                <span className="label-caps">Shared Memory Log</span>
                {storeEvents.length === 0 ? (
                    <p className="text-sm text-text-muted">No shared memories yet. Use Claude to vault_share something.</p>
                ) : (
                    <div className="space-y-2">
                        {storeEvents.slice(0, 8).map((event, i) => (
                            <motion.div
                                key={event.id}
                                initial={{ opacity: 0, y: 5 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.05 }}
                                className="flex items-center justify-between text-xs"
                            >
                                <div className="flex items-center gap-2">
                                    <Lock className="w-3 h-3 text-accent-store" />
                                    <span className="mono-hash text-text-primary truncate max-w-[300px]">
                                        {event.data?.rootHash || '—'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="label-caps">{event.data?.size || '?'}b</span>
                                    <span className="text-text-muted font-mono">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </span>
                                    <button
                                        onClick={() => copyHash(event.data?.rootHash || '')}
                                        className="text-text-muted hover:text-primary transition-colors"
                                    >
                                        {copiedHash === event.data?.rootHash ? <Check className="w-3 h-3 text-accent-commit" /> : <Copy className="w-3 h-3" />}
                                    </button>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
