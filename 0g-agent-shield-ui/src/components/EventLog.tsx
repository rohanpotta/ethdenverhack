import { motion } from 'framer-motion';

import type { VaultEvent } from '../App';

const TYPE_CONFIG: Record<VaultEvent['type'], { color: string; bg: string; border: string; label: string }> = {
    store: { color: 'text-accent-store', bg: 'bg-accent-store/10', border: 'border-accent-store/20', label: 'STORE' },
    retrieve: { color: 'text-accent-retrieve', bg: 'bg-accent-retrieve/10', border: 'border-accent-retrieve/20', label: 'RTRVE' },
    session_commit: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', label: 'CMMIT' },
    agent_spawned: { color: 'text-accent-agent', bg: 'bg-accent-agent/10', border: 'border-accent-agent/20', label: 'SPAWN' },
    agent_message: { color: 'text-accent-agent', bg: 'bg-accent-agent/10', border: 'border-accent-agent/20', label: 'MSG' },
    autonomy_level_changed: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20', label: 'AUTON' },
    memory_write: { color: 'text-accent-warn', bg: 'bg-accent-warn/10', border: 'border-accent-warn/20', label: 'MEM_W' },
    shared_memory: { color: 'text-accent-warn', bg: 'bg-accent-warn/10', border: 'border-accent-warn/20', label: 'MEM_S' },
    memory_fork: { color: 'text-accent-danger', bg: 'bg-accent-danger/10', border: 'border-accent-danger/20', label: 'FORK' },
    memory_head_updated: { color: 'text-accent-warn', bg: 'bg-accent-warn/10', border: 'border-accent-warn/20', label: 'HEAD' },
};

export function EventLog({ events }: { events: VaultEvent[] }) {
    return (
        <div className="max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="font-mono text-lg font-semibold tracking-wide">
                    Event Log
                </h2>
                <p className="text-sm text-text-muted mt-1">
                    Complete audit trail of all agent vault operations.
                </p>
            </div>

            <div className="flex items-center gap-6">
                {(['store', 'retrieve', 'session_commit'] as const).map(type => {
                    const count = events.filter(e => e.type === type).length;
                    const config = TYPE_CONFIG[type];
                    return (
                        <div key={type} className={`flex items-center gap-2 px-3 py-1.5 rounded ${config.bg} border ${config.border}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                            <span className={`font-mono text-xs ${config.color}`}>{count}</span>
                            <span className="label-caps">{config.label}S</span>
                        </div>
                    );
                })}
            </div>

            <div className="glass-panel rounded overflow-hidden">
                <div className="grid grid-cols-12 gap-4 px-4 py-2 border-b border-border">
                    <div className="col-span-1 label-caps">#</div>
                    <div className="col-span-2 label-caps">Type</div>
                    <div className="col-span-1 label-caps">Source</div>
                    <div className="col-span-5 label-caps">Hash</div>
                    <div className="col-span-3 label-caps text-right">Time</div>
                </div>

                {events.length === 0 ? (
                    <div className="text-center py-12">
                        <span className="label-caps">No events recorded yet</span>
                    </div>
                ) : (
                    <div className="max-h-[60vh] overflow-y-auto">
                        {events.map((event, i) => {
                            const config = TYPE_CONFIG[event.type];
                            return (
                                <motion.div
                                    key={event.id}
                                    initial={{ opacity: 0, x: -5 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.02 }}
                                    className="grid grid-cols-12 gap-4 px-4 py-2.5 border-b border-border/50 hover:bg-base-elevated/50 transition-colors group"
                                >
                                    <div className="col-span-1 font-mono text-xs text-text-muted">{event.id}</div>
                                    <div className="col-span-2 flex items-center gap-1.5">
                                        <span className={`w-1.5 h-1.5 rounded-full ${config.color.replace('text-', 'bg-')}`} />
                                        <span className={`font-mono text-[11px] uppercase tracking-widest ${config.color}`}>{config.label}</span>
                                    </div>
                                    <div className="col-span-1">
                                        <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider ${event.source === 'mcp' ? 'bg-primary/10 text-primary' : 'bg-accent-store/10 text-accent-store'
                                            }`}>
                                            {event.source}
                                        </span>
                                    </div>
                                    <div className="col-span-5 mono-hash text-text-muted truncate group-hover:text-text-primary transition-colors">
                                        {event.data?.rootHash || event.data?.merkleRoot || '-'}
                                    </div>
                                    <div className="col-span-3 text-right font-mono text-[11px] text-text-muted">
                                        {new Date(event.timestamp).toLocaleTimeString()}
                                    </div>
                                </motion.div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
