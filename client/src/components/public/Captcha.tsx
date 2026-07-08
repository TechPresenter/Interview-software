'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';

/**
 * Configurable CAPTCHA widget. Supports Google reCAPTCHA v2 (checkbox), v3
 * (invisible/score), and hCaptcha — driven by the public config from the API.
 * Exposes an imperative `getToken()` the form awaits on submit.
 */

export type CaptchaProvider = 'none' | 'recaptcha_v2' | 'recaptcha_v3' | 'hcaptcha';
export interface CaptchaHandle {
  getToken: () => Promise<string>;
  reset: () => void;
}

const scriptCache: Record<string, Promise<void> | undefined> = {};
function loadScript(src: string, id: string): Promise<void> {
  const existing = scriptCache[id];
  if (existing) return existing;
  const p = new Promise<void>((resolve, reject) => {
    if (document.getElementById(id)) return resolve();
    const s = document.createElement('script');
    s.id = id;
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('captcha script failed to load'));
    document.head.appendChild(s);
  });
  scriptCache[id] = p;
  return p;
}

/** Poll until `fn()` is truthy (or timeout). */
function waitFor(fn: () => any, timeout = 8000, step = 100) {
  return new Promise<void>((resolve, reject) => {
    const start = Date.now();
    const tick = () => {
      if (fn()) return resolve();
      if (Date.now() - start > timeout) return reject(new Error('captcha timeout'));
      setTimeout(tick, step);
    };
    tick();
  });
}

export const Captcha = forwardRef<CaptchaHandle, {
  provider: CaptchaProvider;
  siteKey: string;
  onSolvedChange?: (solved: boolean) => void;
}>(function Captcha({ provider, siteKey, onSolvedChange }, ref) {
  const boxRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<number | null>(null);
  const tokenRef = useRef<string>('');
  const cbRef = useRef(onSolvedChange);
  cbRef.current = onSolvedChange;
  const [, setReady] = useState(false);

  useImperativeHandle(ref, () => ({
    getToken: async () => {
      if (provider === 'recaptcha_v3') {
        const g = (window as any).grecaptcha;
        if (!g?.execute) return '';
        return new Promise<string>((resolve) => {
          g.ready(() => g.execute(siteKey, { action: 'submit' }).then(resolve).catch(() => resolve('')));
        });
      }
      return tokenRef.current;
    },
    reset: () => {
      tokenRef.current = '';
      cbRef.current?.(false);
      const w = window as any;
      if (provider === 'recaptcha_v2' && widgetId.current != null) w.grecaptcha?.reset(widgetId.current);
      if (provider === 'hcaptcha' && widgetId.current != null) w.hcaptcha?.reset(widgetId.current);
    },
  }), [provider, siteKey]);

  useEffect(() => {
    if (!siteKey || provider === 'none') return;
    let cancelled = false;
    const w = window as any;

    (async () => {
      try {
        if (provider === 'recaptcha_v3') {
          await loadScript(`https://www.google.com/recaptcha/api.js?render=${siteKey}`, 'ck-recaptcha-v3');
          setReady(true);
        } else if (provider === 'recaptcha_v2') {
          await loadScript('https://www.google.com/recaptcha/api.js?render=explicit', 'ck-recaptcha-v2');
          await waitFor(() => w.grecaptcha?.render);
          if (cancelled || !boxRef.current || widgetId.current != null) return;
          widgetId.current = w.grecaptcha.render(boxRef.current, {
            sitekey: siteKey,
            callback: (t: string) => { tokenRef.current = t; cbRef.current?.(true); },
            'expired-callback': () => { tokenRef.current = ''; cbRef.current?.(false); },
            'error-callback': () => { tokenRef.current = ''; cbRef.current?.(false); },
          });
          setReady(true);
        } else if (provider === 'hcaptcha') {
          await loadScript('https://js.hcaptcha.com/1/api.js?render=explicit', 'ck-hcaptcha');
          await waitFor(() => w.hcaptcha?.render);
          if (cancelled || !boxRef.current || widgetId.current != null) return;
          widgetId.current = w.hcaptcha.render(boxRef.current, {
            sitekey: siteKey,
            callback: (t: string) => { tokenRef.current = t; cbRef.current?.(true); },
            'expired-callback': () => { tokenRef.current = ''; cbRef.current?.(false); },
            'error-callback': () => { tokenRef.current = ''; cbRef.current?.(false); },
          });
          setReady(true);
        }
      } catch {
        /* script blocked/failed — the form still submits; server enforces if required */
      }
    })();

    return () => { cancelled = true; };
  }, [provider, siteKey]);

  if (provider === 'none' || !siteKey) return null;
  if (provider === 'recaptcha_v3') {
    return (
      <p className="text-[11px] text-muted-foreground">
        Protected by reCAPTCHA — Google{' '}
        <a href="https://policies.google.com/privacy" className="underline" target="_blank" rel="noreferrer">Privacy</a> &{' '}
        <a href="https://policies.google.com/terms" className="underline" target="_blank" rel="noreferrer">Terms</a>.
      </p>
    );
  }
  return <div ref={boxRef} className="min-h-[78px]" />;
});

export default Captcha;
