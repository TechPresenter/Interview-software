import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/** Merge Tailwind classes with conflict resolution. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a number compactly (e.g. 12.3k). */
export function formatCompact(n: number) {
  return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
}

/** Fetch a (same-origin or CORS-enabled) URL and trigger a browser download. */
export async function downloadFile(url: string, filename: string) {
  // Lazily imported so server components using `cn` never pull in the tracker.
  import('./track').then((m) => m.trackFeature('download', { filename })).catch(() => {});
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const objUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = objUrl;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(objUrl);
  } catch {
    window.open(url, '_blank'); // fallback: open in a new tab
  }
}
