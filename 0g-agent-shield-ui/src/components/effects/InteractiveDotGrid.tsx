import { useRef, useEffect, useCallback } from 'react';

interface Dot {
  cx: number;
  cy: number;
  baseRadius: number;
}

interface InteractiveDotGridProps {
  dotSize?: number;
  gap?: number;
  baseColor?: string;
  activeColor?: string;
  proximity?: number;
  className?: string;
}

function hexToRgb(hex: string) {
  const m = hex.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
  if (!m) return { r: 0, g: 0, b: 0 };
  return { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) };
}

export function InteractiveDotGrid({
  dotSize = 1.5,
  gap = 28,
  baseColor = '#1a1a1a',
  activeColor = '#0066FF',
  proximity = 120,
  className = '',
}: InteractiveDotGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<Dot[]>([]);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number>(0);

  const baseRgb = hexToRgb(baseColor);
  const activeRgb = hexToRgb(activeColor);

  const buildGrid = useCallback(() => {
    const wrap = wrapperRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;

    const rect = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(dpr, dpr);

    const cell = dotSize * 2 + gap;
    const cols = Math.floor((rect.width + gap) / cell);
    const rows = Math.floor((rect.height + gap) / cell);
    const gridW = cell * cols - gap;
    const gridH = cell * rows - gap;
    const startX = (rect.width - gridW) / 2 + dotSize;
    const startY = (rect.height - gridH) / 2 + dotSize;

    const dots: Dot[] = [];
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        dots.push({
          cx: startX + col * cell,
          cy: startY + row * cell,
          baseRadius: dotSize,
        });
      }
    }
    dotsRef.current = dots;
  }, [dotSize, gap]);

  useEffect(() => {
    buildGrid();

    const ro = new ResizeObserver(buildGrid);
    if (wrapperRef.current) ro.observe(wrapperRef.current);
    return () => ro.disconnect();
  }, [buildGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const proxSq = proximity * proximity;

    const draw = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

      const { x: mx, y: my } = mouseRef.current;

      for (const dot of dotsRef.current) {
        const dx = dot.cx - mx;
        const dy = dot.cy - my;
        const distSq = dx * dx + dy * dy;

        let r: number, g: number, b: number, alpha: number, radius: number;

        if (distSq <= proxSq) {
          const dist = Math.sqrt(distSq);
          const t = 1 - dist / proximity;
          const eased = t * t;

          r = Math.round(baseRgb.r + (activeRgb.r - baseRgb.r) * eased);
          g = Math.round(baseRgb.g + (activeRgb.g - baseRgb.g) * eased);
          b = Math.round(baseRgb.b + (activeRgb.b - baseRgb.b) * eased);
          alpha = 0.35 + eased * 0.65;
          radius = dot.baseRadius + eased * 2;
        } else {
          r = baseRgb.r;
          g = baseRgb.g;
          b = baseRgb.b;
          alpha = 0.35;
          radius = dot.baseRadius;
        }

        ctx.beginPath();
        ctx.arc(dot.cx, dot.cy, radius, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
        ctx.fill();

        if (distSq <= proxSq) {
          const dist = Math.sqrt(distSq);
          const t = 1 - dist / proximity;
          if (t > 0.3) {
            ctx.beginPath();
            ctx.arc(dot.cx, dot.cy, radius + 3 * t, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${activeRgb.r},${activeRgb.g},${activeRgb.b},${t * 0.15})`;
            ctx.fill();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(rafRef.current);
  }, [proximity, baseRgb, activeRgb]);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const onMove = (e: MouseEvent) => {
      const rect = wrapper.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const onLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };

    window.addEventListener('mousemove', onMove, { passive: true });
    window.addEventListener('mouseleave', onLeave);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseleave', onLeave);
    };
  }, []);

  return (
    <div ref={wrapperRef} className={`absolute inset-0 pointer-events-none ${className}`}>
      <canvas ref={canvasRef} className="absolute inset-0" />
    </div>
  );
}
