import React from 'react';
import { Sliders, Loader2, CheckCircle2 } from 'lucide-react';
import { Switch } from '@/components/Switch';
import { CustomSelect } from '@/components/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupsScheduleCardProps {
  handleSaveSchedule: (e: React.FormEvent) => Promise<void>;
  schedule: any;
  setSchedule: (val: any) => void;
  savingSchedule: boolean;
  formatDateTime: (dateStr: string) => string;
}

export function AdminBackupsScheduleCard({
  handleSaveSchedule,
  schedule,
  setSchedule,
  savingSchedule,
  formatDateTime,
}: AdminBackupsScheduleCardProps) {
  const { t } = useI18n();

  return (
    <div className="p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-5">
      <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--border-subtle)]">
        <Sliders className="w-4 h-4 text-[var(--accent-text)]" />
        <h2 className="text-sm font-bold tracking-tight font-heading">{t('backups.automaticSchedule')}</h2>
      </div>

      <form onSubmit={handleSaveSchedule} className="space-y-4">
        {/* Switch Activación */}
        <div className="flex items-center justify-between p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--text-primary)]">{t('backups.enableAutoBackups')}</span>
            <p className="text-[11px] text-[var(--text-muted)]">{t('backups.unattendedCron')}</p>
          </div>
          <Switch
            checked={schedule.enabled}
            onChange={(v) => setSchedule({ ...schedule, enabled: v })}
            ariaLabel={t('backups.enableAutoBackups')}
          />
        </div>

        {/* Frecuencia */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">{t('backups.frequency')}</label>
          <CustomSelect
            value={schedule.frequency}
            onChange={(val) => setSchedule({ ...schedule, frequency: val })}
            options={[
              { value: 'HOURLY', label: t('backups.everyHour') },
              { value: 'DAILY', label: t('backups.dailyRecommended') },
              { value: 'WEEKLY', label: t('backups.weekly') },
              { value: 'MONTHLY', label: t('backups.monthly') },
            ]}
            accentColor="cinnabar"
          />
        </div>

        {/* Hora de Ejecución */}
        <div className="space-y-1.5">
          <label htmlFor="copia-hora-ejecucion" className="text-xs font-medium text-[var(--text-secondary)]">{t('backups.executionTime')}</label>
          <div className="relative">
            <input
              id="copia-hora-ejecucion"
              type="time"
              value={schedule.time}
              onChange={(e) => setSchedule({ ...schedule, time: e.target.value })}
              disabled={!schedule.enabled || schedule.frequency === 'HOURLY'}
              className="w-full h-[36px] min-h-[36px] px-3.5 rounded-[6px] text-xs border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] disabled:opacity-50 font-mono"
            />
          </div>
        </div>

        {/* Retención */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-[var(--text-secondary)]">{t('backups.retention')}</label>
          <CustomSelect
            value={String(schedule.retentionCount)}
            onChange={(val) => setSchedule({ ...schedule, retentionCount: Number(val) })}
            options={[
              { value: '3', label: t('backups.keepLast', { n: 3 }) },
              { value: '7', label: t('backups.keepLast', { n: 7 }) },
              { value: '14', label: t('backups.keepLast', { n: 14 }) },
              { value: '30', label: t('backups.keepLast', { n: 30 }) },
              { value: '60', label: t('backups.keepLast', { n: 60 }) },
            ]}
            accentColor="cinnabar"
          />
          <p className="text-[10.5px] text-[var(--text-muted)]">{t('backups.retentionDesc')}</p>
        </div>

        {/* Incluir Archivos Multimedia */}
        <div className="flex items-center justify-between p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
          <div className="space-y-0.5">
            <span className="text-xs font-bold text-[var(--text-primary)]">
              {t('backups.includeMedia')}
            </span>
            <p className="text-[11px] text-[var(--text-muted)]">{t('backups.avatarsAndPosters')}</p>
          </div>
          <Switch
            checked={schedule.includeMedia && schedule.enabled}
            onChange={(v) => setSchedule({ ...schedule, includeMedia: v })}
            disabled={!schedule.enabled}
            ariaLabel={t('backups.includeMedia')}
          />
        </div>

        {schedule.lastRunAt && (
          <div className="p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-mono text-[var(--text-secondary)] space-y-1">
            <div className="text-[var(--text-muted)] uppercase tracking-wider text-[10px]">{t('backups.lastAutomaticRun')}</div>
            <div>{formatDateTime(schedule.lastRunAt)}</div>
          </div>
        )}

        <button
          type="submit"
          disabled={savingSchedule}
          className="w-full py-2.5 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          {savingSchedule ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="w-3.5 h-3.5" />
          )}
          <span>{t('backups.saveSchedule')}</span>
        </button>
      </form>
    </div>
  );
}
