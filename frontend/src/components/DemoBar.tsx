'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, X } from 'lucide-react';
import { exitDemo } from '@/lib/demo';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Floating notice while the demo is on: it does not move anything on the page.
 * Below the cookie banner (z-50), which it would otherwise cover on phones.
 */
export function DemoBar() {
  const { t } = useI18n();
  const router = useRouter();

  const leave = (to: string) => {
    exitDemo();
    router.push(to);
  };

  return (
    <div
      role="status"
      data-demo-bar
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 sm:gap-3 pl-3 pr-1.5 py-1.5 rounded-full border border-[var(--glass-border)] bg-[var(--popover-solid,var(--bg-surface))] shadow-lg text-xs max-w-[calc(100vw-2rem)]"
    >
      <Eye className="w-3.5 h-3.5 text-[var(--accent-text)] shrink-0" aria-hidden="true" />
      <span className="font-semibold text-[var(--text-primary)] truncate">{t('demo.mode')}
        <span className="hidden sm:inline font-normal text-[var(--text-muted)]"> · {t('demo.sampleData')}</span>
      </span>
      <Link
        href="/register"
        onClick={(e) => {
          e.preventDefault();
          leave('/register');
        }}
        className="btn-primary !h-7 !px-3 !text-xs rounded-full shrink-0"
      >
        {t('demo.createAccount')}
      </Link>
      <button
        type="button"
        onClick={() => leave('/')}
        className="p-1.5 rounded-full text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] shrink-0"
        aria-label={t('demo.exit')}
        title={t('demo.exit')}
      >
        <X className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
