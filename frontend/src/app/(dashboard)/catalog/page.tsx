'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { onVisibleInterval } from '@/lib/visibleInterval';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { CatalogHeader } from './_components/CatalogHeader';
import { CatalogContent } from './_components/CatalogContent';
import { AnimeDetailModal } from './_components/AnimeDetailModal';
import { useCatalogStatus } from './_components/useCatalogStatus';

export default function CatalogPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [catalogResponse, setCatalogResponse] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<any | null>(null);
  
  // User Personal Stats & Favorites (Autonomous Tracker)
  const [favoritesList, setFavoritesList] = useState<string[]>([]);
  
  // Tracker Selector & Pagination and Filters (32 items = 4 full rows x 8 columns on desktop)
  const [selectedTracker, setSelectedTracker] = useState<'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL'>('ANILIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  // Grid or list.
  const [catalogView, setCatalogView] = useState<'grid' | 'list'>('grid');

  // Sequence number of last catalog request launched.
  //
  // Opening page launches two: default tracker and, as soon as
  // ?tracker= is read from URL, selected one. If first took longer,
  // it arrived later and overwrote the correct one: tab showed "Local" and grid
  // displayed empty AniList catalog. Same happened when switching tabs
  // quickly. Each response checks it is still the latest before applying
  // pintarse.
  const catalogRequest = useRef(0);
  const itemsPerPage = 32;

  // Load user stats and favorites
  const loadUserStats = async () => {
    try {
      const favs = await api.catalog.getFavorites();
      if (Array.isArray(favs)) {
        setFavoritesList(favs.map((f: any) => String(f.animeId)));
      }
    } catch {}
  };

  // Load saved density, tracker, and filters from URL or localStorage
  useEffect(() => {
    loadUserStats();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTracker = params.get('tracker');
      const urlStatus = params.get('status');

      // 'LOCAL' is not persisted: only valid in URL, as a request for this visit.
      const saved = localStorage.getItem('plexsync_catalog_tracker');
      if (saved === 'LOCAL') {
        localStorage.removeItem('plexsync_catalog_tracker');
      }

      const savedTracker = urlTracker || (saved === 'LOCAL' ? null : saved);
      if (savedTracker === 'ANILIST' || savedTracker === 'MAL' || savedTracker === 'KITSU' || savedTracker === 'LOCAL') {
        setSelectedTracker(savedTracker as any);
      }

      const savedFilter = urlStatus || localStorage.getItem('plexsync_catalog_status_filter');
      if (savedFilter && ['ALL', 'CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED_DROPPED', 'PAUSED', 'DROPPED', 'FAVORITES'].includes(savedFilter)) {
        setStatusFilter(savedFilter);
      }

      const view = localStorage.getItem('plexsync_catalog_view');
      if (view === 'grid' || view === 'list') {
        setCatalogView(view);
      }
    }
  }, []);

  const toggleView = () => {
    const next = catalogView === 'grid' ? 'list' : 'grid';
    setCatalogView(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexsync_catalog_view', next);
    }
  };

  const catalogTopRef = useRef<HTMLDivElement>(null);

  // Debounce for live search without saturating calls
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Load catalog whenever page, filter, search, or tracker changes
  useEffect(() => {
    loadCatalog(currentPage, statusFilter, debouncedSearch, selectedTracker);
  }, [currentPage, statusFilter, debouncedSearch, selectedTracker]);

  // The tracker was busy and an older list is shown (staleSince): asked again every minute,
  // quietly, while the tab is visible, until a fresh one arrives.
  useEffect(() => {
    if (!catalogResponse?.staleSince) return;
    return onVisibleInterval(
      () => loadCatalog(currentPage, statusFilter, debouncedSearch, selectedTracker, false, true),
      65_000,
    );
    // Every new list (a new page, filter or tracker included) is a new catalogResponse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catalogResponse]);

  const handleToggleFavorite = async (anime: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const animeId = String(anime.anilistId || anime.malId || anime.kitsuId || anime.id);
    const isCurrentlyFav = favoritesList.includes(animeId);

    // Immediate optimistic update
    if (isCurrentlyFav) {
      setFavoritesList((prev) => prev.filter((id) => id !== animeId));
    } else {
      setFavoritesList((prev) => [...prev, animeId]);
    }

    try {
      const res = await api.catalog.toggleFavorite({
        animeId,
        title: anime.title || anime.romajiTitle || 'Anime',
        coverUrl: anime.coverUrl,
        genres: anime.genres || [],
      });
      showToast(
        res.isFavorite ? t('catalog.favoriteAdded', { title: anime.title }) : t('catalog.favoriteRemoved', { title: anime.title }),
        res.isFavorite ? 'success' : 'info',
      );
      loadUserStats();
    } catch (err: any) {
      // Revertir optimismo
      if (isCurrentlyFav) {
        setFavoritesList((prev) => [...prev, animeId]);
      } else {
        setFavoritesList((prev) => prev.filter((id) => id !== animeId));
      }
      showToast(`${t('catalog.updateFavouritesError')} ` + err.message, 'error');
    }
  };

  const loadCatalog = async (
    page = 1,
    status = 'ALL',
    search = '',
    tracker = selectedTracker,
    forceRefresh = false,
    quiet = false,
  ) => {
    const myRequest = ++catalogRequest.current;
    try {
      if (!quiet) setLoading(true);
      const isFavFilter = status === 'FAVORITES';
      const res = await api.catalog.getUser({
        page: isFavFilter ? 1 : page,
        limit: isFavFilter ? 100 : itemsPerPage,
        status: isFavFilter ? 'ALL' : status,
        search,
        provider: tracker,
        forceRefresh,
      });

      let items = res.items || [];
      if (isFavFilter) {
        items = items.filter((item: any) => {
          const id = String(item.anilistId || item.malId || item.kitsuId || item.id);
          return favoritesList.includes(id);
        });
      }

      // Stale response: something else was requested afterwards. Discarded without
      // touching state or turning off loading indicator, handled by the
      // request that remains active.
      if (myRequest !== catalogRequest.current) return;

      setCatalogResponse(res);
      setCatalog(items);
      return res;

      // Backend is authority on active tracker, including 'LOCAL'
      // when none is linked.
      if (res.activeProvider && res.activeProvider !== tracker) {
        setSelectedTracker(res.activeProvider);
      }
    } catch (e: any) {
      if (myRequest !== catalogRequest.current) return;
      showToast(`${t('catalog.loadCatalogueError')} ` + e.message, 'error');
      setCatalog([]);
    } finally {
      if (myRequest === catalogRequest.current) setLoading(false);
    }
  };

  const trackerName = selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? t('catalog.localBase') : 'AniList';
  const staleNotice = (since: string) =>
    t('catalog.staleList', { tracker: trackerName, minutes: Math.max(1, Math.round((Date.now() - Date.parse(since)) / 60_000)) });

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const [res] = await Promise.all([
        loadCatalog(currentPage, statusFilter, debouncedSearch, selectedTracker, true),
        loadUserStats(),
      ]);
      // "Synced" only when a fresh list arrived: a failed load already said so, and a busy
      // tracker leaves the previous list on screen.
      if (res?.staleSince) showToast(staleNotice(res.staleSince), 'info');
      else if (res) showToast(t('catalog.syncedFromTracker', { tracker: trackerName }), 'success');
    } catch (e: any) {
      showToast(`${t('catalog.refreshCatalogueError')} ` + e.message, 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    if (newPage === currentPage) return;
    setCurrentPage(newPage);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('plexsync_catalog_page', String(newPage));
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(newPage));
      window.history.replaceState({}, '', url.toString());
    }
    if (catalogTopRef.current) {
      catalogTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const { getStatusIcon, getStatusBadge, getSeasonNumber } = useCatalogStatus();

  // Identify actual provider connectivity from backend response
  const isPlexServerConnected = !!catalogResponse?.providers?.plex?.isConnected;
  const isJellyfinServerConnected = !!catalogResponse?.providers?.jellyfin?.isConnected;
  const isEmbyServerConnected = !!catalogResponse?.providers?.emby?.isConnected;
  const isAnilistActive = !!catalogResponse?.providers?.anilist?.isConnected;
  const isMalActive = !!catalogResponse?.providers?.mal?.isConnected;
  const isKitsuActive = !!catalogResponse?.providers?.kitsu?.isConnected;

  const pagination = catalogResponse?.pagination || {
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    filteredItems: 0,
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar
        rootLabel={t('navigation.userLibrary')}
        currentLabel={
          selectedTracker === 'MAL'
            ? t('catalog.catalogueMal')
            : selectedTracker === 'KITSU'
            ? t('catalog.catalogueKitsu')
            : selectedTracker === 'LOCAL'
            ? t('catalog.catalogueLocal')
            : t('catalog.catalogueAniList')
        }
        onRefresh={handleRefresh}
        isRefreshing={refreshing}
      />

      {/* HEADER & FILTERS (STATIC ON MOBILE, STICKY ON DESKTOP) */}
      <CatalogHeader
        catalogResponse={catalogResponse}
        selectedTracker={selectedTracker}
        setSelectedTracker={setSelectedTracker}
        pagination={pagination}
        catalogView={catalogView}
        toggleView={toggleView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        handleRefresh={handleRefresh}
        refreshing={refreshing}
        loading={loading}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        setCurrentPage={setCurrentPage}
        isAnilistActive={isAnilistActive}
        isMalActive={isMalActive}
        isKitsuActive={isKitsuActive}
      />

      {/* MAIN SCROLLABLE CONTAINER */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-7 min-w-0" ref={catalogTopRef}>
        {catalogResponse?.staleSince && (
          <p
            role="status"
            className="flex items-center gap-2 p-3 rounded-[var(--radius-md)] bg-[var(--status-warning-bg)] border border-[var(--status-warning)]/30 text-sm text-[var(--text-primary)]"
          >
            <Loader2 className="w-4 h-4 shrink-0 animate-spin text-[var(--status-warning)]" aria-hidden="true" />
            {staleNotice(catalogResponse.staleSince)}
          </p>
        )}
        <CatalogContent
          loading={loading}
          catalogResponse={catalogResponse}
          catalog={catalog}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          catalogView={catalogView}
          setSelectedAnime={setSelectedAnime}
          getStatusBadge={getStatusBadge}
          getStatusIcon={getStatusIcon}
          getSeasonNumber={getSeasonNumber}
          handleToggleFavorite={handleToggleFavorite}
          favoritesList={favoritesList}
          pagination={pagination}
          currentPage={currentPage}
          itemsPerPage={itemsPerPage}
          handlePageChange={handlePageChange}
        />
      </main>

      {/* SEMI-TRANSPARENT TEMPERED GLASS MODAL (FULLY RESPONSIVE ON MOBILE AND DESKTOP) */}
      {selectedAnime && (
        <AnimeDetailModal
          selectedAnime={selectedAnime}
          setSelectedAnime={setSelectedAnime}
          catalog={catalog}
          setCatalog={setCatalog}
          selectedTracker={selectedTracker}
          getStatusBadge={getStatusBadge}
          getSeasonNumber={getSeasonNumber}
          handleToggleFavorite={handleToggleFavorite}
          favoritesList={favoritesList}
          catalogResponse={catalogResponse}
          isJellyfinServerConnected={isJellyfinServerConnected}
          isEmbyServerConnected={isEmbyServerConnected}
          isPlexServerConnected={isPlexServerConnected}
          isAnilistActive={isAnilistActive}
          isMalActive={isMalActive}
          isKitsuActive={isKitsuActive}
        />
      )}
    </div>
  );
}
