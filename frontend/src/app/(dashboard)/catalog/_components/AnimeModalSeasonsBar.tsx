'use client';

import { useI18n } from '@/i18n/I18nProvider';
import {
  Tv,
  Loader2,
  Plus,
  X,
  Search,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface AnimeModalSeasonsBarProps {
  selectedAnime: any;
  setSelectedAnime: (anime: any) => void;
  franchiseSeasons: any[];
  setFranchiseSeasons: React.Dispatch<React.SetStateAction<any[]>>;
  loadingFranchise: boolean;
  linkSearchOpen: boolean;
  setLinkSearchOpen: (open: boolean) => void;
  linkSearchQuery: string;
  setLinkSearchQuery: (query: string) => void;
  catalog: any[];
  canScrollLeft: boolean;
  canScrollRight: boolean;
  scrollSeasons: (direction: 'left' | 'right') => void;
  seasonsScrollRef: React.RefObject<HTMLDivElement | null>;
  checkSeasonScroll: () => void;
  getSeasonNumber: (anime: any) => number;
}

export function AnimeModalSeasonsBar({
  selectedAnime,
  setSelectedAnime,
  franchiseSeasons,
  setFranchiseSeasons,
  loadingFranchise,
  linkSearchOpen,
  setLinkSearchOpen,
  linkSearchQuery,
  setLinkSearchQuery,
  catalog,
  canScrollLeft,
  canScrollRight,
  scrollSeasons,
  seasonsScrollRef,
  checkSeasonScroll,
  getSeasonNumber,
}: AnimeModalSeasonsBarProps) {
  const { t } = useI18n();

  return (
    <div className="p-3.5 sm:p-5 pb-2 sm:pb-3 space-y-3 shrink-0 relative z-10">
      {/* Header de Progreso */}
      <div className="p-3 sm:p-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-sm">
        <div className="space-y-0.5">
          <div className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-2">
            <Tv className="w-4 h-4 text-[#01bcf3]" />
            <span>{t('catalog.watchProgress')}</span>
          </div>
          <div className="text-[10.5px] text-[var(--text-muted)]">{t('catalog.autoSyncEpisodes')}</div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-left sm:text-right font-mono">
            <div className="text-xs font-bold text-[#01bcf3]">
              Ep. {Math.min(selectedAnime.episodesWatched || 0, selectedAnime.episodesTotal || selectedAnime.episodesWatched || 0)} / {selectedAnime.episodesTotal || '?'}
            </div>
            <div className="text-[10px] text-[var(--text-muted)]">
              {selectedAnime.progressPercentage}% completado
            </div>
          </div>
          <div className="w-16 sm:w-20 h-1.5 rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#01bcf3] transition-all duration-300"
              style={{ width: `${selectedAnime.progressPercentage}%` }}
            />
          </div>
        </div>
      </div>

      {/* SECCIÓN TEMPORADAS RELACIONADAS (CINTA HORIZONTAL CON SCROLL SIN BARRA VISIBLE Y VINCULACIÓN) */}
      <div className="space-y-1.5 shrink-0 relative group">
        <div className="flex items-center justify-between text-xs px-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)] text-[11px]">
            <Tv className="w-3.5 h-3.5 text-[#01bcf3]" />
            <span>{t('catalog.sagaSeasons')}</span>
            <span className="text-[10px] font-normal font-mono text-[var(--text-muted)]">
              ({franchiseSeasons.length || 1})
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {loadingFranchise && (
              <span className="flex items-center gap-1 text-[10px] text-[#01bcf3]">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>{t('catalog.loadingTimeline')}</span>
              </span>
            )}

            {/* Botón Vincular / Buscar otra temporada */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setLinkSearchOpen(!linkSearchOpen)}
                // Sin whitespace-nowrap el texto partía en dos renglones y el
                // botón crecía a 35px de alto: dominaba una fila que solo es
                // la etiqueta de la sección, junto a flechas de 24px.
                className="shrink-0 whitespace-nowrap h-6 px-2 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[#01bcf3] hover:border-[#01bcf3]/40 text-[11px] font-medium inline-flex items-center gap-1 transition-colors cursor-pointer"
                title={t('catalog.searchAndLinkSeason')}
              >
                <Plus className="w-3 h-3 text-[#01bcf3]" />
                <span>Vincular temporada</span>
              </button>

              {/* Popover de búsqueda de anime */}
              {linkSearchOpen && (
                <div className="absolute right-0 top-full mt-1.5 w-64 sm:w-72 p-2.5 rounded-[8px] border border-[var(--border-strong)] bg-[var(--bg-surface-elevated)] shadow-xl z-50 space-y-2 backdrop-blur-md">
                  <div className="flex items-center justify-between pb-1 border-b border-[var(--border-subtle)]">
                    <span className="text-[11px] font-semibold text-[var(--text-primary)]">{t('catalog.searchYourCatalogue')}</span>
                    <button
                      type="button"
                      onClick={() => setLinkSearchOpen(false)}
                      className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-0.5"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                    <input
                      type="text"
                      placeholder={t('catalog.animeOrSeasonPlaceholder')}
                      value={linkSearchQuery}
                      onChange={(e) => setLinkSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-2.5 py-1 text-xs rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[#01bcf3]"
                      autoFocus
                    />
                  </div>
                  <div className="max-h-40 overflow-y-auto space-y-1 text-xs">
                    {catalog
                      .filter((c) =>
                        !linkSearchQuery.trim()
                          ? true
                          : (c.title || '').toLowerCase().includes(linkSearchQuery.toLowerCase()) ||
                            (c.romajiTitle || '').toLowerCase().includes(linkSearchQuery.toLowerCase())
                      )
                      .slice(0, 8)
                      .map((c) => (
                        <button
                          key={c.id || c.anilistId || c.malId}
                          type="button"
                          onClick={() => {
                            if (!franchiseSeasons.some((s) => s.id === c.id || (s.anilistId && s.anilistId === c.anilistId))) {
                              setFranchiseSeasons((prev) => [...prev, c]);
                            }
                            setSelectedAnime(c);
                            setLinkSearchOpen(false);
                            setLinkSearchQuery('');
                          }}
                          className="w-full text-left px-2 py-1.5 rounded-[4px] hover:bg-[var(--bg-surface-hover)] flex items-center justify-between gap-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer"
                        >
                          <span className="truncate max-w-[190px]">{c.title || c.romajiTitle}</span>
                          <span className="text-[10px] font-mono text-[var(--text-muted)] shrink-0">
                            {c.episodesWatched || 0}/{c.episodesTotal || '?'}
                          </span>
                        </button>
                      ))}
                  </div>
                </div>
              )}
            </div>

            {/* Flechas discretas de scroll horizontal */}
            {(canScrollLeft || canScrollRight) && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => scrollSeasons('left')}
                  disabled={!canScrollLeft}
                  className="w-5 h-5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  title="Ver anteriores"
                >
                  <ChevronLeft className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollSeasons('right')}
                  disabled={!canScrollRight}
                  className="w-5 h-5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-25 disabled:cursor-not-allowed flex items-center justify-center transition-all cursor-pointer"
                  title="Ver siguientes"
                >
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Carrusel de Píldoras con scroll horizontal libre sin barra visible */}
        <div
          ref={seasonsScrollRef}
          onScroll={checkSeasonScroll}
          onWheel={(e) => {
            if (e.deltaY !== 0 && seasonsScrollRef.current) {
              seasonsScrollRef.current.scrollLeft += e.deltaY;
            }
          }}
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5 touch-pan-x"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {franchiseSeasons.map((seasonItem, idx) => {
            const active = (
              Number(selectedAnime.anilistId) > 0
              && Number(seasonItem.anilistId) === Number(selectedAnime.anilistId)
            ) || (
              Number(selectedAnime.malId) > 0
              && Number(seasonItem.malId) === Number(selectedAnime.malId)
            ) || (
              seasonItem.id === selectedAnime.id
            );
            const sNum = seasonItem.seasonNumber || getSeasonNumber(seasonItem) || idx + 1;
            const isWatched = seasonItem.inUserList !== false && seasonItem.episodesTotal > 0 && seasonItem.episodesWatched >= seasonItem.episodesTotal;
            return (
              <button
                key={seasonItem.anilistId || seasonItem.malId || seasonItem.id || idx}
                type="button"
                onClick={() => setSelectedAnime(seasonItem)}
                className={`px-3 py-1.5 rounded-[6px] border text-left transition-all shrink-0 flex items-center gap-2 cursor-pointer select-none ${
                  active
                    ? 'border-[#01bcf3]/60 bg-[#01bcf3]/15 text-[#01bcf3] shadow-sm ring-1 ring-[#01bcf3]/30'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:border-[var(--border-strong)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                }`}
              >
                <span className={`text-[11px] font-mono font-bold px-1.5 py-0.5 rounded-[4px] shrink-0 ${
                  active ? 'bg-[#01bcf3]/25 text-[#01bcf3]' : 'bg-[var(--border-subtle)] text-[var(--text-muted)]'
                }`}>
                  T{sNum}
                </span>
                <span className="text-xs font-medium max-w-[135px] sm:max-w-[190px] truncate block text-[var(--text-primary)]">
                  {seasonItem.title || seasonItem.romajiTitle}
                </span>
                <span className={`text-[10px] font-mono shrink-0 ${
                  seasonItem.inUserList === false ? 'text-zinc-500' : isWatched ? 'text-emerald-400 font-semibold' : 'text-[var(--text-muted)]'
                }`}>
                  {seasonItem.inUserList === false ? t('catalog.notAdded') : isWatched ? '✓' : `${seasonItem.episodesWatched || 0}/${seasonItem.episodesTotal || '?'}`}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
