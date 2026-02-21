import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { VaultEvent } from '../App';

export function AutonomyDashboard({ events }: { events: VaultEvent[] }) {
    // Extract autonomy level setting events
    const currentModeEvent = useMemo(() => {
        const levelEvents = events.filter(e => e.type === 'autonomy_level_changed');
        return levelEvents.length > 0 ? levelEvents[0] : null;
    }, [events]);

    const activeMode = currentModeEvent?.data?.level || 'off'; // 'off', 'monitor', 'suggest', 'autonomous'
    const isActive = activeMode === 'autonomous';

    // The Pulse: Heartbeat events
    const heartbeats = useMemo(() => {
        return events.filter(e => e.type === 'shared_memory' && e.data.channel === 'silo:heartbeat').slice(0, 10);
    }, [events]);

    // Agent Spawns
    const spawns = useMemo(() => {
        return events.filter(e => e.type === 'agent_spawned');
    }, [events]);

    return (
        <div className="max-w-5xl mx-auto h-full flex flex-col space-y-6">
            <div className="flex justify-between items-start">
                <div>
                    <h2 className="font-mono text-lg font-semibold tracking-wide flex items-center gap-2">
                        {isActive ? (
                            <span className="w-2.5 h-2.5 rounded-full bg-primary animate-pulse" style={{ boxShadow: '0 0 10px rgba(100, 255, 218, 0.5)' }}></span>
                        ) : (
                            <span className="w-2.5 h-2.5 rounded-full bg-text-muted/40"></span>
                        )}
                        Autonomy Engine
                    </h2>
                    <p className="text-sm text-text-muted mt-1">
                        Monitoring background health-checks, scheduled commits, and dynamic sub-agent spawning.
                    </p>
                </div>

                <div className="flex items-center gap-3 bg-base-elevated/40 border border-border px-3 py-1.5 rounded-md">
                    <span className="text-[10px] font-mono text-text-muted uppercase tracking-widest">Engine Mode</span>
                    <span className={`text-[11px] font-mono font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border 
                        ${isActive ? 'bg-primary/10 text-primary border-primary/20' :
                            activeMode !== 'off' ? 'bg-accent-warn/10 text-accent-warn border-accent-warn/20' :
                                'bg-base/50 text-text-muted border-border/50'}`}>
                        {activeMode}
                    </span>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-6 flex-1 min-h-0">
                {/* Heartbeat Pulse */}
                <div className="bg-base border border-border rounded-lg p-4 flex flex-col relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>

                    <h3 className="label-caps mb-4 flex items-center justify-between">
                        The Pulse (System Heartbeat)
                        <span className="font-mono text-[10px] font-bold text-text-muted">{heartbeats.length} TICKS</span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                        <AnimatePresence>
                            {heartbeats.map((hb, i) => (
                                <motion.div
                                    key={hb.id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    className={`
                                        flex items-center justify-between p-2.5 rounded border
                                        ${i === 0 ? 'bg-primary/5 border-primary/20' : 'bg-base-elevated/20 border-border/40'}
                                    `}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-1.5 h-1.5 rounded-full ${i === 0 && isActive ? 'bg-primary animate-ping' : 'bg-primary/30'}`} />
                                        <span className="font-mono text-[11px] text-text-muted">TICK_{hb.timestamp.toString().slice(-6)}</span>
                                    </div>
                                    <div className="font-mono text-[10px] text-primary-soft">
                                        {hb.data.merkleRoot ? hb.data.merkleRoot.slice(0, 10) + '...' : 'SYNCED'}
                                    </div>
                                </motion.div>
                            ))}

                            {heartbeats.length === 0 && (
                                <div className="p-4 text-center font-mono text-xs text-text-muted/50 border border-dashed border-border/50 rounded">
                                    Heartbeat Daemon Offline. Send `autonomy_set_level` to activate.
                                </div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>

                {/* Agent Spawning Tree */}
                <div className="bg-base border border-border rounded-lg p-4 flex flex-col relative overflow-hidden">
                    <h3 className="label-caps mb-4 flex items-center justify-between">
                        Sub-Agent Generation
                        <span className="font-mono text-[10px] font-bold text-accent-agent bg-accent-agent/10 px-1.5 py-0.5 rounded border border-accent-agent/20">
                            {spawns.length} ACTIVE
                        </span>
                    </h3>

                    <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                        {spawns.map((spawn, i) => (
                            <motion.div
                                key={spawn.id}
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: i * 0.1 }}
                                className="relative pl-6"
                            >
                                {/* Tree branch visual */}
                                <div className="absolute left-2 top-0 bottom-[-16px] w-[1px] bg-border/80"></div>
                                <div className="absolute left-2 top-4 w-3 h-[1px] bg-border/80"></div>

                                <div className="bg-base-elevated/40 border border-border/80 rounded-md p-3 group hover:border-accent-agent/50 transition-colors">
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <span className="w-2 h-2 rounded bg-accent-agent/80 shadow-[0_0_8px_rgba(255,107,255,0.4)]" />
                                            <span className="font-mono text-xs font-bold text-text-primary capitalize">
                                                {spawn.data.role || 'Worker'} Agent
                                            </span>
                                        </div>
                                        <span className="font-mono text-[9px] text-text-muted bg-base px-1 py-0.5 rounded">
                                            {spawn.data.childId?.slice(0, 8) || `AID-${spawn.id * 10}`}
                                        </span>
                                    </div>
                                    <p className="font-mono text-[10px] text-text-muted leading-relaxed line-clamp-2">
                                        {spawn.data.context || 'Provisioned by Autonomy Engine router dispatcher.'}
                                    </p>
                                </div>
                            </motion.div>
                        ))}

                        {spawns.length === 0 && (
                            <div className="h-full mt-10 flex flex-col items-center justify-center text-center gap-3 opacity-50">
                                <span className="font-mono text-[10px] tracking-widest text-text-muted">NO SUB-AGENTS SPAWNED</span>
                                <div className="w-0.5 h-12 bg-gradient-to-b from-border to-transparent"></div>
                                <div className="w-1.5 h-1.5 rounded-full bg-border"></div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
