'use client';

import { useEffect, useRef, useState } from 'react';

/**
 * Live microphone waveform. Reads the candidate's mic stream via an AnalyserNode
 * and renders animated bars. Falls back to idle bars when no stream/level.
 */
export function Waveform({ stream, bars = 28, active = true }: { stream: MediaStream | null; bars?: number; active?: boolean }) {
  const [levels, setLevels] = useState<number[]>(() => Array(bars).fill(8));
  const raf = useRef(0);

  useEffect(() => {
    if (!stream || !active) return;
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteFrequencyData(data);
        const next: number[] = [];
        for (let i = 0; i < bars; i += 1) {
          const v = data[i % data.length] || 0;
          next.push(6 + (v / 255) * 30);
        }
        setLevels(next);
        raf.current = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* analyser unsupported */
    }
    return () => {
      cancelAnimationFrame(raf.current);
      ctx?.close().catch(() => {});
    };
  }, [stream, active, bars]);

  return (
    <div className="flex h-9 items-center justify-center gap-[3px]">
      {levels.map((h, i) => (
        <span
          key={i}
          className="w-[3px] rounded-full bg-gradient-to-t from-primary to-accent transition-[height] duration-100"
          style={{ height: `${h}px` }}
        />
      ))}
    </div>
  );
}

export default Waveform;
