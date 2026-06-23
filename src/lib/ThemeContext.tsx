'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

export type ThemeId = 'blue' | 'purple' | 'pink' | 'emerald' | 'rose' | 'midnight';

export interface ThemeInfo {
  id: ThemeId;
  label: string;
  /** CSS gradient representing this theme's color palette */
  swatch: string;
}

export const THEMES: ThemeInfo[] = [
  {
    id: 'blue',
    label: 'Blue',
    swatch: 'linear-gradient(135deg, #2563eb 0%, #030712 60%, #1f2937 100%)',
  },
  {
    id: 'purple',
    label: 'Purple',
    swatch: 'linear-gradient(135deg, #7c3aed 0%, #0c0718 60%, #231b33 100%)',
  },
  {
    id: 'pink',
    label: 'Pink',
    swatch: 'linear-gradient(135deg, #ec4899 0%, #1a0814 60%, #331a28 100%)',
  },
  {
    id: 'emerald',
    label: 'Emerald',
    swatch: 'linear-gradient(135deg, #059669 0%, #05140d 60%, #152e23 100%)',
  },
  {
    id: 'rose',
    label: 'Rose',
    swatch: 'linear-gradient(135deg, #e11d48 0%, #18080a 60%, #331b1e 100%)',
  },
  {
    id: 'midnight',
    label: 'Midnight',
    swatch: 'linear-gradient(135deg, #0891b2 0%, #050e18 60%, #152433 100%)',
  },
];

const STORAGE_KEY = 'dub-studio-theme';

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  themes: ThemeInfo[];
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'blue',
  setTheme: () => {},
  themes: THEMES,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>('blue');
  const [mounted, setMounted] = useState(false);

  // On mount, read stored theme
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored && THEMES.some((t) => t.id === stored)) {
        setThemeState(stored as ThemeId);
      }
    } catch {
      // localStorage not available
    }
    setMounted(true);
  }, []);

  // Apply theme to <html> whenever it changes
  useEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // localStorage not available
    }
  }, [theme, mounted]);

  const setTheme = useCallback((newTheme: ThemeId) => {
    setThemeState(newTheme);
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextType {
  return useContext(ThemeContext);
}
