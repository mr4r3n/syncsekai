'use client';

import React from 'react';
import { Clock } from 'lucide-react';
import { AnnouncementData } from '@/components/AnnouncementBanner';
import { toDatetimeLocal, fromDatetimeLocal, formatReadableDate } from './utils';

interface ScheduleTabProps {
  activeTab: string;
  formData: AnnouncementData;
  setFormData: React.Dispatch<React.SetStateAction<AnnouncementData>>;
  showToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  t: (key: string, values?: any) => string;
  locale: string;
}

export function ScheduleTab({
  activeTab,
  formData,
  setFormData,
  showToast,
  t,
  locale,
}: ScheduleTabProps) {
  const applyDurationDays = (days: number) => {
    const now = new Date();
    const start = formData.startsAt ? new Date(formData.startsAt) : now;
    const end = new Date(start.getTime() + days * 24 * 60 * 60 * 1000);
    setFormData({
      ...formData,
      startsAt: formData.startsAt || start.toISOString(),
      endsAt: end.toISOString(),
    });
    showToast(t('announcements.scheduledForDays', { n: days }), 'info');
  };

  const clearScheduleDates = () => {
    setFormData({
      ...formData,
      startsAt: null,
      endsAt: null,
    });
    showToast(t('announcements.scheduleRemoved'), 'info');
  };

  // Active status calculation
  const scheduleStatus = (() => {
    if (!formData.isActive) {
      return {
        type: 'INACTIVE',
        badgeClass: 'bg-zinc-800 text-zinc-400 border-zinc-700',
        title: t('announcements.alertDisabled'),
        message: t('announcements.alertDisabledDesc'),
      };
    }
    const now = new Date();
    if (formData.startsAt && new Date(formData.startsAt) > now) {
      const diffMs = new Date(formData.startsAt).getTime() - now.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        type: 'SCHEDULED',
        badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
        title: t('announcements.scheduledToStart'),
        message: t('announcements.scheduledToStartDesc', {
          date: formatReadableDate(t, locale, formData.startsAt),
          remaining: `${days > 0 ? `${days}d ` : ''}${hours}h`,
        }),
      };
    }
    if (formData.endsAt && new Date(formData.endsAt) < now) {
      return {
        type: 'EXPIRED',
        badgeClass: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
        title: t('announcements.expiredTerm'),
        message: t('announcements.expiredDesc', {
          date: formatReadableDate(t, locale, formData.endsAt),
        }),
      };
    }
    if (formData.endsAt) {
      const diffMs = new Date(formData.endsAt).getTime() - now.getTime();
      const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      return {
        type: 'ACTIVE_TIMED',
        badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
        title: t('announcements.activeInWindow'),
        message: t('announcements.activeInWindowDesc', {
          date: formatReadableDate(t, locale, formData.endsAt),
          remaining: `${days > 0 ? `${days}d ` : ''}${hours}h`,
        }),
      };
    }
    return {
      type: 'ACTIVE_INDEFINITE',
      badgeClass: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
      title: t('announcements.activeIndefinitely'),
      message: t('announcements.activeIndefinitelyDesc'),
    };
  })();

  return (
    <>
            {/* TAB 4: SCHEDULE & VALIDITY (NEW COMPLETE SUITE) */}
            {activeTab === 'schedule' && (
              <div className="space-y-6">
                {/* TARJETA DE ESTADO EN VIVO */}
                <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-8 h-8 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-secondary)] shrink-0">
                      <Clock className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--text-primary)] font-heading">{t('announcements.validityStatus')}</span>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold border ${scheduleStatus.badgeClass}`}>
                          {scheduleStatus.title}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-secondary)] mt-0.5">
                        {scheduleStatus.message}
                      </p>
                    </div>
                  </div>

                  {(formData.startsAt || formData.endsAt) && (
                    <button
                      type="button"
                      onClick={clearScheduleDates}
                      className="px-3 py-1.5 rounded-[4px] text-xs font-semibold text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/20 transition-colors shrink-0 cursor-pointer self-start sm:self-auto"
                    >
                      Limpiar Fechas (Indefinido)
                    </button>
                  )}
                </div>

                {/* QUICK DURATION BUTTONS */}
                <div className="space-y-2.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.setQuickDuration')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                    <button
                      type="button"
                      onClick={clearScheduleDates}
                      className={`h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border flex items-center justify-center text-center transition-all cursor-pointer ${
                        !formData.endsAt
                          ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
                      }`}
                    >
                      Indefinido
                    </button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(1)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.hours24')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(3)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days3')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(7)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days7')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(15)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days15')}</button>
                    <button
                      type="button"
                      onClick={() => applyDurationDays(30)}
                      className="h-11 sm:h-12 px-3 rounded-[6px] text-xs sm:text-sm font-semibold border bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)] transition-all cursor-pointer flex items-center justify-center"
                    >{t('announcements.days30')}</button>
                  </div>
                </div>

                {/* SELECTORES DE FECHA EXACTA */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.startDateTime')}</label>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, startsAt: new Date().toISOString() })}
                        className="text-xs text-[var(--text-muted)] hover:text-[#FF634A] transition-colors cursor-pointer font-medium"
                      >{t('announcements.startNow')}</button>
                    </div>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(formData.startsAt)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          startsAt: fromDatetimeLocal(e.target.value),
                        })
                      }
                      className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formData.startsAt
                        ? t('announcements.startsAtLabel', { date: formatReadableDate(t, locale, formData.startsAt) })
                        : t('announcements.noStartDate')}
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.endDateTime')}</label>
                      {formData.endsAt && (
                        <button
                          type="button"
                          onClick={() => setFormData({ ...formData, endsAt: null })}
                          className="text-xs text-[var(--text-muted)] hover:text-rose-400 transition-colors cursor-pointer font-medium"
                        >{t('announcements.removeLimit')}</button>
                      )}
                    </div>
                    <input
                      type="datetime-local"
                      value={toDatetimeLocal(formData.endsAt)}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          endsAt: fromDatetimeLocal(e.target.value),
                        })
                      }
                      className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">
                      {formData.endsAt
                        ? t('announcements.endsAtLabel', { date: formatReadableDate(t, locale, formData.endsAt) })
                        : t('announcements.noEndDate')}
                    </p>
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
