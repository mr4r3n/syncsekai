'use client';

import React from 'react';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Sparkles,
  Lock,
} from 'lucide-react';
import type { HeatmapDay, MonthRecord, HeatmapResponse } from './types';
import { monthLabel, formatDateReadable, getHeatmapTierClass } from './utils';
import { DatePickerPopover } from './DatePickerPopover';
import { HistoryInsights } from './HistoryInsights';

interface HistoryPaceProps {
  t: (key: string, values?: any) => string;
  locale: string;
  dateFilterMode: 'month' | 'range';
  setDateFilterMode: (mode: 'month' | 'range') => void;
  setOpenPicker: (picker: 'start' | 'end' | null) => void;
  openPicker: 'start' | 'end' | null;
  currentMonthData: MonthRecord | undefined;
  selectedMonthIndex: number;
  setSelectedMonthIndex: React.Dispatch<React.SetStateAction<number>>;
  monthsList: MonthRecord[];
  isLightMode: boolean;
  startDate: string;
  setStartDate: (date: string) => void;
  endDate: string;
  setEndDate: (date: string) => void;
  earliestDate: string;
  latestDate: string;
  setActivePreset: (preset: 'month' | 'last30' | 'all' | 'custom') => void;
  activePreset: 'month' | 'last30' | 'all' | 'custom';
  hoveredDay: HeatmapDay | null;
  setHoveredDay: (day: HeatmapDay | null) => void;
  heatmapData: HeatmapResponse | null;
  summary: any;
}

export function HistoryPace({
  t,
  locale,
  dateFilterMode,
  setDateFilterMode,
  setOpenPicker,
  openPicker,
  currentMonthData,
  selectedMonthIndex,
  setSelectedMonthIndex,
  monthsList,
  isLightMode,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  earliestDate,
  latestDate,
  setActivePreset,
  activePreset,
  hoveredDay,
  setHoveredDay,
  heatmapData,
  summary,
}: HistoryPaceProps) {
  return (
    <>
      {/* RIGHT COLUMN: WATCHING PACE & METRICS (4 COLS) */}
      <div className="xl:col-span-4 space-y-4">
        <div className="glass-card p-5 sm:p-6 space-y-4">
          {/* HEADER WITH MONTH VS RANGE TOGGLE */}
          <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-[var(--color-brand-primary,#FF634A)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('history.viewingPace')}</h3>
            </div>

            {/* MODE TOGGLE WITH SYNCSEKAI BUTTON STYLING */}
            <div className="flex items-center p-1 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => {
                  setDateFilterMode('month');
                  setOpenPicker(null);
                }}
                className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                  dateFilterMode === 'month'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >{t('history.byMonth')}</button>
              <button
                type="button"
                onClick={() => {
                  setDateFilterMode('range');
                }}
                className={`px-3 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                  dateFilterMode === 'range'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('history.dateRange')}
              </button>
            </div>
          </div>

          {/* MODO 1: NAVEGADOR DE MESES (100% REAL) */}
          {dateFilterMode === 'month' && currentMonthData && (
            <div className="flex items-center justify-between p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setSelectedMonthIndex((prev) => Math.max(0, prev - 1))}
                disabled={selectedMonthIndex === 0}
                className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-all cursor-pointer ${
                  isLightMode
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
                    : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                } disabled:opacity-20 disabled:cursor-not-allowed`}
                title={
                  selectedMonthIndex > 0
                    ? t('history.previousMonth')
                    : t('history.firstAvailableMonth')
                }
              >
                <ChevronLeft className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-zinc-100'}`} />
              </button>

              <div className="text-center min-w-0">
                <div className={`text-sm font-bold font-heading ${isLightMode ? 'text-zinc-950' : 'text-[var(--text-primary)]'}`}>
                  {monthLabel(currentMonthData.year, currentMonthData.month, locale)}
                </div>
                <div className="text-[10.5px] font-mono text-[var(--text-muted)]">
                  {t('history.scrobblesInMonth', { n: currentMonthData.totalScrobbles })}
                </div>
              </div>

              <button
                type="button"
                onClick={() =>
                  setSelectedMonthIndex((prev) =>
                    Math.min(monthsList.length - 1, prev + 1)
                  )
                }
                disabled={selectedMonthIndex >= monthsList.length - 1}
                className={`w-8 h-8 rounded-[6px] border flex items-center justify-center transition-all cursor-pointer ${
                  isLightMode
                    ? 'bg-zinc-100 hover:bg-zinc-200 border-zinc-300 text-zinc-900'
                    : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border-[var(--border-subtle)] text-[var(--text-primary)]'
                } disabled:opacity-20 disabled:cursor-not-allowed`}
                title={
                  selectedMonthIndex < monthsList.length - 1
                    ? t('history.nextMonth')
                    : t('history.currentMonthNoActivity')
                }
              >
                <ChevronRight className={`w-4 h-4 shrink-0 ${isLightMode ? 'text-zinc-900' : 'text-zinc-100'}`} />
              </button>
            </div>
          )}

          {/* MODE 2: DATE RANGE PICKER (NO NATIVE BROWSER WHITE POPUP) */}
          {dateFilterMode === 'range' && (
            <div className="space-y-3 p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] dark-datepicker-container">
              <div className="grid grid-cols-2 gap-2.5">
                {/* 'FROM' FIELD */}
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                    {t('history.from')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenPicker(openPicker === 'start' ? null : 'start')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[6px] border text-xs font-mono transition-all cursor-pointer ${
                      isLightMode ? 'bg-white' : 'bg-[var(--bg-app)]'
                    } ${
                      openPicker === 'start'
                        ? 'border-[var(--color-brand-primary,#FF634A)] ring-1 ring-[var(--color-brand-primary,#FF634A)]/50'
                        : isLightMode
                        ? 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <span className={isLightMode ? 'text-zinc-950 font-semibold' : 'text-[var(--text-primary)] font-semibold'}>
                      {formatDateReadable(startDate)}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-brand-primary,#FF634A)] shrink-0" />
                  </button>

                  {openPicker === 'start' && (
                    <DatePickerPopover
                      title={t('history.selectStartDate')}
                      currentDate={startDate}
                      minDate={earliestDate}
                      maxDate={endDate || latestDate}
                      availableMonths={monthsList}
                      isLightMode={isLightMode}
                      onSelect={(val) => {
                        setStartDate(val);
                        setActivePreset('custom');
                      }}
                      onClose={() => setOpenPicker(null)}
                    />
                  )}
                </div>

                {/* 'TO' FIELD */}
                <div className="space-y-1 relative">
                  <label className="text-[10px] font-mono text-[var(--text-muted)] uppercase tracking-wider block">
                    {t('history.to')}
                  </label>
                  <button
                    type="button"
                    onClick={() => setOpenPicker(openPicker === 'end' ? null : 'end')}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-[6px] border text-xs font-mono transition-all cursor-pointer ${
                      isLightMode ? 'bg-white' : 'bg-[var(--bg-app)]'
                    } ${
                      openPicker === 'end'
                        ? 'border-[var(--color-brand-primary,#FF634A)] ring-1 ring-[var(--color-brand-primary,#FF634A)]/50'
                        : isLightMode
                        ? 'border-zinc-300 hover:border-zinc-400 hover:bg-zinc-50'
                        : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                  >
                    <span className={isLightMode ? 'text-zinc-950 font-semibold' : 'text-[var(--text-primary)] font-semibold'}>
                      {formatDateReadable(endDate)}
                    </span>
                    <Calendar className="w-3.5 h-3.5 text-[var(--color-brand-primary,#FF634A)] shrink-0" />
                  </button>

                  {openPicker === 'end' && (
                    <DatePickerPopover
                      title={t('history.selectEndDate')}
                      currentDate={endDate}
                      minDate={startDate || earliestDate}
                      maxDate={latestDate}
                      availableMonths={monthsList}
                      isLightMode={isLightMode}
                      onSelect={(val) => {
                        setEndDate(val);
                        setActivePreset('custom');
                      }}
                      onClose={() => setOpenPicker(null)}
                    />
                  )}
                </div>
              </div>

              {/* QUICK ACCESS WITH SYNCSEKAI BUTTON STYLING */}
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                <button
                  type="button"
                  onClick={() => {
                    const today = latestDate || new Date().toISOString().slice(0, 10);
                    setStartDate(today.slice(0, 8) + '01');
                    setEndDate(today);
                    setActivePreset('month');
                    setOpenPicker(null);
                  }}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activePreset === 'month'
                      ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                      : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  <span>{t('history.thisMonth')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const d30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
                    setStartDate(d30);
                    setEndDate(latestDate);
                    setActivePreset('last30');
                    setOpenPicker(null);
                  }}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activePreset === 'last30'
                      ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                      : 'btn-secondary text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Clock className="w-3 h-3" />
                  <span>{t('history.lastThirtyDays')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setStartDate(earliestDate);
                    setEndDate(latestDate);
                    setActivePreset('all');
                    setOpenPicker(null);
                  }}
                  className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                    activePreset === 'all'
                      ? 'bg-amber-500 text-black font-bold shadow-xs'
                      : isLightMode
                      ? 'bg-amber-100 hover:bg-amber-200 border border-amber-300 text-amber-950 font-bold'
                      : 'btn-secondary text-amber-300 border-amber-500/35 hover:border-amber-500/60'
                  }`}
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isLightMode ? 'text-amber-800' : 'text-amber-400'}`} />
                  <span>{t('history.allHistory')}</span>
                </button>
              </div>
            </div>
          )}

          {/* INFORMATIVE BOUNDARY BADGE */}
          <div
            className={`flex items-center gap-1.5 p-2.5 rounded-[6px] border text-[10.5px] font-mono truncate ${
              isLightMode
                ? 'bg-amber-50 border-amber-300 text-amber-950 font-bold'
                : 'bg-amber-500/10 border-amber-500/25 text-amber-300'
            }`}
          >
            <Lock
              className={`w-3.5 h-3.5 shrink-0 ${
                isLightMode ? 'text-amber-800' : 'text-amber-400'
              }`}
            />
            <span>{t('history.historyRange', { from: formatDateReadable(earliestDate), to: formatDateReadable(latestDate) })}</span>
          </div>

          {/* HEATMAP GRID INTERACTIVO */}
          <div className="space-y-1.5">
            <div
              className={`grid grid-cols-7 gap-1.5 p-3 rounded-[8px] border ${
                isLightMode
                  ? 'bg-white border-zinc-200'
                  : 'bg-[var(--bg-surface)] border-[var(--border-subtle)]'
              }`}
            >
              {(currentMonthData?.days || []).map((item) => {
                const tierClass = getHeatmapTierClass(item.tier, isLightMode);

                return (
                  <div
                    key={item.day}
                    onMouseEnter={() => setHoveredDay(item)}
                    onMouseLeave={() => setHoveredDay(null)}
                    className={`aspect-square rounded-[5px] border flex items-center justify-center text-[10px] font-mono cursor-pointer transition-all duration-150 hover:scale-115 hover:border-[var(--color-brand-primary,#FF634A)] hover:z-10 ${tierClass} ${
                      item.isToday
                        ? 'ring-2 ring-[var(--color-brand-primary,#FF634A)] ring-offset-1 ring-offset-[var(--bg-surface)]'
                        : ''
                    } ${item.isFuture ? 'opacity-25 pointer-events-none' : ''}`}
                  >
                    {item.day}
                  </div>
                );
              })}
            </div>

            {/* Dynamic Tooltip */}
            <div
              className={`h-4 flex items-center justify-center text-[11px] font-mono font-semibold ${
                isLightMode ? 'text-zinc-950' : 'text-amber-400'
              }`}
            >
              {hoveredDay ? (
                <span>
                  {t('history.dayScrobbles', { day: hoveredDay.day, n: hoveredDay.count })}
                </span>
              ) : (
                <span
                  className={
                    isLightMode
                      ? 'text-zinc-500 text-[10.5px]'
                      : 'text-[var(--text-muted)] text-[10.5px]'
                  }
                >{t('history.hoverOverDay')}</span>
              )}
            </div>
          </div>

          {/* Leyenda */}
          <div className="flex items-center justify-between text-[10.5px] font-mono text-[var(--text-muted)] pt-0.5">
            <span>{t('history.lessActive')}</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-[2px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]" />
              <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500/20 border border-amber-500/30" />
              <span className="w-2.5 h-2.5 rounded-[2px] bg-amber-500/45 border border-amber-500/60" />
              <span className="w-2.5 h-2.5 rounded-[2px] bg-orange-500/75 border border-orange-500/90" />
              <span className="w-2.5 h-2.5 rounded-[2px] bg-orange-500 border border-orange-200" />
            </div>
            <span>{t('history.moreActive')}</span>
          </div>

          <HistoryInsights
            heatmapData={heatmapData}
            summary={summary}
            t={t}
          />
        </div>
      </div>
    </>
  );
}
