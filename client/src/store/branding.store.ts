'use client';

import { create } from 'zustand';
import { contentApi } from '@/lib/content.api';

export interface Branding {
  platformName: string;
  tagline?: string;
  logoUrl?: string;
  logoDarkUrl?: string;
  faviconUrl?: string;
  footerText?: string;
  theme?: { primary?: string; accent?: string; font?: string; defaultMode?: 'dark' | 'light' };
  login?: { headline?: string; subtext?: string; imageUrl?: string };
  social?: Record<string, string | undefined>;
  contact?: { email?: string; phone?: string; address?: string };
  announcement?: { enabled?: boolean; text?: string; type?: 'info' | 'success' | 'warning'; link?: string };
  seo?: { title?: string; description?: string; keywords?: string[]; ogImage?: string };
  customCss?: string;
}

interface BrandingState {
  branding: Branding | null;
  loaded: boolean;
  load: () => Promise<void>;
}

/** Convert #rrggbb to an "h s% l%" triple for CSS custom properties. */
export function hexToHslTriple(hex?: string): string | null {
  if (!hex) return null;
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  if (h.length !== 6) return null;
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let hue = 0;
  let sat = 0;
  const lum = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    sat = lum > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) hue = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) hue = (b - r) / d + 2;
    else hue = (r - g) / d + 4;
    hue /= 6;
  }
  return `${Math.round(hue * 360)} ${Math.round(sat * 100)}% ${Math.round(lum * 100)}%`;
}

/** Apply branding to the live document (CSS vars, favicon, custom CSS, title). */
export function applyBranding(b: Branding) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const p = hexToHslTriple(b.theme?.primary);
  const a = hexToHslTriple(b.theme?.accent);
  if (p) { root.style.setProperty('--primary', p); root.style.setProperty('--ring', p); }
  if (a) root.style.setProperty('--accent', a);

  if (b.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = b.faviconUrl;
  }
  if (b.platformName) document.title = b.platformName;

  let style = document.getElementById('brand-custom-css') as HTMLStyleElement | null;
  if (b.customCss) {
    if (!style) { style = document.createElement('style'); style.id = 'brand-custom-css'; document.head.appendChild(style); }
    style.textContent = b.customCss;
  } else if (style) {
    style.remove();
  }
}

export const useBranding = create<BrandingState>((set) => ({
  branding: null,
  loaded: false,
  load: async () => {
    try {
      const b = await contentApi.branding();
      applyBranding(b);
      set({ branding: b, loaded: true });
    } catch {
      set({ loaded: true });
    }
  },
}));
