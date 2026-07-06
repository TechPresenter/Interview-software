'use client';

import { useState } from 'react';
import { Check, Copy } from 'lucide-react';

/** Code block with a copy-to-clipboard button. */
export function CodeBlock({ children, label = 'code' }: { children: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  };

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-[hsl(240_14%_6%)] text-[13px]">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2">
        <span className="font-mono text-xs text-white/50">{label}</span>
        <button
          type="button"
          onClick={copy}
          className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs text-white/60 transition hover:bg-white/10 hover:text-white focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Copy code"
        >
          {copied ? (
            <><Check className="h-3.5 w-3.5 text-emerald-400" /> Copied</>
          ) : (
            <><Copy className="h-3.5 w-3.5" /> Copy</>
          )}
        </button>
      </div>
      <pre className="overflow-x-auto p-4 text-white/90"><code>{children}</code></pre>
    </div>
  );
}

export default CodeBlock;
