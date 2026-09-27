import React from 'react';
import { Archive, HardDrive, Calendar } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupsStatsProps {
  totalBackups: number;
  storageUsed: string;
  schedule: any;
}

export function AdminBackupsStats({
  totalBackups,
  storageUsed,
  schedule,
}: AdminBackupsStatsProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
      <div className="p-5 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
          <span>{t('backups.availableCopies')}</span>
          <Archive className="w-4 h-4 text-[var(--accent-text)]" />
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text-primary)]">
          {totalBackups}
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">{t('backups.filesStoredOnDisk')}</p>
      </div>

      <div className="p-5 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
          <span>{t('backups.spaceUsed')}</span>
          <HardDrive className="w-4 h-4 text-emerald-400" />
        </div>
        <div className="text-2xl sm:text-3xl font-extrabold font-heading text-[var(--text-primary)]">
          {storageUsed}
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">{t('backups.gzipLevelNine')}</p>
      </div>

      <div className="p-5 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5 col-span-2 sm:col-span-1">
        <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
          <span>{t('backups.automaticSchedule')}</span>
          <Calendar className="w-4 h-4 text-amber-400" />
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`w-2.5 h-2.5 rounded-full ${
              schedule.enabled ? 'bg-emerald-500 animate-pulse' : 'bg-[var(--text-muted)]'
            }`}
          />
          <div className="text-xl sm:text-2xl font-bold font-heading text-[var(--text-primary)]">
            {/* Frequency arrived raw from enum: card showed
                "DAILY" in uppercase next to translated copy. */}
            {schedule.enabled ? t(`backups.freq${schedule.frequency}`) : t('backups.inactive')}
          </div>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">
          {schedule.enabled
            ? t('backups.scheduleSummary', { time: schedule.time, n: schedule.retentionCount })
            : t('backups.noAutoScheduled')}
        </p>
      </div>
    </div>
  );
}
