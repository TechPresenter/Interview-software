'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RotateCcw, Home } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/** Global error boundary for the app router. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Surface the error for observability tooling.
    console.error(error);
  }, [error]);

  return (
    <main className="relative grid min-h-screen place-items-center overflow-hidden px-6">
      <div className="pointer-events-none absolute inset-0 -z-10 mesh-bg opacity-50" />
      <div className="max-w-md text-center">
        <span className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </span>
        <h1 className="text-2xl font-bold md:text-3xl">Something went wrong</h1>
        <p className="mx-auto mt-3 text-muted-foreground">
          An unexpected error occurred. You can try again, or head back home while we look into it.
        </p>
        {error?.digest && (
          <p className="mt-3 font-mono text-xs text-muted-foreground/70">Ref: {error.digest}</p>
        )}
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button size="lg" onClick={reset}><RotateCcw className="h-5 w-5" /> Try again</Button>
          <Link href="/"><Button size="lg" variant="glass" magnetic={false}><Home className="h-5 w-5" /> Back home</Button></Link>
        </div>
      </div>
    </main>
  );
}
