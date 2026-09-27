'use client';

import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Star,
  ExternalLink,
  Sliders,
  Loader2,
} from 'lucide-react';

interface AnimeModalSidebarProps {
  selectedAnime: any;
  selectedTracker: string;
  getStatusBadge: (status: string) => any;
  getSeasonNumber: (anime: any) => number;
  hoverRating: number | null;
  setHoverRating: (val: number | null) => void;
  savingRating: boolean;
  handleRate: (score: number) => void;
  handleToggleFavorite: (anime: any, e?: React.MouseEvent) => void;
  favoritesList: string[];
}

export function AnimeModalSidebar({
  selectedAnime,
  selectedTracker,
  getStatusBadge,
  getSeasonNumber,
  hoverRating,
  setHoverRating,
  savingRating,
  handleRate,
  handleToggleFavorite,
  favoritesList,
}: AnimeModalSidebarProps) {
  const { t } = useI18n();

  // Helper to render 5 stars with decimal support (0 to 10)
  const renderFiveStarWidget = (ratingVal: number) => {
    const activeScore = hoverRating !== null ? hoverRating : ratingVal;

    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((starIndex) => {
          const starMax = starIndex * 2;
          const starMin = starMax - 2;
          let fillPercent = 0;

          if (activeScore >= starMax) {
            fillPercent = 100;
          } else if (activeScore > starMin) {
            fillPercent = Math.round(((activeScore - starMin) / 2) * 100);
          }

          const halfVal = starIndex * 2 - 1;
          const fullVal = starIndex * 2;

          return (
            <div
              key={starIndex}
              className="relative w-5 h-5 flex items-center justify-center group cursor-pointer"
            >
              {/* Mitad Izquierda (Click = halfVal) */}
              <button
                type="button"
                onClick={() => handleRate(halfVal)}
                onMouseEnter={() => setHoverRating(halfVal)}
                onMouseLeave={() => setHoverRating(null)}
                className="absolute inset-y-0 left-0 w-1/2 z-20 focus:outline-none"
                title={`${halfVal}/10`}
              />

              {/* Mitad Derecha (Click = fullVal) */}
              <button
                type="button"
                onClick={() => handleRate(fullVal)}
                onMouseEnter={() => setHoverRating(fullVal)}
                onMouseLeave={() => setHoverRating(null)}
                className="absolute inset-y-0 right-0 w-1/2 z-20 focus:outline-none"
                title={`${fullVal}/10`}
              />

              {/* Background Star (Gray / Empty) */}
              <Star className="w-4 h-4 text-zinc-600 absolute inset-0 m-auto transition-transform group-hover:scale-120" />

              {/* Partially or Fully Filled Star (Amber with Glow) */}
              {fillPercent > 0 && (
                <div
                  className="absolute inset-0 m-auto overflow-hidden pointer-events-none transition-all flex items-center"
                  style={{ width: `${fillPercent}%` }}
                >
                  <Star className="w-4 h-4 fill-amber-400 text-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.7)] shrink-0" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <>
      {/* COMPACT MOBILE HEADER (Hidden on Desktop to avoid duplication or scroll bloat) */}
      <div className="p-4 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] lg:hidden shrink-0 space-y-2.5">
        <div className="flex items-start gap-3 pr-8">
          {/* Portada Miniatura */}
          <div className="relative w-20 aspect-[3/4] rounded-[6px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-app)] shrink-0 shadow-sm">
            <img
              src={selectedAnime.coverUrl}
              alt={selectedAnime.title}
              width={80}
              height={107}
              className="w-full h-full object-cover"
            />
          </div>

          {/* Metadata Principal */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-[4px] text-[10px] font-bold border select-none ${
                  getStatusBadge(selectedAnime.status).badgeClass
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${getStatusBadge(selectedAnime.status).dotClass}`} />
                <span>{getStatusBadge(selectedAnime.status).label}</span>
              </span>
              {selectedAnime.format && (
                <span className="badge-pill text-[10px] py-0.5 px-2">
                  {selectedAnime.format}
                </span>
              )}
              <span className="badge-pill text-[10px] py-0.5 px-2 text-[#01bcf3]">
                T{getSeasonNumber(selectedAnime)}
              </span>
            </div>

            <h2 className="font-bold text-sm leading-snug text-[var(--text-primary)] font-heading line-clamp-2">
              {selectedAnime.title}
            </h2>

            {/* Rating and Tracker */}
            <div className="flex items-center justify-between gap-2 pt-0.5">
              <div className="flex items-center gap-1 text-xs">
                <Star className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                <span className="font-semibold text-amber-400">
                  {selectedAnime.rating > 0 ? `${Number(selectedAnime.rating).toFixed(1)}/10` : t('catalog.unrated')}
                </span>
              </div>
              {(selectedAnime.anilistId && selectedAnime.anilistId > 0) || selectedAnime.malId || selectedAnime.kitsuId ? (
                <a
                  href={
                    selectedTracker === 'KITSU' && selectedAnime.kitsuId
                      ? `https://kitsu.app/anime/${selectedAnime.kitsuId}`
                      : selectedTracker === 'MAL' && selectedAnime.malId
                      ? `https://myanimelist.net/anime/${selectedAnime.malId}`
                      : selectedAnime.anilistId && selectedAnime.anilistId > 0
                      ? `https://anilist.co/anime/${selectedAnime.anilistId}`
                      : selectedAnime.malId
                      ? `https://myanimelist.net/anime/${selectedAnime.malId}`
                      : `https://kitsu.app/anime/${selectedAnime.kitsuId}`
                  }
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] text-[#01bcf3] hover:underline flex items-center gap-1 font-medium"
                >
                  <span>
                    {selectedTracker === 'KITSU' && selectedAnime.kitsuId
                      ? 'Kitsu'
                      : selectedTracker === 'MAL' && selectedAnime.malId
                      ? 'MyAnimeList'
                      : selectedAnime.anilistId && selectedAnime.anilistId > 0
                      ? 'AniList'
                      : selectedAnime.malId
                      ? 'MyAnimeList'
                      : 'Kitsu'}
                  </span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              ) : (
                <Link
                  href={`/mappings?search=${encodeURIComponent(selectedAnime.title)}`}
                  className="text-[11px] text-amber-400 hover:underline flex items-center gap-1 font-medium"
                  title={t('catalog.unlinkedTrackerHint')}
                >
                  <span>Local</span>
                  <Sliders className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>

        {/* Compact synopsis on mobile */}
        {selectedAnime.description && (
          <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
            {selectedAnime.description}
          </p>
        )}
      </div>

      {/* 1. COLUMNA IZQUIERDA COMPLETA EN DESKTOP (lg:col-span-4) */}
      <div className="hidden lg:flex lg:col-span-4 p-5 space-y-3.5 border-r border-[var(--glass-border)] flex-col justify-start bg-[var(--bg-surface)] overflow-y-auto shrink-0">
        {/* Centered cover with Status Badge in top corner */}
        <div className="relative w-full aspect-[3/4] mx-auto rounded-[6px] overflow-hidden border border-[var(--border-subtle)] shadow-md bg-[var(--bg-app)] shrink-0 group">
          <img
            src={selectedAnime.coverUrl}
            alt={selectedAnime.title}
            width={300}
            height={400}
            className="w-full h-full object-cover"
          />

          {/* Badge de Estado Flotante */}
          <div className="absolute top-2.5 left-2.5 z-10">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[6px] text-xs font-bold shadow-lg backdrop-blur-md border select-none ${
                getStatusBadge(selectedAnime.status).badgeClass
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${getStatusBadge(selectedAnime.status).dotClass} animate-pulse`} />
              <span>{getStatusBadge(selectedAnime.status).label}</span>
            </span>
          </div>
        </div>

        {/* Titles and Metadata (Centered) */}
        <div className="space-y-1 text-center">
          <h2 className="font-bold text-base leading-snug text-[var(--text-primary)] font-heading line-clamp-2">
            {selectedAnime.title}
          </h2>
          {selectedAnime.romajiTitle && selectedAnime.romajiTitle !== selectedAnime.title && (
            <p className="text-[11px] text-[var(--text-muted)] line-clamp-1">{selectedAnime.romajiTitle}</p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {selectedAnime.format && (
              <span className="badge-pill text-[11px]">
                {selectedAnime.format}
              </span>
            )}
            {selectedAnime.season && (
              <span className="badge-pill text-[11px]">
                {selectedAnime.season}
              </span>
            )}
            <span className="badge-pill text-[11px] text-[#01bcf3]">
              {t('catalog.seasonN', { n: getSeasonNumber(selectedAnime) })}
            </span>
          </div>
        </div>

        {/* RATING */}
        <div className="w-full flex flex-col items-center justify-center gap-1 py-0.5 text-center">
          <div className="flex items-center justify-center gap-2 text-xs">
            <span className="text-[var(--text-secondary)] font-medium">{t('catalog.rating')}</span>
            <span className="font-semibold text-amber-400 flex items-center gap-1">
              {hoverRating !== null
                ? `${hoverRating.toFixed(1)} / 10`
                : selectedAnime.rating > 0
                ? `${Number(selectedAnime.rating).toFixed(1)} / 10`
                : t('catalog.unrated')}
              {savingRating && <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />}
            </span>
          </div>

          <div className="py-0.5 flex justify-center">
            {renderFiveStarWidget(selectedAnime.rating || 0)}
          </div>

          <button
            type="button"
            onClick={(e) => handleToggleFavorite(selectedAnime, e)}
            className={`mt-1.5 w-full py-1.5 px-3 rounded-[6px] text-xs font-semibold border transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              favoritesList.includes(String(selectedAnime.anilistId || selectedAnime.malId || selectedAnime.kitsuId || selectedAnime.id))
                ? 'bg-amber-500/15 border-amber-500/30 text-amber-400 shadow-sm'
                : 'bg-[var(--bg-app)] border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-amber-400 hover:border-amber-500/30'
            }`}
          >
            <Star className={`w-3.5 h-3.5 ${favoritesList.includes(String(selectedAnime.anilistId || selectedAnime.malId || selectedAnime.kitsuId || selectedAnime.id)) ? 'fill-amber-400 text-amber-400' : ''}`} />
            <span>{favoritesList.includes(String(selectedAnime.anilistId || selectedAnime.malId || selectedAnime.kitsuId || selectedAnime.id)) ? t('catalog.inYourFavourites') : t('catalog.addToFavouritesTitle')}</span>
          </button>
        </div>

        {/* Genres */}
        {selectedAnime.genres && selectedAnime.genres.length > 0 && (
          <div className="flex flex-wrap justify-center gap-1">
            {selectedAnime.genres.slice(0, 4).map((g: string) => (
              <span
                key={g}
                className="badge-pill text-[10.5px] py-0.5 px-2"
              >
                {g}
              </span>
            ))}
          </div>
        )}

        {/* Sinopsis */}
        {selectedAnime.description && (
          <p className="text-[11.5px] leading-relaxed text-[var(--text-secondary)] max-h-24 overflow-y-auto pr-1">
            {selectedAnime.description}
          </p>
        )}

        {/* Open in Tracker or Map if Local Button */}
        {(selectedAnime.anilistId && selectedAnime.anilistId > 0) || selectedAnime.malId || selectedAnime.kitsuId ? (
          <a
            href={
              selectedTracker === 'KITSU' && selectedAnime.kitsuId
                ? `https://kitsu.app/anime/${selectedAnime.kitsuId}`
                : selectedTracker === 'MAL' && selectedAnime.malId
                ? `https://myanimelist.net/anime/${selectedAnime.malId}`
                : selectedAnime.anilistId && selectedAnime.anilistId > 0
                ? `https://anilist.co/anime/${selectedAnime.anilistId}`
                : selectedAnime.malId
                ? `https://myanimelist.net/anime/${selectedAnime.malId}`
                : `https://kitsu.app/anime/${selectedAnime.kitsuId}`
            }
            target="_blank"
            rel="noreferrer"
            className="btn-secondary w-full text-xs mt-auto flex items-center justify-center gap-2 py-2"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>
              {selectedTracker === 'KITSU' && selectedAnime.kitsuId
                ? t('catalog.viewOnKitsu')
                : selectedTracker === 'MAL' && selectedAnime.malId
                ? t('catalog.viewOnMal')
                : selectedAnime.anilistId && selectedAnime.anilistId > 0
                ? t('mappings.viewOnAniList')
                : selectedAnime.malId
                ? t('catalog.viewOnMal')
                : t('catalog.viewOnKitsu')}
            </span>
          </a>
        ) : (
          <Link
            href={`/mappings?search=${encodeURIComponent(selectedAnime.title)}`}
            className="btn-secondary w-full text-xs mt-auto flex items-center justify-center gap-2 py-2 text-amber-400 border-amber-500/30 hover:border-amber-500/50"
            title={t('catalog.unlinkedTrackerHint')}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{t('catalog.localRecordLinkToTracker')}</span>
          </Link>
        )}
      </div>
    </>
  );
}
