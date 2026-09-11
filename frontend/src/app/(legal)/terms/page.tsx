'use client';

import { LegalDocument } from '@/components/LegalDocument';
import { TERMS } from '@/content/legal/terms';
import { useI18n } from '@/i18n/I18nProvider';

export default function TermsPage() {
  const { t, locale } = useI18n();
  return (
    <LegalDocument
      documento={TERMS[locale === 'es' ? 'es' : 'en']}
      otro={{ href: '/privacy', label: t('legal.privacyTitle') }}
    />
  );
}
