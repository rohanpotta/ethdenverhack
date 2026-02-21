import { useEffect, useRef } from 'react';

interface HexCascadeProps {
    ciphertext: string;
    rootHash: string;
    onComplete?: () => void;
}

/**
 * Matrix-rain style hex cascade using actual ciphertext characters.
 * Ciphertext cascades down, then collapses into the rootHash. ~1.2s total.
 */
export function HexCascade({ ciphertext, rootHash, onComplete }: HexCascadeProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const parent = canvas.parentElement;
        if (!parent) return;

        canvas.width = parent.clientWidth;
        canvas.height = parent.clientHeight;

        const cols = Math.floor(canvas.width / 14);
        const fontSize = 13;
        const hexChars = ciphertext.replace(/[^a-f0-9]/gi, '').split('');
        if (hexChars.length === 0) {
            onComplete?.();
            return;
        }

        const drops = new Array(cols).fill(0).map(() => -Math.random() * 20);
        const speeds = new Array(cols).fill(0).map(() => 0.3 + Math.random() * 0.7);
        let frameCount = 0;
        const maxFrames = 72; // ~1.2s at 60fps

        const draw = () => {
            // Fade effect
            ctx.fillStyle = 'rgba(0, 0, 0, 0.15)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            ctx.font = `${fontSize}px "Inter", system-ui, sans-serif`;

            for (let i = 0; i < cols; i++) {
                const char = hexChars[Math.floor(Math.random() * hexChars.length)];
                const x = i * 14;
                const y = drops[i] * fontSize;

                // Color gradient from accent-0g to accent-store
                const progress = frameCount / maxFrames;
                if (progress < 0.7) {
                    ctx.fillStyle = `rgba(0, 102, 255, ${0.7 + Math.random() * 0.3})`;
                } else {
                    ctx.fillStyle = `rgba(96, 165, 250, ${0.7 + Math.random() * 0.3})`;
                }

                ctx.fillText(char, x, y);
                drops[i] += speeds[i];

                if (drops[i] * fontSize > canvas.height && Math.random() > 0.97) {
                    drops[i] = 0;
                }
            }

            frameCount++;

            if (frameCount < maxFrames) {
                requestAnimationFrame(draw);
            } else {
                // Collapse to rootHash
                ctx.fillStyle = 'rgba(0, 0, 0, 0.95)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.font = `14px "Inter", system-ui, sans-serif`;
                ctx.fillStyle = '#0066FF';
                ctx.textAlign = 'center';
                ctx.fillText(rootHash, canvas.width / 2, canvas.height / 2);

                setTimeout(() => onComplete?.(), 500);
            }
        };

        requestAnimationFrame(draw);
    }, [ciphertext, rootHash, onComplete]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute inset-0 z-30 pointer-events-none"
            style={{ borderRadius: 'inherit' }}
        />
    );
}
