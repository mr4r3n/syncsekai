'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useModalA11y } from '@/components/useModalA11y';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { X } from 'lucide-react';
import { AnimeModalSidebar } from './AnimeModalSidebar';
import { AnimeModalSeasonsBar } from './AnimeModalSeasonsBar';
import { AnimeModalEpisodes } from './AnimeModalEpisodes';
import { AnimeModalSyncFooter } from './AnimeModalSyncFooter';
import { syncOutcome } from './syncOutcome';

interface AnimeDetailModalProps {
  selectedAnime: any;
  setSelectedAnime: (anime: any | null) => void;
  catalog: any[];
  setCatalog: React.Dispatch<React.SetStateAction<any[]>>;
  selectedTracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL';
  getStatusBadge: (status: string) => any;
  getSeasonNumber: (anime: any) => number;
  handleToggleFavorite: (anime: any, e?: React.MouseEvent) => void;
  favoritesList: string[];
  catalogResponse: any;
  isJellyfinServerConnected: boolean;
  isEmbyServerConnected: boolean;
  isPlexServerConnected: boolean;
  isAnilistActive: boolean;
  isMalActive: boolean;
  isKitsuActive: boolean;
}

export function AnimeDetailModal({
  selectedAnime,
  setSelectedAnime,
  catalog,
  setCatalog,
  selectedTracker,
  getStatusBadge,
  getSeasonNumber,
  handleToggleFavorite,
  favoritesList,
  catalogResponse,
  isJellyfinServerConnected,
  isEmbyServerConnected,
  isPlexServerConnected,
  isAnilistActive,
  isMalActive,
  isKitsuActive,
}: AnimeDetailModalProps) {
  const { showToast } = useToast();
  const { t } = useI18n();

  // Anime sheet: focus inside on open, Tab trapped, and focus returned to card.
  const closeDetail = useCallback(() => setSelectedAnime(null), []);
  const { dialogProps } = useModalA11y(Boolean(selectedAnime), closeDetail);
  const [franchiseSeasons, setFranchiseSeasons] = useState<any[]>([]);
  const [loadingFranchise, setLoadingFranchise] = useState(false);
  const [linkSearchOpen, setLinkSearchOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');

  // Modal Interactive States
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

  const seasonsScrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  const checkSeasonScroll = () => {
    if (seasonsScrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = seasonsScrollRef.current;
      setCanScrollLeft(scrollLeft > 4);
      setCanScrollRight(scrollLeft + clientWidth < scrollWidth - 4);
    }
  };

  const scrollSeasons = (direction: 'left' | 'right') => {
    if (seasonsScrollRef.current) {
      const amount = direction === 'left' ? -220 : 220;
      seasonsScrollRef.current.scrollBy({ left: amount, behavior: 'smooth' });
    }
  };

  // When selecting anime, initialize active season (closed on mobile by default)
  useEffect(() => {
    if (selectedAnime) {
      const activeSeasonIdx = Math.max(0, Number(selectedAnime.seasonNumber || 1) - 1);
      const isMobile = typeof window !== 'undefined' && window.innerWidth < 1024;

      setExpandedSeasons(isMobile ? {} : { [activeSeasonIdx]: true });
      setHoverRating(null);

      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setSelectedAnime(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [selectedAnime]);

  useEffect(() => {
    if (!selectedAnime) {
      setFranchiseSeasons([]);
      setLinkSearchOpen(false);
      setLinkSearchQuery('');
      return;
    }
    const anilistId = Number(selectedAnime.anilistId || 0);
    const malId = Number(selectedAnime.malId || 0);

    const extractBase = (title?: string) => {
      if (!title) return '';
      return title
        .replace(/(?:season|temporada)\s*\d{1,2}/gi, '')
        .replace(/\b(?:\d{1,2}(?:st|nd|rd|th)\s+season|2nd|3rd|4th|5th)\b/gi, '')
        .replace(/\b(?:part|cour)\s*\d{1,2}/gi, '')
        .replace(/\b(?:II|III|IV|V|VI)\b/g, '')
        .replace(/:\s*[^:]+$/g, '')
        .replace(/[^\w\s]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
    };

    // 1. Immediate in-memory detection from loaded catalog for zero lag
    const currentBase = extractBase(selectedAnime.title || selectedAnime.romajiTitle);
    let localMatches: any[] = [selectedAnime];
    if (currentBase.length >= 4 && catalog.length > 0) {
      const found = catalog.filter((c) => {
        const cBase = extractBase(c.title || c.romajiTitle);
        return cBase.length >= 4 && (cBase.includes(currentBase) || currentBase.includes(cBase));
      });
      if (found.length > 0) {
        localMatches = found;
      }
    }
    setFranchiseSeasons(localMatches);

    let cancelled = false;
    setLoadingFranchise(true);
    api.catalog.getFranchise({
      anilistId: anilistId > 0 ? anilistId : undefined,
      malId: malId > 0 ? malId : undefined,
      provider: selectedTracker,
    })
      .then((response) => {
        if (cancelled) return;
        const seasons = response.seasons?.length ? response.seasons : localMatches;
        // Merge with local matches
        const mapById = new Map<string, any>();
        for (const item of localMatches) {
          const key = String(item.anilistId || item.malId || item.id);
          mapById.set(key, item);
        }
        for (const item of seasons) {
          const key = String(item.anilistId || item.malId || item.id);
          mapById.set(key, { ...mapById.get(key), ...item });
        }
        const merged = Array.from(mapById.values());
        setFranchiseSeasons(merged.length > 0 ? merged : [selectedAnime]);
        const resolvedCurrent = merged.find((item: any) =>
          (anilistId > 0 && Number(item.anilistId) === anilistId)
          || (malId > 0 && Number(item.malId) === malId),
        );
        if (resolvedCurrent) setSelectedAnime(resolvedCurrent);
      })
      .catch(() => {
        if (!cancelled) setFranchiseSeasons(localMatches.length > 0 ? localMatches : [selectedAnime]);
      })
      .finally(() => {
        if (!cancelled) setLoadingFranchise(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedAnime?.anilistId, selectedAnime?.malId, selectedAnime?.id, selectedTracker, catalog]);

  useEffect(() => {
    const timer = setTimeout(() => {
      checkSeasonScroll();
    }, 120);
    return () => clearTimeout(timer);
  }, [franchiseSeasons, selectedAnime]);

  // Handle live star rating change (0 to 10 scale) synchronizing all trackers
  const handleRate = async (newScore: number) => {
    if (!selectedAnime) return;
    if (selectedAnime.inUserList === false) {
      showToast(t('catalog.seasonNotOnListOpenTracker', { tracker: selectedTracker === 'MAL' ? 'MyAnimeList' : 'AniList' }), 'info');
      return;
    }
    setSavingRating(true);

    const previous = selectedAnime;
    const updated = { ...selectedAnime, rating: newScore };
    // A rating no tracker took is undone on screen: it must not look saved when it is not.
    const undo = () => {
      setSelectedAnime(previous);
      setCatalog((prev) =>
        prev.map((item) =>
          item.id === previous.id || (item.anilistId && item.anilistId === previous.anilistId)
            ? { ...item, rating: previous.rating }
            : item,
        ),
      );
    };
    setSelectedAnime(updated);
    setCatalog((prev) =>
      prev.map((item) =>
        item.id === selectedAnime.id || (item.anilistId && item.anilistId === selectedAnime.anilistId)
          ? { ...item, rating: newScore }
          : item,
      ),
    );

    try {
      const res = await api.catalog.syncProgress({
        anilistMediaId: selectedAnime.anilistId,
        malMediaId: selectedAnime.malId,
        score: newScore,
        progress: selectedAnime.episodesWatched,
        status: selectedAnime.status,
        showTitle: selectedAnime.title,
        seasonNumber: selectedAnime.seasonNumber,
      });
      const outcome = syncOutcome(res);
      if (outcome.kind === 'synced') {
        showToast(t('catalog.scoreSynced', { score: newScore.toFixed(1), trackers: outcome.trackers }), 'success');
      } else if (outcome.kind === 'syncing') {
        showToast(t('catalog.syncStillRunning'), 'info');
      } else if (outcome.kind === 'local') {
        showToast(t('catalog.savedLocallyOnly'), 'info');
      } else {
        undo();
        showToast(`${t('catalog.saveRatingError')} ${outcome.reason}`, 'error');
      }
    } catch (err: any) {
      undo();
      showToast(`${t('catalog.saveRatingError')} ` + err.message, 'error');
    } finally {
      setSavingRating(false);
    }
  };

  if (!selectedAnime) return null;

  return (
    <div
      onClick={() => setSelectedAnime(null)}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-in fade-in overflow-y-auto cursor-pointer"
    >
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] lg:h-[88vh] lg:max-h-[850px] rounded-t-[16px] sm:rounded-[8px] border border-[var(--glass-border)] overflow-y-auto overscroll-contain shadow-[var(--glass-shadow-lg)] flex flex-col relative backdrop-blur-2xl bg-[var(--glass-bg)] text-[var(--text-primary)] cursor-default my-0 sm:my-auto outline-none"
      >
        {/* Android-style mobile touch handle */}
        <div className="w-12 h-1.5 rounded-full bg-white/25 mx-auto mt-3 mb-1 sm:hidden shrink-0" />

        {/* Floating close button top right */}
        <button
          onClick={() => setSelectedAnime(null)}
          className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-[6px] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors z-30 backdrop-blur-md cursor-pointer"
          title={t('common.closeModal')}
          aria-label={t('common.close')}
        >
          <X className="w-4 h-4" />
        </button>

        {/* MAIN GRID: Flex on mobile, 12 col Grid on desktop */}
        <div className="flex flex-col lg:grid lg:grid-cols-12 flex-1 min-h-0 lg:overflow-hidden">
          <AnimeModalSidebar
            selectedAnime={selectedAnime}
            selectedTracker={selectedTracker}
            getStatusBadge={getStatusBadge}
            getSeasonNumber={getSeasonNumber}
            hoverRating={hoverRating}
            setHoverRating={setHoverRating}
            savingRating={savingRating}
            handleRate={handleRate}
            handleToggleFavorite={handleToggleFavorite}
            favoritesList={favoritesList}
          />

          {/* 2. COLUMNA DERECHA COMPLETA (lg:col-span-8) */}
          <div className="lg:col-span-8 flex flex-col lg:h-full lg:overflow-hidden relative">
            {/* Banner de fondo sutil */}
            {selectedAnime.bannerUrl && (
              <div className="absolute top-0 inset-x-0 h-32 overflow-hidden pointer-events-none opacity-15 hidden sm:block">
                <img
                  src={selectedAnime.bannerUrl}
                  alt={selectedAnime.title}
                  width={1200}
                  height={128}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-[var(--bg-app)]/80 to-[var(--bg-app)]" />
              </div>
            )}

            {/* 2.1 TOP RIGHT HEADER: Progress and Franchise Seasons */}
            <AnimeModalSeasonsBar
              selectedAnime={selectedAnime}
              setSelectedAnime={setSelectedAnime}
              franchiseSeasons={franchiseSeasons}
              setFranchiseSeasons={setFranchiseSeasons}
              loadingFranchise={loadingFranchise}
              linkSearchOpen={linkSearchOpen}
              setLinkSearchOpen={setLinkSearchOpen}
              linkSearchQuery={linkSearchQuery}
              setLinkSearchQuery={setLinkSearchQuery}
              catalog={catalog}
              canScrollLeft={canScrollLeft}
              canScrollRight={canScrollRight}
              scrollSeasons={scrollSeasons}
              seasonsScrollRef={seasonsScrollRef}
              checkSeasonScroll={checkSeasonScroll}
              getSeasonNumber={getSeasonNumber}
            />

            {/* 2.2 EPISODE ACCORDION: Natural flow on mobile, independent scroll on desktop */}
            <AnimeModalEpisodes
              selectedAnime={selectedAnime}
              setSelectedAnime={setSelectedAnime}
              setCatalog={setCatalog}
              selectedTracker={selectedTracker}
              expandedSeasons={expandedSeasons}
              setExpandedSeasons={setExpandedSeasons}
              getSeasonNumber={getSeasonNumber}
            />

            {/* 2.3 MINIMALIST MULTI-PROVIDER SYNC BAR (Always at end of content) */}
            <AnimeModalSyncFooter
              selectedAnime={selectedAnime}
              catalogResponse={catalogResponse}
              isJellyfinServerConnected={isJellyfinServerConnected}
              isEmbyServerConnected={isEmbyServerConnected}
              isPlexServerConnected={isPlexServerConnected}
              isAnilistActive={isAnilistActive}
              isMalActive={isMalActive}
              isKitsuActive={isKitsuActive}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
