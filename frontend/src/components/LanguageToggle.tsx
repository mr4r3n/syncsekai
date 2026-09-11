'use client';

import { Globe } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n();

  const toggleLanguage = () => {
    const next = locale === 'es' ? 'en' : 'es';
    setLocale(next);
  };

  const currentLabel = locale === 'es' ? 'Español' : 'English';
  const nextLabel = locale === 'es' ? 'English' : 'Español';

  return (
    <button
      onClick={toggleLanguage}
      type="button"
      aria-label={`${t('language.switchLanguage')} (${nextLabel})`}
      title={`${t('language.switchLanguage')}: ${nextLabel}`}
      className="h-9 px-2.5 rounded-[6px] flex items-center gap-1.5 transition-all duration-200 border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] active:scale-[0.96] text-[var(--text-primary)] shadow-sm cursor-pointer select-none"
    >
      <Globe className="w-3.5 h-3.5 text-[var(--accent-primary)] shrink-0 transition-transform duration-300 hover:rotate-12" aria-hidden="true" />
      <span className="font-mono text-[11px] font-bold tracking-wider uppercase text-[var(--text-primary)]">
        {locale}
      </span>
    </button>
  );
}
