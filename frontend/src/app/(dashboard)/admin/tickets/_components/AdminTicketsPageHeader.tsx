import React from 'react';
import { LifeBuoy, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminTicketsPageHeaderProps {
  handleRefresh: () => void;
  isRefreshing: boolean;
}

export function AdminTicketsPageHeader({
  handleRefresh,
  isRefreshing,
}: AdminTicketsPageHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <LifeBuoy className="w-4 h-4 text-[#FF634A]" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.ticketsTitle')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.ticketsSubtitle')}</p>
          </div>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t('admin.refreshAction')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
