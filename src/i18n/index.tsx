import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { I18nManager } from 'react-native';
import * as Localization from 'expo-localization';

import en from '../../assets/loc/en.json';
import id from '../../assets/loc/id.json';
import es from '../../assets/loc/es.json';
import fr from '../../assets/loc/fr.json';
import de from '../../assets/loc/de.json';
import ar from '../../assets/loc/ar.json';
import ja from '../../assets/loc/ja.json';
import zh from '../../assets/loc/zh.json';
import pt from '../../assets/loc/pt.json';
import ru from '../../assets/loc/ru.json';

export type LocaleCode = 'en' | 'id' | 'es' | 'fr' | 'de' | 'ar' | 'ja' | 'zh' | 'pt' | 'ru';

type Dictionary = typeof en;
export type TranslationKey = Exclude<keyof Dictionary, '_meta'>;

export const translations: Record<LocaleCode, Dictionary> = {
  en,
  id,
  es,
  fr,
  de,
  ar: ar as unknown as Dictionary,
  ja: ja as unknown as Dictionary,
  zh: zh as unknown as Dictionary,
  pt: pt as unknown as Dictionary,
  ru: ru as unknown as Dictionary,
};

/**
 * Fallback locale when the device language is not one ChipApp ships.
 * ChipApp is an Indonesia-first product, so Bahasa Indonesia is the default.
 */
export const DEFAULT_LOCALE: LocaleCode = 'id';

// Bahasa Indonesia leads the picker; the rest follow by rough user count.
export const LOCALE_ORDER: LocaleCode[] = ['id', 'en', 'es', 'fr', 'de', 'pt', 'ru', 'ar', 'ja', 'zh'];

export interface LanguageDescriptor {
  code: LocaleCode;
  name: string;
  nativeName: string;
  flag: string;
  rtl: boolean;
}

export const SUPPORTED_LANGUAGES: LanguageDescriptor[] = LOCALE_ORDER.map((code) => ({
  code,
  ...translations[code]._meta,
}));

export const isRTL = (locale: LocaleCode) => translations[locale]._meta.rtl;

interface LocalizationValue {
  locale: LocaleCode;
  /** True when the user explicitly picked a language instead of following the device. */
  isManual: boolean;
  rtl: boolean;
  languages: LanguageDescriptor[];
  setLocale: (locale: LocaleCode) => void;
  /** Revert to automatic device-locale detection. */
  useSystemLocale: () => void;
  t: (key: TranslationKey | string, fallback?: string) => string;
}

const LocalizationContext = createContext<LocalizationValue | undefined>(undefined);

/** Resolve the best supported locale for the current device. */
export const detectDeviceLocale = (): LocaleCode => {
  try {
    const deviceLocales = Localization.getLocales();
    for (const entry of deviceLocales ?? []) {
      const code = entry.languageCode as LocaleCode | null;
      if (code && translations[code]) return code;
    }
  } catch {
    // Localization is unavailable in some sandboxed web contexts — fall through.
  }
  return DEFAULT_LOCALE;
};

interface ProviderProps {
  children: React.ReactNode;
  /**
   * Start from the device language instead of ChipApp's Indonesian default.
   * Users can always switch to "Bawaan Sistem" from the language picker.
   */
  followDeviceLocale?: boolean;
}

export const I18nProvider: React.FC<ProviderProps> = ({ children, followDeviceLocale = false }) => {
  const [locale, setLocaleState] = useState<LocaleCode>(DEFAULT_LOCALE);
  // ChipApp ships Indonesian-first, so the app does NOT silently follow the
  // device language on launch. `isManual` starts true to lock in the default;
  // the user opts into device detection via the language picker.
  const [isManual, setIsManual] = useState(!followDeviceLocale);

  useEffect(() => {
    if (isManual) return;
    setLocaleState(detectDeviceLocale());
  }, [isManual]);

  const applyDirection = useCallback((next: LocaleCode) => {
    const shouldBeRTL = isRTL(next);
    // On native this requires a reload to fully mirror the layout; we still flip
    // the flag so freshly mounted views honour the direction. The UI itself uses
    // logical (start/end) styles so most mirroring happens immediately.
    if (I18nManager.isRTL !== shouldBeRTL && I18nManager.allowRTL) {
      I18nManager.allowRTL(shouldBeRTL);
      I18nManager.forceRTL(shouldBeRTL);
    }
  }, []);

  const setLocale = useCallback(
    (next: LocaleCode) => {
      setIsManual(true);
      setLocaleState(next);
      applyDirection(next);
    },
    [applyDirection]
  );

  const useSystemLocale = useCallback(() => {
    setIsManual(false);
    const detected = detectDeviceLocale();
    setLocaleState(detected);
    applyDirection(detected);
  }, [applyDirection]);

  const t = useCallback(
    (key: TranslationKey | string, fallback?: string) => {
      const dict = translations[locale] as unknown as Record<string, string>;
      const base = translations[DEFAULT_LOCALE] as unknown as Record<string, string>;
      const en = translations.en as unknown as Record<string, string>;
      return dict?.[key] ?? base?.[key] ?? en?.[key] ?? fallback ?? key;
    },
    [locale]
  );

  const value = useMemo<LocalizationValue>(
    () => ({
      locale,
      isManual,
      rtl: isRTL(locale),
      languages: SUPPORTED_LANGUAGES,
      setLocale,
      useSystemLocale,
      t,
    }),
    [locale, isManual, setLocale, useSystemLocale, t]
  );

  return <LocalizationContext.Provider value={value}>{children}</LocalizationContext.Provider>;
};

export const useLocalization = (): LocalizationValue => {
  const ctx = useContext(LocalizationContext);
  if (!ctx) throw new Error('useLocalization must be used inside <I18nProvider>');
  return ctx;
};
