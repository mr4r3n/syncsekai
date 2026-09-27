'use client';

import React from 'react';
import { LifeBuoy, Plus } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface TicketsPageHeaderProps {
  setIsCreateModalOpen: (val: boolean) => void;
}

export function TicketsPageHeader({ setIsCreateModalOpen }: TicketsPageHeaderProps) {
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
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                  {t('tickets.title')}
                </h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('tickets.subtitle')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t('tickets.newTicket')}</span>
            </button>
          </div>
        </div>
      </div>
  );
}
