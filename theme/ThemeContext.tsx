import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { getStoredTheme, setStoredTheme } from '../app/services/appFlags';

export type ThemeMode = 'dark' | 'light';

type ThemeValue = { mode: ThemeMode; isDark: boolean; setMode: (mode: ThemeMode) => void; toggle: () => void };

export const ThemeContext = createContext<ThemeValue>({ mode: 'dark', isDark: true, setMode: () => undefined, toggle: () => undefined });

/**
 * True inside a part of the app that must look exactly as drawn (the opening animation, the welcome
 * tour, the light/dark switch itself, or anything sitting on a strong colour), whatever the theme is.
 */
export const KeepAsDrawnContext = createContext(false);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('dark');

  useEffect(() => {
    let active = true;
    getStoredTheme().then((saved) => { if (active && saved) setModeState(saved); });
    return () => { active = false; };
  }, []);

  const setMode = useCallback((next: ThemeMode) => {
    setModeState(next);
    setStoredTheme(next);
  }, []);
  const toggle = useCallback(() => setMode(mode === 'dark' ? 'light' : 'dark'), [mode, setMode]);

  const value = useMemo(() => ({ mode, isDark: mode === 'dark', setMode, toggle }), [mode, setMode, toggle]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export const useTheme = () => useContext(ThemeContext);

/** Inside a KeepAsDrawn area, wrap the part that should follow the theme again (a light dropdown on a dark bar). */
export function ThemeAgain({ children }: { children: React.ReactNode }) {
  return <KeepAsDrawnContext.Provider value={false}>{children}</KeepAsDrawnContext.Provider>;
}

/** Wrap something that should never change with the theme. */
export function KeepAsDrawn({ children }: { children: React.ReactNode }) {
  return <KeepAsDrawnContext.Provider value>{children}</KeepAsDrawnContext.Provider>;
}
