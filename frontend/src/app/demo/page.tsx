'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { enterDemo } from '@/lib/demo';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

/** Turns the demo on for this tab and opens the panel (see lib/demo.ts). */
export default function DemoPage() {
  const router = useRouter();
  const { t } = useI18n();

  useEffect(() => {
    // Sent before the demo turns on (after that, requests stay in the browser), so
    // visits to the demo are counted like any other.
    api.setup.getMaintenanceStatus().catch(() => {});
    enterDemo();
    router.replace('/catalog');
  }, [router]);

  return (
    <div role="status" className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center space-y-3">
      <div className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin" />
      <p className="text-xs font-mono text-[var(--text-muted)]">{t('demo.loading')}</p>
    </div>
  );
}
