'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { syncOutcome } from './syncOutcome';
import {
  ChevronDown,
  Check,
  Play,
  Loader2,
} from 'lucide-react';

interface AnimeModalEpisodesProps {
  selectedAnime: any;
  setSelectedAnime: (anime: any) => void;
  setCatalog: React.Dispatch<React.SetStateAction<any[]>>;
  selectedTracker: string;
  expandedSeasons: Record<number, boolean>;
  setExpandedSeasons: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  getSeasonNumber: (anime: any) => number;
}

export function AnimeModalEpisodes({
  selectedAnime,
  setSelectedAnime,
  setCatalog,
  selectedTracker,
  expandedSeasons,
  setExpandedSeasons,
  getSeasonNumber,
}: AnimeModalEpisodesProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [syncingEpisode, setSyncingEpisode] = useState<number | null>(null);

  const toggleSeason = (seasonIdx: number) => {
    setExpandedSeasons((prev) => {
      const isCurrentlyExpanded = !!prev[seasonIdx];
      return isCurrentlyExpanded ? {} : { [seasonIdx]: true };
    });
  };

  const generateSeasonsBreakdown = (anime: any) => {
    const total = anime.episodesTotal > 0
      ? Number(anime.episodesTotal)
      : Math.max(0, Number(anime.episodesWatched || 0));
    const watched = Math.min(Number(anime.episodesWatched || 0), total);
    const seasonNumber = getSeasonNumber(anime);
    const episodes = Array.from({ length: total }, (_, index) => {
      const number = index + 1;
      const isWatched = number <= watched;
      const isNext = number === watched + 1;
      return {
        number,
        isWatched,
        isNext,
        status: isWatched ? 'watched' : isNext ? 'next' : 'pending',
      };
    });

    return [{
      index: seasonNumber - 1,
      title: t('catalog.seasonN', { n: seasonNumber }),
      subtitle: total > 0 ? t('catalog.episodesRange', { total }) : t('catalog.episodesToConfirm'),
      episodes,
      watchedCount: watched,
      totalCount: total,
      progressPct: total > 0 ? Math.round((watched / total) * 100) : 0,
    }];
  };

  // Handle sync for a specific episode across all trackers
  const handleSyncEpisode = async (epNumber: number) => {
    if (!selectedAnime) return;
    if (selectedAnime.inUserList === false) {
      showToast(t('catalog.seasonNotOnListOpenTracker', { tracker: selectedTracker === 'MAL' ? 'MyAnimeList' : 'AniList' }), 'info');
      return;
    }
    setSyncingEpisode(epNumber);

    const total = selectedAnime.episodesTotal || 0;
    const isCompleted = total > 0 && epNumber >= total;
    const newStatus = isCompleted ? 'COMPLETED' : 'CURRENT';
    const newPct = total > 0 ? Math.min(100, Math.round((epNumber / total) * 100)) : 100;

    const previous = selectedAnime;
    const updated = {
      ...selectedAnime,
      episodesWatched: epNumber,
      progressPercentage: newPct,
      status: newStatus,
    };
    // A save no tracker took is undone on screen: it must not look saved when it is not.
    const undo = () => {
      setSelectedAnime(previous);
      setCatalog((prev) =>
        prev.map((item) =>
          item.id === previous.id || (item.anilistId && item.anilistId === previous.anilistId)
            ? { ...item, episodesWatched: previous.episodesWatched, progressPercentage: previous.progressPercentage, status: previous.status }
            : item,
        ),
      );
    };
    setSelectedAnime(updated);
    setCatalog((prev) =>
      prev.map((item) =>
        item.id === selectedAnime.id || (item.anilistId && item.anilistId === selectedAnime.anilistId)
          ? { ...item, episodesWatched: epNumber, progressPercentage: newPct, status: newStatus }
          : item,
      ),
    );

    try {
      const res = await api.catalog.syncProgress({
        anilistMediaId: selectedAnime.anilistId,
        malMediaId: selectedAnime.malId,
        progress: epNumber,
        score: selectedAnime.rating,
        status: newStatus,
        showTitle: selectedAnime.title,
        seasonNumber: selectedAnime.seasonNumber,
      });
      const outcome = syncOutcome(res);
      if (outcome.kind === 'synced') {
        showToast(t('catalog.episodeSynced', { number: epNumber, trackers: outcome.trackers }), 'success');
      } else if (outcome.kind === 'syncing') {
        showToast(t('catalog.syncStillRunning'), 'info');
      } else if (outcome.kind === 'local') {
        showToast(t('catalog.savedLocallyOnly'), 'info');
      } else {
        undo();
        showToast(`${t('catalog.syncEpisodeError')} ${outcome.reason}`, 'error');
      }
    } catch (err: any) {
      undo();
      showToast(`${t('catalog.syncEpisodeError')} ` + err.message, 'error');
    } finally {
      setSyncingEpisode(null);
    }
  };

  return (
    <div className="p-3.5 sm:p-5 py-2 space-y-2 lg:overflow-y-auto lg:flex-1 lg:min-h-0 relative z-10">
      {selectedAnime.inUserList === false ? (
        <div className="p-5 rounded-[6px] border border-dashed border-[var(--border-strong)] bg-[var(--bg-surface)] text-center space-y-2">
          <p className="text-xs font-semibold text-[var(--text-primary)]">{t('catalog.seasonNotInList')}</p>
          <p className="text-[11px] text-[var(--text-muted)]">
            {t('catalog.seasonNotInListHint')}
          </p>
        </div>
      ) : generateSeasonsBreakdown(selectedAnime).map((season) => {
        const isExpanded = !!expandedSeasons[season.index];
        return (
          <div
            key={season.index}
            className="rounded-[6px] border overflow-hidden transition-all duration-300 ease-in-out border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md shadow-sm"
            style={{
              borderColor: isExpanded ? 'var(--border-strong)' : 'var(--border-subtle)',
            }}
          >
            {/* Season Header */}
            <button
              type="button"
              onClick={() => toggleSeason(season.index)}
              className="w-full p-3 flex items-center justify-between text-left hover:bg-[var(--bg-surface-hover)] transition-colors select-none cursor-pointer"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-6 h-6 rounded-[4px] bg-[#01bcf3]/15 text-[#01bcf3] flex items-center justify-center font-mono text-xs font-bold shrink-0">
                  {season.index + 1}
                </div>
                <div className="truncate">
                  <span className="font-semibold text-xs text-[var(--text-primary)] block">
                    {season.title}
                  </span>
                  <span className="text-[10px] text-[var(--text-muted)] font-mono">
                    {season.subtitle}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <span className="text-xs font-mono text-[#01bcf3] font-semibold">
                  {season.watchedCount}/{season.totalCount} ({season.progressPct}%)
                </span>
                <ChevronDown
                  className={`w-4 h-4 transition-transform duration-300 ease-in-out ${
                    isExpanded ? 'rotate-180 text-[#01bcf3]' : 'rotate-0 text-[var(--text-muted)]'
                  }`}
                />
              </div>
            </button>

            {/* Episode Grid with CSS Grid Ease-in-Out Animation */}
            <div
              className={`grid transition-all duration-300 ease-in-out ${
                isExpanded ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="overflow-hidden">
                <div className="p-2.5 sm:p-3 border-t border-[var(--border-subtle)] grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-[var(--bg-surface-elevated)]/40">
                  {season.episodes.map((ep) => {
                    const isSyncing = syncingEpisode === ep.number;
                    return (
                      <div
                        key={ep.number}
                        className={`flex items-center justify-between p-2 sm:p-2.5 rounded-[6px] border transition-all duration-200 ${
                          ep.isWatched
                            ? 'border-emerald-500/25 bg-emerald-500/8'
                            : ep.isNext
                            ? 'border-[#01bcf3]/40 bg-[#01bcf3]/10'
                            : 'border-[var(--border-subtle)] opacity-80 hover:opacity-100 bg-[var(--bg-surface)]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                          <div
                            className={`w-7 h-7 rounded-[5px] flex items-center justify-center font-mono text-xs font-bold shrink-0 ${
                              ep.isWatched
                                ? 'bg-emerald-500/20 text-emerald-400'
                                : ep.isNext
                                ? 'bg-[#01bcf3]/20 text-[#01bcf3]'
                                : 'bg-[var(--border-subtle)] text-[var(--text-muted)]'
                            }`}
                          >
                            {ep.number}
                          </div>
                          <div className="min-w-0 flex-1">
                            <span className="text-xs font-semibold block truncate text-[var(--text-primary)] leading-tight">
                              {t('catalog.episodeNumber', { number: ep.number })}
                            </span>
                            <span
                              className={`text-[10px] font-mono leading-none block whitespace-nowrap mt-0.5 ${
                                ep.isWatched
                                  ? 'text-emerald-400 font-medium'
                                  : ep.isNext
                                  ? 'text-[#01bcf3] font-bold'
                                  : 'text-[var(--text-muted)]'
                              }`}
                            >
                              {ep.isWatched ? t('catalog.episodeWatched') : ep.isNext ? t('catalog.episodeNext') : t('catalog.episodePending')}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleSyncEpisode(ep.number)}
                          disabled={isSyncing}
                          className={`px-2.5 py-1 rounded-[5px] text-[11px] font-medium border flex items-center gap-1.5 transition-all cursor-pointer select-none shrink-0 ${
                            ep.isWatched
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25 hover:bg-emerald-500/20 font-semibold'
                              : ep.isNext
                              ? 'btn-primary'
                              : 'btn-secondary'
                          }`}
                          title={t('catalog.syncEpisodeNumber', { number: ep.number })}
                        >
                          {isSyncing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : ep.isWatched ? (
                            <Check className="w-3 h-3" />
                          ) : (
                            <Play className="w-2.5 h-2.5 fill-current" />
                          )}
                          <span className="whitespace-nowrap">{ep.isWatched ? t('catalog.resync') : t('catalog.mark')}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
