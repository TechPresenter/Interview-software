'use client';

import { useEffect, useRef } from 'react';

const CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const SRC = 'https://accounts.google.com/gsi/client';

/**
 * "Sign in with Google" button using Google Identity Services. On success it
 * hands the ID-token `credential` to onCredential, which the caller exchanges
 * with our backend (`POST /auth/google`). Renders nothing if the client id is
 * not configured.
 */
export function GoogleButton({ onCredential }: { onCredential: (credential: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cbRef = useRef(onCredential);
  cbRef.current = onCredential;

  useEffect(() => {
    if (!CLIENT_ID) return;

    const init = () => {
      const g = (window as any).google;
      if (!g?.accounts?.id || !ref.current) return;
      g.accounts.id.initialize({
        client_id: CLIENT_ID,
        callback: (resp: any) => resp?.credential && cbRef.current(resp.credential),
      });
      g.accounts.id.renderButton(ref.current, {
        theme: 'filled_black',
        size: 'large',
        shape: 'pill',
        width: 320,
        text: 'continue_with',
      });
    };

    if ((window as any).google?.accounts?.id) {
      init();
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SRC}"]`);
    const script = existing || Object.assign(document.createElement('script'), { src: SRC, async: true, defer: true });
    script.addEventListener('load', init);
    if (!existing) document.head.appendChild(script);
    return () => script.removeEventListener('load', init);
  }, []);

  if (!CLIENT_ID) return null;

  return (
    <div className="mt-4">
      <div className="mb-4 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
      </div>
      <div ref={ref} className="flex justify-center" />
    </div>
  );
}

export default GoogleButton;
