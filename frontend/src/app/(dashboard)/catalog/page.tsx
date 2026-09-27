'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
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
  const [userStats, setUserStats] = useState<any>(null);
  const [favoritesList, setFavoritesList] = useState<string[]>([]);
  const [showStatsBar, setShowStatsBar] = useState(true);
  
  // Tracker Selector & Paginación y Filtros (32 items = 4 filas completas x 8 columnas en desktop)
  const [selectedTracker, setSelectedTracker] = useState<'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL'>('ANILIST');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);
  // Rejilla o lista.
  const [vistaCatalogo, setVistaCatalogo] = useState<'grid' | 'list'>('grid');

  // Numero de la ultima peticion de catalogo lanzada.
  //
  // Al abrir la pagina salen dos: la del tracker por defecto y, en cuanto se
  // lee el ?tracker= de la URL, la del elegido. Si la primera tardaba mas,
  // llegaba despues y pisaba a la buena: la pestana decia "Local" y la rejilla
  // mostraba el catalogo vacio de AniList. Pasa igual al cambiar de pestana
  // rapido. Cada respuesta comprueba que sigue siendo la ultima antes de
  // pintarse.
  const peticionCatalogo = useRef(0);
  const itemsPerPage = 32;

  // Cargar estadísticas y favoritos del usuario
  const loadUserStats = async () => {
    try {
      const [stats, favs] = await Promise.all([
        api.catalog.getUserStats(),
        api.catalog.getFavorites(),
      ]);
      setUserStats(stats);
      if (Array.isArray(favs)) {
        setFavoritesList(favs.map((f: any) => String(f.animeId)));
      }
    } catch {}
  };

  // Cargar densidad, tracker y filtros guardados desde URL o localStorage
  useEffect(() => {
    loadUserStats();
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const urlTracker = params.get('tracker');
      const urlStatus = params.get('status');

      // 'LOCAL' no se persiste: sólo vale en la URL, como petición para esta visita.
      const guardado = localStorage.getItem('plexsync_catalog_tracker');
      if (guardado === 'LOCAL') {
        localStorage.removeItem('plexsync_catalog_tracker');
      }

      const savedTracker = urlTracker || (guardado === 'LOCAL' ? null : guardado);
      if (savedTracker === 'ANILIST' || savedTracker === 'MAL' || savedTracker === 'KITSU' || savedTracker === 'LOCAL') {
        setSelectedTracker(savedTracker as any);
      }

      const savedFilter = urlStatus || localStorage.getItem('plexsync_catalog_status_filter');
      if (savedFilter && ['ALL', 'CURRENT', 'COMPLETED', 'PLANNING', 'PAUSED_DROPPED', 'PAUSED', 'DROPPED', 'FAVORITES'].includes(savedFilter)) {
        setStatusFilter(savedFilter);
      }

      const vista = localStorage.getItem('plexsync_catalog_view');
      if (vista === 'grid' || vista === 'list') {
        setVistaCatalogo(vista);
      }
    }
  }, []);

  const alternarVista = () => {
    const siguiente = vistaCatalogo === 'grid' ? 'list' : 'grid';
    setVistaCatalogo(siguiente);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexsync_catalog_view', siguiente);
    }
  };

  const catalogTopRef = useRef<HTMLDivElement>(null);

  // Debounce para búsqueda en vivo sin saturar llamadas
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Cargar catálogo cada vez que cambie la página, filtro, búsqueda o tracker
  useEffect(() => {
    loadCatalog(currentPage, statusFilter, debouncedSearch, selectedTracker);
  }, [currentPage, statusFilter, debouncedSearch, selectedTracker]);

  const handleToggleFavorite = async (anime: any, e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    const animeId = String(anime.anilistId || anime.malId || anime.kitsuId || anime.id);
    const isCurrentlyFav = favoritesList.includes(animeId);

    // Actualización optimista inmediata
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
        res.isFavorite ? `★ "${anime.title}" añadido a tus Favoritos` : `"${anime.title}" removido de Favoritos`,
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
  ) => {
    const miPeticion = ++peticionCatalogo.current;
    try {
      setLoading(true);
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

      // Respuesta obsoleta: ya se pidio otra cosa despues. Se descarta sin
      // tocar el estado ni apagar el indicador de carga, que le toca a la
      // peticion que si sigue vigente.
      if (miPeticion !== peticionCatalogo.current) return;

      setCatalogResponse(res);
      setCatalog(items);

      // El backend es la autoridad sobre qué tracker está activo, incluido 'LOCAL'
      // cuando no hay ninguno vinculado.
      if (res.activeProvider && res.activeProvider !== tracker) {
        setSelectedTracker(res.activeProvider);
      }
    } catch (e: any) {
      if (miPeticion !== peticionCatalogo.current) return;
      showToast(`${t('catalog.loadCatalogueError')} ` + e.message, 'error');
      setCatalog([]);
    } finally {
      if (miPeticion === peticionCatalogo.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        loadCatalog(currentPage, statusFilter, debouncedSearch, selectedTracker, true),
        loadUserStats(),
      ]);
      showToast(
        `Catálogo sincronizado con éxito desde ${
          selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? 'Base Local' : 'AniList'
        }`,
        'success',
      );
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

  // Identificar conectividad real de proveedores desde la respuesta del backend
  const isPlexServerConnected = !!catalogResponse?.providers?.plex?.isConnected;
  const isJellyfinServerConnected = !!catalogResponse?.providers?.jellyfin?.isConnected;
  const isEmbyServerConnected = !!catalogResponse?.providers?.emby?.isConnected;
  const isAnilistActive = !!catalogResponse?.providers?.anilist?.isConnected;
  const isMalActive = !!catalogResponse?.providers?.mal?.isConnected;
  const isKitsuActive = !!catalogResponse?.providers?.kitsu?.isConnected;
  const connectedTrackersCount = [isAnilistActive, isMalActive, isKitsuActive].filter(Boolean).length;
  const hasMultipleTrackers = connectedTrackersCount > 1;

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

      {/* HEADER & FILTROS (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <CatalogHeader
        catalogResponse={catalogResponse}
        selectedTracker={selectedTracker}
        setSelectedTracker={setSelectedTracker}
        pagination={pagination}
        vistaCatalogo={vistaCatalogo}
        alternarVista={alternarVista}
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

      {/* CONTENEDOR PRINCIPAL CON SCROLL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-7 min-w-0" ref={catalogTopRef}>
        <CatalogContent
          loading={loading}
          catalogResponse={catalogResponse}
          catalog={catalog}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          vistaCatalogo={vistaCatalogo}
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

      {/* MODAL SEMITRANSPARENTE VIDRIO TEMPLADO (TOTALMENTE RESPONSIVE EN MÓVIL Y DESKTOP) */}
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
