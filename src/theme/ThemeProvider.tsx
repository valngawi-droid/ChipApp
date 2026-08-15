import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, ColorScheme, getColors, layout, radius, spacing, springs, typography } from './index';
import { STORAGE_KEYS, storage } from '../storage';

export type ThemePreference = 'system' | 'light' | 'dark';

interface ThemeValue {
  scheme: ColorScheme;
  preference: ThemePreference;
  colors: Colors;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  springs: typeof springs;
  layout: typeof layout;
  setPreference: (p: ThemePreference) => void;
  toggle: () => void;
  ready: boolean;
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [ready, setReady] = useState(false);

  // Hydrate the saved preference once on launch.
  useEffect(() => {
    let active = true;
    storage.getString(STORAGE_KEYS.theme).then((saved) => {
      if (!active) return;
      if (saved === 'system' || saved === 'light' || saved === 'dark') {
        setPreferenceState(saved);
      }
      setReady(true);
    });
    return () => {
      active = false;
    };
  }, []);

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    void storage.setString(STORAGE_KEYS.theme, next);
  };

  // "system" means the app follows the device light/dark setting. When the
  // device reports no scheme we fall back to light.
  const scheme: ColorScheme =
    preference === 'system' ? ((systemScheme as ColorScheme) ?? 'light') : preference;

  const value = useMemo<ThemeValue>(
    () => ({
      scheme,
      preference,
      colors: getColors(scheme),
      typography,
      spacing,
      radius,
      springs,
      layout,
      setPreference,
      toggle: () => setPreference(scheme === 'dark' ? 'light' : 'dark'),
      ready,
    }),
    [scheme, preference, ready]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};
