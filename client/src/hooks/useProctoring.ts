'use client';

import { useEffect, useRef, useState } from 'react';
import { ProctoringEngine, type ProctorConfig, type ProctorUpdate } from '@/lib/proctoring/engine';

interface Options {
  token: string;
  enabled: boolean;
  getVideo?: () => HTMLVideoElement | null;
  config?: Partial<ProctorConfig>;
}

/**
 * React wrapper over the ProctoringEngine. Starts every browser-side detector
 * when enabled, exposes the live fraud score / risk / last warning for the HUD,
 * and tears everything down on unmount.
 */
export function useProctoring({ token, enabled, getVideo, config }: Options) {
  const [state, setState] = useState<ProctorUpdate>({ fraudScore: 0, riskLevel: 'safe', counts: {}, people: 1, noise: 0 });
  const engineRef = useRef<ProctoringEngine | null>(null);
  const getVideoRef = useRef(getVideo);
  getVideoRef.current = getVideo;

  useEffect(() => {
    if (!enabled || !token) return;
    const engine = new ProctoringEngine({
      token,
      getVideo: () => getVideoRef.current?.() ?? null,
      config,
      onUpdate: (u) => setState(u),
    });
    engineRef.current = engine;
    void engine.start();
    return () => {
      void engine.stop();
      engineRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token]);

  const violations = Object.values(state.counts).reduce((a, b) => a + b, 0);
  return { ...state, violations };
}

export default useProctoring;
