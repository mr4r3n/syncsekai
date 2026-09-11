'use client';

import { LegalDocument } from '@/components/LegalDocument';
import { PRIVACY } from '@/content/legal/privacy';
import { useI18n } from '@/i18n/I18nProvider';

export default function PrivacyPage() {
  const { t, locale } = useI18n();
  return (
    <LegalDocument
      documento={PRIVACY[locale === 'es' ? 'es' : 'en']}
      otro={{ href: '/terms', label: t('legal.termsTitle') }}
    />
  );
}
