'use client';

import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import type { Locale, I18nContextType, TranslationDictionary } from './types';
import esDict from './locales/es.json';
import enDict from './locales/en.json';
import { elegirFormaPlural } from './plural';

const dictionaries: Record<Locale, TranslationDictionary> = {
  es: esDict,
  en: enDict,
};

const I18nContext = createContext<I18nContextType>({
  locale: 'en',
  setLocale: () => {},
  t: (key: string) => key,
});

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const keys = path.split('.');
  let current = obj;
  for (const k of keys) {
    if (current && typeof current === 'object' && k in current) {
      current = current[k];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

/**
 * El idioma por defecto es el inglés, y no se adivina por el navegador: sólo
 * cambia cuando el usuario lo elige con el conmutador.
 */
export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>('en');

  const syncLocale = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem('plexsync_locale') as Locale | null;
      if (saved && (saved === 'es' || saved === 'en')) {
        setLocaleState(saved);
        document.documentElement.lang = saved;
        return;
      }

      // Comprobar cookie
      const match = document.cookie.match(/(?:^|;\s*)plexsync_locale=([a-zA-Z-]+)/);
      if (match && (match[1] === 'es' || match[1] === 'en')) {
        const cookieLocale = match[1] as Locale;
        setLocaleState(cookieLocale);
        localStorage.setItem('plexsync_locale', cookieLocale);
        document.documentElement.lang = cookieLocale;
        return;
      }

      document.documentElement.lang = 'en';
    } catch {
      // Sin almacenamiento disponible se queda en inglés, que ya es el estado inicial.
    }
  }, []);

  useEffect(() => {
    syncLocale();

    const handleSync = () => syncLocale();
    window.addEventListener('storage', handleSync);
    window.addEventListener('plexsync_locale_changed', handleSync);

    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('plexsync_locale_changed', handleSync);
    };
  }, [syncLocale]);

  const setLocale = useCallback((newLocale: Locale) => {
    setLocaleState(newLocale);
    try {
      localStorage.setItem('plexsync_locale', newLocale);
      document.cookie = `plexsync_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
      document.documentElement.lang = newLocale;
      window.dispatchEvent(new Event('plexsync_locale_changed'));
    } catch {
      // Fallback
    }
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      // 1. Buscar en diccionario activo
      let val = getNestedValue(dictionaries[locale], key);

      // 2. Fallback a español si falta en el idioma activo
      if (!val && locale !== 'es') {
        val = getNestedValue(dictionaries.es, key);
      }

      // 3. Si aún no existe, devolver la clave
      if (!val) return key;

      // 3.5. Elegir singular o plural antes de meter las variables.
      val = elegirFormaPlural(val, vars?.n);

      // 4. Reemplazar variables si existen
      if (vars && typeof vars === 'object') {
        for (const [vKey, vVal] of Object.entries(vars)) {
          val = val.replace(new RegExp(`\\{${vKey}\\}`, 'g'), String(vVal));
        }
      }

      return val;
    },
    [locale]
  );

  const contextValue = useMemo(
    () => ({
      locale,
      setLocale,
      t,
    }),
    [locale, setLocale, t]
  );

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
