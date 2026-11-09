import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { DarkColors, LightColors, type AppPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { readPreference, writePreference } from '@/services/preferences';

/** "system" follows the phone's light/dark setting. */
export type ThemeMode = 'system' | 'light' | 'dark';

const THEME_KEY = 'westminster.theme';

interface ThemeContextValue {
  colors: AppPalette;
  scheme: 'light' | 'dark';
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function AppThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    void readPreference(THEME_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark' || saved === 'system') setModeState(saved);
    });
  }, []);

  const scheme: 'light' | 'dark' = mode === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : mode;

  const value = useMemo<ThemeContextValue>(
    () => ({
      colors: scheme === 'dark' ? DarkColors : LightColors,
      scheme,
      mode,
      setMode: (next) => {
        setModeState(next);
        void writePreference(THEME_KEY, next);
      },
    }),
    [scheme, mode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used inside AppThemeProvider');
  }
  return context;
}

/** Styles built from the current palette, rebuilt only when the theme changes. */
export function useThemedStyles<T>(createStyles: (colors: AppPalette) => T): T {
  const { colors } = useTheme();
  return useMemo(() => createStyles(colors), [colors, createStyles]);
}
