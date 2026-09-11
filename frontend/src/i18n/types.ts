export type Locale = 'es' | 'en';

export interface I18nContextType {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}

export type TranslationDictionary = Record<string, any>;
