'use client';

import { useEffect, useRef, useState } from 'react';

type EventType =
  | 'tab_switch'
  | 'window_blur'
  | 'fullscreen_exit'
  | 'copy'
  | 'paste'
  | 'right_click'
  | 'face_missing'
  | 'multiple_faces';

type Severity = 'low' | 'medium' | 'high';

interface Options {
  enabled: boolean;
  onEvent: (type: EventType, severity: Severity) => void;
}

/**
 * Wires DOM-level proctoring: tab switches, window blur, copy/paste, right-click
 * suppression, and fullscreen-exit detection. Reports each via `onEvent` and
 * tracks a local violation count for the UI.
 */
export function useAntiCheat({ enabled, onEvent }: Options) {
  const [violations, setViolations] = useState(0);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;

    const report = (type: EventType, severity: Severity) => {
      setViolations((v) => v + 1);
      onEventRef.current(type, severity);
    };

    const onVisibility = () => {
      if (document.hidden) report('tab_switch', 'medium');
    };
    const onBlur = () => report('window_blur', 'low');
    const onCopy = () => report('copy', 'medium');
    const onPaste = (e: Event) => {
      e.preventDefault();
      report('paste', 'high');
    };
    const onContextMenu = (e: Event) => {
      e.preventDefault();
      report('right_click', 'low');
    };
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) report('fullscreen_exit', 'medium');
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    document.addEventListener('copy', onCopy);
    document.addEventListener('paste', onPaste);
    document.addEventListener('contextmenu', onContextMenu);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('paste', onPaste);
      document.removeEventListener('contextmenu', onContextMenu);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, [enabled]);

  return { violations };
}

/** Request fullscreen on the document element (best-effort). */
export async function enterFullscreen() {
  try {
    await document.documentElement.requestFullscreen();
  } catch {
    /* user may decline */
  }
}

export default useAntiCheat;
