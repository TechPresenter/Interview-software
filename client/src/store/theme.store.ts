'use client';

import { create } from 'zustand';

export type Theme = 'dark' | 'light';

interface ThemeState {
  theme: Theme;
  toggle: () => void;
  setTheme: (t: Theme) => void;
  init: () => void;
}

/** Apply the theme class + color-scheme to <html> (drives all CSS variables). */
function apply(theme: Theme) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.classList.toggle('dark', theme === 'dark');
  root.classList.toggle('light', theme === 'light');
  root.style.colorScheme = theme;
}

/** Read the persisted/preferred theme (defaults to dark — the primary mode). */
function preferred(): Theme {
  if (typeof window === 'undefined') return 'dark';
  const saved = localStorage.getItem('theme') as Theme | null;
  return saved === 'light' || saved === 'dark' ? saved : 'dark';
}

export const useTheme = create<ThemeState>((set, get) => ({
  theme: 'dark',
  init: () => {
    const t = preferred();
    apply(t);
    set({ theme: t });
  },
  setTheme: (t) => {
    localStorage.setItem('theme', t);
    apply(t);
    set({ theme: t });
  },
  toggle: () => {
    const t: Theme = get().theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', t);
    apply(t);
    set({ theme: t });
  },
}));
