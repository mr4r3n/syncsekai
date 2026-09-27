import React from 'react';
import { BarChart2, Star, TrendingUp } from 'lucide-react';

interface ViewingStatsSectionProps {
  userStats: any;
  t: (key: string, params?: any) => string;
}

export function ViewingStatsSection({ userStats, t }: ViewingStatsSectionProps) {
  return (
    <div className="glass-card p-6 sm:p-7 space-y-6 border-amber-500/40 shadow-lg">
      {/* EXPANDED SECTION: CONSOLIDATED GLOBAL STATS (100% WIDTH) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
            <BarChart2 className="w-5 h-5 text-[var(--accent-text)]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('settings.globalViewingStats')}</h2>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('settings.globalViewingStatsDesc')}</p>
          </div>
        </div>
        <span className="badge-pill font-mono text-xs self-start sm:self-auto">
          {t('settings.seriesInCatalog', { count: userStats?.totalShows ?? 0 })}
        </span>
      </div>

      {/* 6 Global Metrics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.statTotalSeries')}</span>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {userStats?.totalShows ?? 0}
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.inLibrary')}</p>
        </div>

        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.statEpisodesWatched')}</span>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {userStats?.totalEpisodes ? userStats.totalEpisodes.toLocaleString() : 0}
          </div>
          <p className="text-[10.5px] text-emerald-400 font-semibold">{t('settings.completedCount', { count: userStats?.completedCount ?? 0 })}</p>
        </div>

        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.statTotalTime')}</span>
          <div className="text-2xl font-bold text-[var(--text-primary)]">
            {userStats?.totalHours ?? 0}h
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.netDays', { days: userStats?.totalDays ?? 0 })}</p>
        </div>

        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.statMeanScore')}</span>
          <div className="text-2xl font-bold text-amber-400 flex items-center gap-1.5">
            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
            <span>{userStats?.meanScore ?? '8.5'}</span>
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.averageRating')}</p>
        </div>

        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.watching')}</span>
          <div className="text-2xl font-bold text-sky-400">
            {userStats?.watchingCount ?? 0}
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.activeSeries')}</p>
        </div>

        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1 font-mono">
          <span className="text-[10px] text-[var(--text-muted)] uppercase tracking-wider">{t('settings.statFavorites')}</span>
          <div className="text-2xl font-bold text-rose-400">
            {userStats?.favoritesCount ?? 0}
          </div>
          <p className="text-[10.5px] text-[var(--text-muted)]">{t('settings.featured')}</p>
        </div>
      </div>

      {/* Genre Breakdown with Horizontal Bars */}
      <div className="p-4 sm:p-5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-purple-400" />
            <span>{t('settings.favouriteGenres')}</span>
          </h4>
          <span className="text-[11px] font-mono text-[var(--text-muted)]">
            {t('settings.calculatedOverEpisodes', { count: userStats?.totalEpisodes ? userStats.totalEpisodes.toLocaleString() : 0 })}
          </span>
        </div>

        <div className="space-y-2.5 pt-1">
          {!userStats?.topGenres?.length && (
            <p className="text-xs text-[var(--text-muted)]">{t('settings.noGenresYet')}</p>
          )}
          {(userStats?.topGenres || []).map((g: any, idx: number) => {
            const colors = ['bg-sky-400', 'bg-purple-400', 'bg-emerald-400', 'bg-amber-400', 'bg-rose-400'];
            const color = colors[idx % colors.length];
            return (
              <div key={g.name} className="flex items-center gap-3 text-xs font-mono">
                <span className="w-28 font-semibold text-[var(--text-secondary)] truncate">
                  {g.name}
                </span>
                <div className="flex-1 h-2 rounded-full bg-[var(--bg-app)] border border-[var(--border-subtle)] overflow-hidden">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${Math.min(100, g.percentage || 0)}%` }}
                  />
                </div>
                <span className="w-12 text-right font-bold text-[var(--text-primary)]">
                  {g.percentage || 0}%
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
