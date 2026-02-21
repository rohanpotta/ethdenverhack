import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface CommitData {
    merkleRoot: string;
    sessionId: string;
    eventCount: number;
    traceRootHash: string;
    traceTxHash: string;
}

export function CommitCeremony({
    commitData,
    onDismiss,
}: {
    commitData: CommitData | null;
    onDismiss: () => void;
}) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showCard, setShowCard] = useState(false);
    const [flashActive, setFlashActive] = useState(false);

    useEffect(() => {
        if (!commitData) return;

        setFlashActive(true);
        setTimeout(() => setFlashActive(false), 80);

        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = window.innerWidth;
                canvas.height = window.innerHeight;
                const W = canvas.width;
                const H = canvas.height;
                const cx = W / 2;
                const cy = H / 2;

                const particles = Array.from({ length: 40 }, () => {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 2 + Math.random() * 6;
                    return {
                        x: cx,
                        y: cy,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        size: 1 + Math.random() * 3,
                        life: 1,
                        decay: 0.015 + Math.random() * 0.01,
                        color: Math.random() > 0.3 ? [0, 102, 255] : [96, 165, 250],
                    };
                });

                let frame = 0;
                const burst = () => {
                    frame++;
                    if (frame > 60) return;

                    ctx.clearRect(0, 0, W, H);

                    for (const p of particles) {
                        p.x += p.vx;
                        p.y += p.vy;
                        p.vy += 0.1;
                        p.vx *= 0.98;
                        p.vy *= 0.98;
                        p.life -= p.decay;

                        if (p.life <= 0) continue;

                        ctx.beginPath();
                        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
                        ctx.fillStyle = `rgba(${p.color[0]}, ${p.color[1]}, ${p.color[2]}, ${p.life})`;
                        ctx.fill();
                    }

                    requestAnimationFrame(burst);
                };
                requestAnimationFrame(burst);
            }
        }

        setTimeout(() => setShowCard(true), 500);

        const dismissTimer = setTimeout(() => {
            setShowCard(false);
            setTimeout(onDismiss, 400);
        }, 6000);

        return () => clearTimeout(dismissTimer);
    }, [commitData, onDismiss]);

    if (!commitData) return null;

    const storageScanUrl = commitData.traceTxHash
        ? `https://chainscan-newton.0g.ai/tx/${commitData.traceTxHash}`
        : '#';

    return (
        <div className="fixed inset-0 z-50 pointer-events-none">
            <AnimatePresence>
                {flashActive && (
                    <motion.div
                        className="absolute inset-0 bg-primary"
                        initial={{ opacity: 0.8 }}
                        animate={{ opacity: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                    />
                )}
            </AnimatePresence>

            <canvas
                ref={canvasRef}
                className="absolute inset-0 w-full h-full pointer-events-none"
            />

            <AnimatePresence>
                {showCard && (
                    <motion.div
                        className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto"
                        initial={{ opacity: 0, y: 60 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                        }}
                    >
                        <div className="glass-panel rounded border border-accent-commit/40 p-5 min-w-[380px] relative overflow-hidden">
                            <div className="absolute inset-0 border border-dashed border-accent-commit/20 rounded m-1 pointer-events-none" />

                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-8 h-8 rounded-full bg-accent-commit/20 flex items-center justify-center border border-accent-commit/30">
                                    <span className="text-accent-commit font-mono text-[10px] font-bold">OK</span>
                                </div>
                                <div>
                                    <div className="font-mono text-sm font-semibold text-accent-commit tracking-widest">VERIFIED</div>
                                    <div className="text-[10px] text-text-muted font-mono">Session attested on-chain</div>
                                </div>
                            </div>

                            <div className="space-y-2 text-xs font-mono">
                                <div className="flex justify-between">
                                    <span className="label-caps">Merkle Root</span>
                                    <span className="text-primary">{commitData.merkleRoot?.slice(0, 20)}...</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="label-caps">Events</span>
                                    <span className="text-text-primary">{commitData.eventCount}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="label-caps">Trace Hash</span>
                                    <span className="text-text-muted">{commitData.traceRootHash?.slice(0, 20)}...</span>
                                </div>
                            </div>

                            <a
                                href={storageScanUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 mt-4 px-3 py-1.5 bg-accent-commit/10 border border-accent-commit/20 text-accent-commit font-mono text-[10px] uppercase tracking-widest rounded hover:bg-accent-commit/20 transition-all w-fit"
                            >
                                View on StorageScan
                            </a>

                            <button
                                onClick={() => { setShowCard(false); setTimeout(onDismiss, 300); }}
                                className="absolute top-2 right-2 text-text-muted hover:text-text-primary text-xs font-mono"
                            >
                                x
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
