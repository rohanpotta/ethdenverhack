import { useState } from 'react';
import { motion } from 'framer-motion';

interface VaultEvent {
    id: number;
    type: 'store' | 'retrieve' | 'session_commit';
    timestamp: number;
    source: 'api' | 'mcp';
    data: Record<string, any>;
}

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
                <h2 className="font-mono text-lg font-semibold tracking-wide">
                    Multi-Agent Sharing
                </h2>
                <p className="text-sm text-text-muted mt-1">
                    Agents share encrypted memories through 0G storage. No central relay.
                </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-11 gap-4 items-stretch">
                {/* Agent A */}
                <div className="lg:col-span-5 glass-panel rounded p-4 space-y-4 border-accent-retrieve/20 border relative overflow-hidden">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-accent-retrieve" />
                            <span className="label-caps text-accent-retrieve">Agent A · Claude</span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">MCP</span>
                    </div>

                    <div className="bg-base rounded p-3 border border-border font-mono text-xs space-y-1">
                        <div className="text-text-muted">
                            <span className="text-accent-retrieve">{">"}</span> vault_share
                        </div>
                        {latestStore ? (
                            <>
                                <div className="text-accent-commit">OK Encrypted & stored</div>
                                <div className="text-text-muted truncate">
                                    root: <span className="text-text-primary">{latestStore.data?.rootHash?.slice(0, 24)}...</span>
                                </div>
                                <div className="text-text-muted truncate">
                                    size: <span className="text-text-primary">{latestStore.data?.size || '?'} bytes</span>
                                </div>
                            </>
                        ) : (
                            <div className="text-text-muted">
                                <span className="cursor-blink">|</span>
                            </div>
                        )}
                    </div>

                    {latestStore && (
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => copyHash(latestStore.data?.rootHash || '')}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-accent-retrieve/10 border border-accent-retrieve/20 text-accent-retrieve font-mono text-[10px] uppercase tracking-widest rounded hover:bg-accent-retrieve/20 transition-all"
                            >
                                {copiedHash === latestStore.data?.rootHash ? 'Copied' : 'Copy Hash'}
                            </button>
                            <button
                                onClick={simulateTransfer}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary font-mono text-[10px] uppercase tracking-widest rounded hover:bg-primary/20 transition-all"
                            >
                                Share to Agent B
                            </button>
                        </div>
                    )}
                </div>

                {/* Transfer path */}
                <div className="lg:col-span-1 flex items-center justify-center relative">
                    <svg className="w-full h-20 lg:h-full" viewBox="0 0 60 100" preserveAspectRatio="none">
                        <path
                            d="M 5 50 C 25 50, 35 50, 55 50"
                            fill="none"
                            stroke="rgba(255, 255, 255, 0.08)"
                            strokeWidth="1"
                            strokeDasharray="4 4"
                        />

                        {transferActive && (
                            <>
                                {[0.5, 0.35, 0.22, 0.14, 0.1, 0.06].map((opacity, i) => (
                                    <motion.circle
                                        key={`trail-${i}`}
                                        r={3.5 - i * 0.3}
                                        fill="#0066FF"
                                        opacity={opacity}
                                        filter={`blur(${i * 0.5}px)`}
                                        initial={{ cx: 5, cy: 50 }}
                                        animate={{ cx: 55, cy: 50 }}
                                        transition={{ duration: 1.5, ease: 'easeInOut', delay: (i + 1) * 0.06 }}
                                    />
                                ))}
                                <motion.circle
                                    r="4"
                                    fill="#0066FF"
                                    initial={{ cx: 5, cy: 50 }}
                                    animate={{ cx: 55, cy: 50 }}
                                    transition={{ duration: 1.5, ease: 'easeInOut' }}
                                >
                                    <animate attributeName="opacity" values="1;0.5;1" dur="0.5s" repeatCount="indefinite" />
                                </motion.circle>
                            </>
                        )}
                    </svg>

                    <div className="absolute text-[10px] font-mono text-text-muted">
                        {transferActive ? '...' : '-'}
                    </div>
                </div>

                {/* Agent B */}
                <div className={`lg:col-span-5 glass-panel rounded p-4 space-y-4 border-primary/20 border relative transition-all duration-500 ${transferActive ? 'border-primary/60' : ''
                    }`}>
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className={`w-2 h-2 rounded-full ${transferActive ? 'bg-primary animate-pulse' : 'bg-text-muted'}`} />
                            <span className="label-caps text-primary">Agent B · Cursor</span>
                        </div>
                        <span className="text-[10px] font-mono text-text-muted">MCP</span>
                    </div>

                    <div className="bg-base rounded p-3 border border-border font-mono text-xs space-y-1">
                        <div className="text-text-muted">
                            <span className="text-primary">{">"}</span> vault_import
                        </div>
                        {transferActive ? (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={{ delay: 1.2 }}
                            >
                                <div className="text-accent-commit">OK Decrypted & imported</div>
                                <div className="text-text-muted">
                                    <span className="text-text-primary">Shared memory received from Agent A</span>
                                </div>
                            </motion.div>
                        ) : (
                            <div className="text-text-muted">
                                Waiting for shared memory...<span className="cursor-blink">|</span>
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
                                    <span className="w-1.5 h-1.5 rounded-full bg-accent-store" />
                                    <span className="mono-hash text-text-primary truncate max-w-[300px]">
                                        {event.data?.rootHash || '-'}
                                    </span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="label-caps">{event.data?.size || '?'}b</span>
                                    <span className="text-text-muted font-mono">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </span>
                                    <button
                                        onClick={() => copyHash(event.data?.rootHash || '')}
                                        className="text-text-muted hover:text-primary transition-colors text-[10px] font-mono"
                                    >
                                        {copiedHash === event.data?.rootHash ? 'Copied' : 'Copy'}
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
