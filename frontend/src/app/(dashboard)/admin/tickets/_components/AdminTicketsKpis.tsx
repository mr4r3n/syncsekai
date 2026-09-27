import React from 'react';
import { AlertCircle, MessageSquare, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { TicketStats } from './types';

interface AdminTicketsKpisProps {
  stats: TicketStats | null;
}

export function AdminTicketsKpis({ stats }: AdminTicketsKpisProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] font-medium">{t('admin.pendingStaff')}</span>
          <div className="w-7 h-7 rounded-[4px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
            <AlertCircle className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold font-heading text-[var(--text-primary)]">
          {stats?.pendingStaff ?? 0}
        </p>
        <span className="text-[11px] text-[var(--text-muted)]">
          {stats?.open ?? 0} abiertos • {stats?.inProgress ?? 0} en curso
        </span>
      </div>

      <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] font-medium">{t('admin.waitingUser')}</span>
          <div className="w-7 h-7 rounded-[4px] bg-sky-500/15 text-sky-400 flex items-center justify-center">
            <MessageSquare className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold font-heading text-[var(--text-primary)]">
          {stats?.waitingUser ?? 0}
        </p>
        <span className="text-[11px] text-[var(--text-muted)]">{t('admin.replySentLabel')}</span>
      </div>

      <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] font-medium">{t('admin.criticalUrgent')}</span>
          <div className="w-7 h-7 rounded-[4px] bg-rose-500/15 text-rose-400 flex items-center justify-center">
            <ShieldAlert className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold font-heading text-rose-400">
          {stats?.urgent ?? 0}
        </p>
        <span className="text-[11px] text-[var(--text-muted)]">{t('admin.maxPriorityActive')}</span>
      </div>

      <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
        <div className="flex items-center justify-between">
          <span className="text-xs text-[var(--text-muted)] font-medium">Resueltos Hoy</span>
          <div className="w-7 h-7 rounded-[4px] bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
        <p className="text-2xl font-bold font-heading text-[var(--text-primary)]">
          {stats?.todayResolved ?? 0}
        </p>
        <span className="text-[11px] text-[var(--text-muted)]">
          {stats?.resolved ?? 0} resueltos histórico
        </span>
      </div>
    </div>
  );
}
