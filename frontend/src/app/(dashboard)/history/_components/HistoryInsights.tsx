'use client';

import {
  Flame,
  Zap,
  Clock,
} from 'lucide-react';
import type { HeatmapResponse } from './types';

interface HistoryInsightsProps {
  heatmapData: HeatmapResponse | null;
  summary: any;
  t: (key: string, values?: any) => string;
}

export function HistoryInsights({
  heatmapData,
  summary,
  t,
}: HistoryInsightsProps) {
  return (
    <>
      {/* Tarjetas de Insights */}
      <div className="space-y-2.5 pt-2 border-t border-[var(--glass-border)]">
        <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 hover:border-[var(--border-strong)] transition-all">
          <div className="w-8 h-8 rounded-[6px] bg-orange-500/15 text-orange-400 border border-orange-500/25 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
              {t('history.bestStreak', { n: heatmapData?.bestStreak || 0 })}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              {t('history.currentStreak', { n: heatmapData?.currentStreak || 0 })}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 hover:border-[var(--border-strong)] transition-all">
          <div className="w-8 h-8 rounded-[6px] bg-sky-500/15 text-sky-400 border border-sky-500/25 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">
              {t('history.mainTracker')}: {summary?.topTracker?.name || t('history.noData')}
            </h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              {summary?.topTracker
                ? t('history.mainTrackerShare', { p: summary.topTracker.percentage })
                : t('history.noTrackerYet')}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 hover:border-[var(--border-strong)] transition-all">
          <div className="w-8 h-8 rounded-[6px] bg-purple-500/15 text-purple-400 border border-purple-500/25 flex items-center justify-center shrink-0">
            <Clock className="w-4 h-4" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading">{t('history.mostActiveTime')}</h4>
            <p className="text-[11px] text-[var(--text-muted)]">
              {summary?.activeSlot
                ? t('history.activeRange', {
                    from: String(summary.activeSlot.from).padStart(2, '0'),
                    to: String(summary.activeSlot.to).padStart(2, '0'),
                  })
                : t('history.noActivityYet')}
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
