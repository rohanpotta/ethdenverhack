import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export function ColdOpen({ onComplete }: { onComplete: () => void }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [showSplash, setShowSplash] = useState(true);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return;

        const W = window.innerWidth;
        const H = window.innerHeight;
        canvas.width = W;
        canvas.height = H;

        const sampleW = 1000;
        const sampleH = 500;
        const offscreen = document.createElement('canvas');
        offscreen.width = sampleW;
        offscreen.height = sampleH;
        const offCtx = offscreen.getContext('2d')!;

        offCtx.font = 'bold 140px "Inter", system-ui, sans-serif';
        offCtx.textAlign = 'center';
        offCtx.textBaseline = 'middle';
        offCtx.fillStyle = '#fff';
        offCtx.fillText('SILO', sampleW / 2, sampleH / 2);

        const sampledData = offCtx.getImageData(0, 0, sampleW, sampleH);
        const textPixels: [number, number][] = [];
        const step = 3;

        const offsetX = (W - sampleW) / 2;
        const offsetY = (H - sampleH) / 2 - 20;

        for (let y = 0; y < sampleH; y += step) {
            for (let x = 0; x < sampleW; x += step) {
                const i = (y * sampleW + x) * 4;
                if (sampledData.data[i + 3] > 128) {
                    textPixels.push([x + offsetX, y + offsetY]);
                }
            }
        }

        const particleCount = Math.min(textPixels.length, 600);
        const particles = Array.from({ length: particleCount }, (_, i) => {
            const targetIdx = Math.floor(i * textPixels.length / particleCount);
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.max(W, H) * 0.5 + Math.random() * 300;

            return {
                x: W / 2 + Math.cos(angle) * dist,
                y: H / 2 + Math.sin(angle) * dist,
                targetX: textPixels[targetIdx][0],
                targetY: textPixels[targetIdx][1],
                size: 1 + Math.random() * 2,
                speed: 0.015 + Math.random() * 0.025,
                alpha: 0.3 + Math.random() * 0.7,
                drift: Math.random() * 0.5,
            };
        });

        const bayer = [
            [0, 8, 2, 10],
            [12, 4, 14, 6],
            [3, 11, 1, 9],
            [15, 7, 13, 5],
        ];

        const DRIFT_FRAMES = 30;
        const ASSEMBLE_FRAMES = 120;
        const HOLD_FRAMES = 40;
        const BLOOM_FRAMES = 50;
        const DITHER_FRAMES = 50;
        const TOTAL = DRIFT_FRAMES + ASSEMBLE_FRAMES + HOLD_FRAMES + BLOOM_FRAMES + DITHER_FRAMES;

        let frame = 0;
        let animId: number;
        let done = false;

        const animate = () => {
            if (done) return;
            frame++;

            if (frame > TOTAL) {
                done = true;
                setShowSplash(false);
                return;
            }

            let phase: string;
            if (frame <= DRIFT_FRAMES) phase = 'drift';
            else if (frame <= DRIFT_FRAMES + ASSEMBLE_FRAMES) phase = 'assemble';
            else if (frame <= DRIFT_FRAMES + ASSEMBLE_FRAMES + HOLD_FRAMES) phase = 'hold';
            else if (frame <= DRIFT_FRAMES + ASSEMBLE_FRAMES + HOLD_FRAMES + BLOOM_FRAMES) phase = 'bloom';
            else phase = 'dither';

            ctx.fillStyle = phase === 'bloom' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.12)';
            ctx.fillRect(0, 0, W, H);

            const assembleStart = DRIFT_FRAMES;
            const bloomStart = DRIFT_FRAMES + ASSEMBLE_FRAMES + HOLD_FRAMES;
            const ditherStart = bloomStart + BLOOM_FRAMES;

            for (const p of particles) {
                if (phase === 'drift') {
                    p.x += (W / 2 - p.x) * 0.002 + Math.sin(frame * 0.02 + p.drift * 10) * p.drift;
                    p.y += (H / 2 - p.y) * 0.002 + Math.cos(frame * 0.02 + p.drift * 10) * p.drift;
                } else if (phase === 'assemble') {
                    const t = (frame - assembleStart) / ASSEMBLE_FRAMES;
                    const ease = 1 - Math.pow(1 - t, 3);
                    p.x += (p.targetX - p.x) * (p.speed + ease * 0.06);
                    p.y += (p.targetY - p.y) * (p.speed + ease * 0.06);
                } else if (phase === 'hold') {
                    p.x += (p.targetX - p.x) * 0.1;
                    p.y += (p.targetY - p.y) * 0.1;
                } else if (phase === 'bloom') {
                    const t = (frame - bloomStart) / BLOOM_FRAMES;
                    p.x += (W / 2 - p.x) * 0.04 * t;
                    p.y += (H / 2 - p.y) * 0.04 * t;
                    p.size = Math.max(0.3, p.size * 0.99);
                } else if (phase === 'dither') {
                    const t = (frame - ditherStart) / DITHER_FRAMES;
                    const bx = Math.abs(Math.floor(p.x)) % 4;
                    const by = Math.abs(Math.floor(p.y)) % 4;
                    const threshold = bayer[by][bx] / 16;
                    if (t > threshold) continue;
                }

                const isBlue = phase !== 'drift';
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                ctx.fillStyle = isBlue
                    ? `rgba(0, 102, 255, ${p.alpha})`
                    : `rgba(${60 + Math.random() * 40}, ${80 + Math.random() * 60}, ${200 + Math.random() * 55}, ${p.alpha * 0.6})`;
                ctx.fill();
            }

            if (phase === 'bloom') {
                const t = (frame - bloomStart) / BLOOM_FRAMES;
                const radius = t * Math.max(W, H) * 0.35;
                const alpha = Math.sin(t * Math.PI) * 0.25;
                const gradient = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, radius);
                gradient.addColorStop(0, `rgba(0, 102, 255, ${alpha})`);
                gradient.addColorStop(0.6, `rgba(96, 165, 250, ${alpha * 0.2})`);
                gradient.addColorStop(1, 'rgba(0, 102, 255, 0)');
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, W, H);
            }

            if (phase === 'hold' || phase === 'assemble') {
                const subT = Math.min(1, (frame - assembleStart - 60) / 30);
                if (subT > 0) {
                    ctx.font = '11px "Inter", system-ui, sans-serif';
                    ctx.textAlign = 'center';
                    ctx.fillStyle = `rgba(107, 114, 128, ${subT * 0.7})`;
                    ctx.fillText('ENCRYPTED AGENT MEMORY', W / 2, H / 2 + 90);
                }
            }

            for (let n = 0; n < 40; n++) {
                ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.05})`;
                ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
            }

            animId = requestAnimationFrame(animate);
        };

        animId = requestAnimationFrame(animate);

        const safetyTimeout = setTimeout(() => {
            if (!done) {
                done = true;
                setShowSplash(false);
            }
        }, 6000);

        return () => {
            done = true;
            cancelAnimationFrame(animId);
            clearTimeout(safetyTimeout);
        };
    }, []);

    useEffect(() => {
        if (!showSplash) {
            onComplete();
        }
    }, [showSplash, onComplete]);

    return (
        <AnimatePresence>
            {showSplash && (
                <motion.div
                    className="fixed inset-0 z-[100]"
                    style={{ backgroundColor: '#000000' }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeInOut' }}
                >
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 w-full h-full"
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
