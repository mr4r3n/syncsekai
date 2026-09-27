'use client';

import React from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2, HelpCircle, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface TicketsStatsCardsProps {
  activeTicketsCount: number;
  totalCount: number;
}

export function TicketsStatsCards({
  activeTicketsCount,
  totalCount,
}: TicketsStatsCardsProps) {
  const { t } = useI18n();

  return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-[6px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('tickets.activeTickets')}</span>
              <p className="text-lg font-bold font-heading text-[var(--text-primary)] mt-0.5">
                {activeTicketsCount}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-[6px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('tickets.totalRegistered')}</span>
              <p className="text-lg font-bold font-heading text-[var(--text-primary)] mt-0.5">
                {totalCount}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('tickets.officialDocs')}</span>
              <Link
                href="/docs"
                className="text-xs font-semibold text-[var(--color-brand-primary)] hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>{t('tickets.viewGuide')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
  );
}
