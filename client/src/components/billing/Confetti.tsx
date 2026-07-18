'use client';

import { useEffect, useRef } from 'react';

/**
 * A one-shot celebration burst — no library, one <canvas>.
 *
 * ~140 paper pieces launched from two side cannons, with gravity, air drag,
 * horizontal drift and per-piece rotation, fading out over ~4s and removing
 * themselves. Colors are read from the live CSS custom properties so the
 * burst is always on-brand in either theme. Respects prefers-reduced-motion
 * by rendering nothing at all, and the overlay never intercepts a click.
 */
export function Confetti({ pieces = 140, duration = 4000 }: { pieces?: number; duration?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
    };
    resize();
    window.addEventListener('resize', resize);

    // Brand palette from the theme tokens, with graceful fallbacks.
    const css = getComputedStyle(document.documentElement);
    const token = (name: string, fallback: string) => {
      const v = css.getPropertyValue(name).trim();
      return v ? `hsl(${v})` : fallback;
    };
    const COLORS = [
      token('--primary', '#6366f1'),
      token('--accent', '#22d3ee'),
      '#f59e0b', '#ec4899', '#10b981', '#8b5cf6',
    ];

    type Piece = {
      x: number; y: number; vx: number; vy: number;
      w: number; h: number; rot: number; vr: number;
      color: string; shape: 'rect' | 'circle';
    };

    const rand = (a: number, b: number) => a + Math.random() * (b - a);
    const W = canvas.width;
    const H = canvas.height;

    // Two cannons at the lower corners firing up and inward.
    const all: Piece[] = Array.from({ length: pieces }, (_, i) => {
      const fromLeft = i % 2 === 0;
      return {
        x: fromLeft ? rand(0, W * 0.15) : rand(W * 0.85, W),
        y: rand(H * 0.55, H * 0.75),
        vx: (fromLeft ? 1 : -1) * rand(2, 9) * dpr,
        vy: rand(-16, -8) * dpr,
        w: rand(5, 10) * dpr,
        h: rand(8, 16) * dpr,
        rot: rand(0, Math.PI * 2),
        vr: rand(-0.25, 0.25),
        color: COLORS[i % COLORS.length],
        shape: Math.random() < 0.25 ? 'circle' : 'rect',
      };
    });

    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = now - start;
      const fade = Math.max(0, 1 - t / duration);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      if (fade === 0) return; // done — leave the canvas empty

      for (const p of all) {
        p.vy += 0.32 * dpr; // gravity
        p.vx *= 0.992; // drag
        p.x += p.vx + Math.sin((t / 300) + p.rot) * 0.6 * dpr; // drift
        p.y += p.vy;
        p.rot += p.vr;

        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        if (p.shape === 'circle') {
          ctx.beginPath();
          ctx.arc(0, 0, p.w / 2, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        ctx.restore();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, [pieces, duration]);

  return (
    <canvas
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed inset-0 z-50 h-full w-full"
    />
  );
}

export default Confetti;
