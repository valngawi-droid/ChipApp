import React, { createContext, useContext, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { Colors, ColorScheme, getColors, layout, radius, spacing, springs, typography } from './index';

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
}

const ThemeContext = createContext<ThemeValue | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreference] = useState<ThemePreference>('system');

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
    }),
    [scheme, preference]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = (): ThemeValue => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside <ThemeProvider>');
  return ctx;
};
