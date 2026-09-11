'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '@/lib/api';
import { useModalA11y } from '@/components/useModalA11y';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Search,
  Star,
  ExternalLink,
  Play,
  X,
  Plus,
  RefreshCw,
  Loader2,
  Tv,
  Sparkles,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Check,
  Circle,
  Database,
  Sliders,
  List,
  LayoutGrid,
  Eye,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import { CustomSelect } from '@/components/CustomSelect';
import { ListRow, ListRows, ListRowsHeader } from '@/components/ListRow';

/*
 * Reparto de las columnas de la vista de lista.
 *
 * "TV" y "T2" miden veinte pixeles y "Local Library" noventa: con todas las
 * columnas iguales, las cortas se quedaban con setenta pixeles de aire dentro.
 */
const PLANTILLA_COLUMNAS_CATALOGO = '1.2fr 0.7fr 0.8fr 0.8fr 0.7fr 1.4fr';

export default function CatalogPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [catalogResponse, setCatalogResponse] = useState<any>(null);
  const [catalog, setCatalog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedAnime, setSelectedAnime] = useState<any | null>(null);
  // Ficha de anime: foco dentro al abrir, Tab acotado y foco devuelto a la tarjeta.
  const cerrarFicha = useCallback(() => setSelectedAnime(null), []);
  const { dialogProps } = useModalA11y(Boolean(selectedAnime), cerrarFicha);
  const [franchiseSeasons, setFranchiseSeasons] = useState<any[]>([]);
  const [loadingFranchise, setLoadingFranchise] = useState(false);
  const [linkSearchOpen, setLinkSearchOpen] = useState(false);
  const [linkSearchQuery, setLinkSearchQuery] = useState('');
  
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

  const handleTrackerChange = (tracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL') => {
    setSelectedTracker(tracker);
    if (typeof window !== 'undefined') {
      /*
       * "Local" no se recuerda entre visitas, y los trackers si.
       *
       * Local no es un destino, es lo que queda cuando no hay tracker
       * vinculado, o un vistazo puntual a lo que hay en la base sin pasar por
       * nadie. Guardado como preferencia se quedaba fijo para siempre: quien lo
       * hubiera pulsado una vez -o quien lo tuviera de cuando aun no habia
       * vinculado nada- entraba al catalogo en Local aunque tuviera AniList
       * conectado, y sin ninguna pista de que eso era una eleccion suya y no un
       * fallo de deteccion. Al no guardarlo, la siguiente visita vuelve al
       * tracker, que es lo que espera cualquiera.
       */
      if (tracker === 'LOCAL') {
        localStorage.removeItem('plexsync_catalog_tracker');
      } else {
        localStorage.setItem('plexsync_catalog_tracker', tracker);
      }
      const url = new URL(window.location.href);
      url.searchParams.set('tracker', tracker);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Rejilla: 2 -> 3 -> 4 -> 5 -> 6 -> 8 columnas segun el ancho.
  // El nombre de la cuenta del catalogo, que se pinta en dos sitios segun el
  // ancho: una sola fuente para las dos.
  const nombreCuentaCatalogo =
    catalogResponse?.username ||
    (selectedTracker === 'MAL'
      ? 'MyAnimeList'
      : selectedTracker === 'KITSU'
      ? 'Kitsu'
      : selectedTracker === 'LOCAL'
      ? t('catalog.localTracker')
      : 'AniList');

  const getGridClass = () =>
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-3.5';

  // Modal Interactive States
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [savingRating, setSavingRating] = useState(false);
  const [syncingEpisode, setSyncingEpisode] = useState<number | null>(null);
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

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

  // Al seleccionar un anime, inicializar la temporada activa (cerrado en móvil por defecto)
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

    // 1. Detección inmediata en memoria desde el catálogo cargado para cero lag
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
        // Merge con coincidencias locales
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

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('plexsync_catalog_page', '1');
      localStorage.setItem('plexsync_catalog_status_filter', newStatus);
      const url = new URL(window.location.href);
      url.searchParams.set('status', newStatus);
      url.searchParams.set('page', '1');
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Manejar cambio de calificación con estrellas en vivo (escala 0 a 10) sincronizando todos los trackers
  const handleRate = async (newScore: number) => {
    if (!selectedAnime) return;
    if (selectedAnime.inUserList === false) {
      showToast(`Esta temporada todavía no está en tu lista. Ábrela en ${selectedTracker === 'MAL' ? 'MyAnimeList' : 'AniList'} para añadirla primero.`, 'info');
      return;
    }
    setSavingRating(true);

    const updated = { ...selectedAnime, rating: newScore };
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
      const trackersMsg = res?.updatedTrackers?.length > 0
        ? res.updatedTrackers.join(' y ')
        : (selectedTracker === 'MAL' ? 'MyAnimeList' : 'AniList');
      showToast(`¡Calificación (${newScore.toFixed(1)}/10) sincronizada en ${trackersMsg}!`, 'success');
    } catch (err: any) {
      showToast(`${t('catalog.saveRatingError')} ` + err.message, 'error');
    } finally {
      setSavingRating(false);
    }
  };

  // Manejar sincronización de un episodio específico en todos los trackers
  const handleSyncEpisode = async (epNumber: number) => {
    if (!selectedAnime) return;
    if (selectedAnime.inUserList === false) {
      showToast(`Esta temporada todavía no está en tu lista. Ábrela en ${selectedTracker === 'MAL' ? 'MyAnimeList' : 'AniList'} para añadirla primero.`, 'info');
      return;
    }
    setSyncingEpisode(epNumber);

    const total = selectedAnime.episodesTotal || 0;
    const isCompleted = total > 0 && epNumber >= total;
    const newStatus = isCompleted ? 'COMPLETED' : 'CURRENT';
    const newPct = total > 0 ? Math.min(100, Math.round((epNumber / total) * 100)) : 100;

    const updated = {
      ...selectedAnime,
      episodesWatched: epNumber,
      progressPercentage: newPct,
      status: newStatus,
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
      const trackersMsg = res?.updatedTrackers?.length > 0
        ? res.updatedTrackers.join(' y ')
        : (selectedTracker === 'MAL' ? 'MyAnimeList' : 'AniList');
      showToast(`¡Episodio ${epNumber} sincronizado en ${trackersMsg}!`, 'success');
    } catch (err: any) {
      showToast(`${t('catalog.syncEpisodeError')} ` + err.message, 'error');
    } finally {
      setSyncingEpisode(null);
    }
  };

  const toggleSeason = (seasonIdx: number) => {
    setExpandedSeasons((prev) => {
      const isCurrentlyExpanded = !!prev[seasonIdx];
      return isCurrentlyExpanded ? {} : { [seasonIdx]: true };
    });
  };

  /**
   * Icono de cada estado. En la lista el estado va como icono y no como
   * texto: "Completed" gastaba 75 de los 375 px de una fila estrecha, y el
   * dato cabe en un simbolo. El nombre sigue en el title y en la etiqueta
   * accesible, asi que no se pierde para quien no interpreta el icono.
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CURRENT':
        return Eye;
      case 'COMPLETED':
        return CheckCircle2;
      case 'PLANNING':
        return Clock;
      case 'PAUSED':
        return PauseCircle;
      case 'DROPPED':
        return XCircle;
      default:
        return Circle;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CURRENT':
        return {
          label: t('catalog.statusWatching'),
          className: 'bg-sky-500/15 text-sky-500 dark:text-sky-400 border-sky-500/30',
          badgeClass: 'bg-sky-950/85 text-sky-300 border-sky-500/40 shadow-[0_4px_14px_rgba(56,189,248,0.25)]',
          dotClass: 'bg-[#02a9ff] shadow-[0_0_8px_#02a9ff]',
          text: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.35)',
        };
      case 'COMPLETED':
        return {
          label: t('catalog.statusCompleted'),
          className: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30',
          badgeClass: 'bg-emerald-950/85 text-emerald-300 border-emerald-500/40 shadow-[0_4px_14px_rgba(16,185,129,0.25)]',
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
          text: '#34d399',
          border: 'rgba(16, 185, 129, 0.35)',
        };
      case 'PLANNING':
        return {
          label: t('catalog.statusPlanning'),
          className: 'bg-purple-500/15 text-purple-500 dark:text-purple-400 border-purple-500/30',
          badgeClass: 'bg-purple-950/85 text-purple-300 border-purple-500/40 shadow-[0_4px_14px_rgba(168,85,247,0.25)]',
          dotClass: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
          text: '#c084fc',
          border: 'rgba(168, 85, 247, 0.35)',
        };
      case 'PAUSED':
        return {
          label: t('catalog.statusPaused'),
          className: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30',
          badgeClass: 'bg-amber-950/85 text-amber-300 border-amber-500/40 shadow-[0_4px_14px_rgba(245,158,11,0.25)]',
          dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
          text: '#fbbf24',
          border: 'rgba(245, 158, 11, 0.35)',
        };
      case 'DROPPED':
        return {
          label: t('catalog.statusDropped'),
          className: 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30',
          badgeClass: 'bg-rose-950/85 text-rose-300 border-rose-500/40 shadow-[0_4px_14px_rgba(239,68,68,0.25)]',
          dotClass: 'bg-rose-400 shadow-[0_0_8px_#f87171]',
          text: '#f87171',
          border: 'rgba(239, 68, 68, 0.35)',
        };
      case 'NOT_IN_LIST':
        return {
          label: t('catalog.statusNotInList'),
          className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
          badgeClass: 'bg-zinc-950/85 text-zinc-300 border-zinc-600/50 shadow-md',
          dotClass: 'bg-zinc-400',
          text: '#a1a1aa',
          border: 'rgba(161, 161, 170, 0.3)',
        };
      default:
        return {
          label: status || 'Desconocido',
          className: 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
          badgeClass: 'bg-zinc-900/85 text-zinc-300 border-zinc-700/50 shadow-md',
          dotClass: 'bg-zinc-400',
          text: '#a1a1aa',
          border: 'rgba(255, 255, 255, 0.15)',
        };
    }
  };

  const getSeasonNumber = (anime: any) => {
    if (Number(anime?.seasonNumber) > 0) return Number(anime.seasonNumber);
    const title = [anime?.title, anime?.romajiTitle, anime?.englishTitle].filter(Boolean).join(' ');
    const match = title.match(/(?:season|temporada)\s*(\d{1,2})\b/i)
      || title.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i)
      || title.match(/\bpart\s*(\d{1,2})\b/i);
    return match ? Number(match[1]) : 1;
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
      subtitle: total > 0 ? `Episodios 1 a ${total}` : t('catalog.episodesToConfirm'),
      episodes,
      watchedCount: watched,
      totalCount: total,
      progressPct: total > 0 ? Math.round((watched / total) * 100) : 0,
    }];
  };

  // Helper para renderizar las 5 estrellas con soporte de decimales (0 a 10)
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

              {/* Estrella de Fondo (Gris / Vacía) */}
              <Star className="w-4 h-4 text-zinc-600 absolute inset-0 m-auto transition-transform group-hover:scale-120" />

              {/* Estrella Rellena Parcial o Completa (Ámbar con Glow) */}
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

  const counts = catalogResponse?.counts || {
    all: 0,
    watching: 0,
    completed: 0,
    planning: 0,
    paused: 0,
    dropped: 0,
  };

  // Renderizador de números de página inteligente
  const renderPaginationButtons = () => {
    const totalPages = pagination.totalPages || 1;
    const current = currentPage;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      
      if (current < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handlePageChange(1)}
          disabled={current <= 1 || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.firstPage')}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => handlePageChange(current - 1)}
          disabled={current <= 1 || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.previousPage')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="px-2 text-[var(--text-muted)] font-mono text-sm select-none">
                ...
              </span>
            );
          }
          const pageNum = p as number;
          const isActive = pageNum === current;
          return (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              disabled={loading}
              // Este paginador estaba escrito a mano con colores fijos: azul
              // para la pagina activa y blancos con transparencia para el
              // resto. Ni era el color de la web -el resto de paginadores usan
              // el naranja de la marca- ni funcionaba en tema claro, donde un
              // `text-zinc-300` sobre fondo blanco no se lee.
              className={`min-w-[36px] h-9 px-2.5 rounded-[var(--radius-md)] text-sm font-mono font-semibold transition-colors border cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-white border-transparent shadow-sm'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => handlePageChange(current + 1)}
          disabled={current >= totalPages || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.nextPage')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={current >= totalPages || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.lastPage')}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    );
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
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-3 sm:space-y-4 transition-all">
        <div className="w-full space-y-3 sm:space-y-4">
        {/* Título, Perfil & Buscador */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 w-full lg:flex-1 min-w-0">
            {/* Titulo a la izquierda y la cuenta al otro extremo: son dos
                cosas distintas -donde estas y con que cuenta- y pegadas
                parecian una sola etiqueta larga. */}
            <div className="flex items-center justify-between gap-3 w-full">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading min-w-0 truncate">
                {t('catalog.title')}
              </h1>

              {/* En lg la cabecera se pone en una fila y esta pastilla queda
                  justo a la izquierda de los controles, pero alineada con el
                  titulo: dos dedos mas arriba que todo lo que tiene al lado.
                  Ahi se pinta dentro del grupo de controles, que es donde se
                  centra con ellos; por debajo de lg sigue en la linea del
                  titulo, que es donde hace falta. */}
              {catalogResponse?.connected && (
                <span className="lg:hidden badge-pill text-[var(--text-primary)] text-[11px] shrink-0">
                  ● @{nombreCuentaCatalogo}
                </span>
              )}
            </div>

            {/*
              Oculto en móvil: en 375px los controles ocupaban el 44% de la pantalla
              antes del primer anime. Este texto repite datos que ya están a la vista
              —el total aparece en la pestaña "Todos (N)" y el tracker en las píldoras
              de abajo—, así que es la línea que menos cuesta recuperar.
            */}
            <p className="hidden sm:block text-xs text-[var(--text-secondary)]">
              {catalogResponse?.connected
                ? t('catalog.syncedLiveFrom', {
                    n: pagination.totalItems || counts.all,
                    tracker: selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? t('catalog.localBase') : 'AniList',
                  })
                : t('catalog.linkInHubHint')}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {catalogResponse?.connected && (
              <span className="hidden lg:inline-flex badge-pill text-[var(--text-primary)] text-[11px] shrink-0">
                ● @{nombreCuentaCatalogo}
              </span>
            )}
            {/* Un solo boton que alterna rejilla y lista.
                Ensena el icono de la vista a la que vas, no la que tienes:
                un boton dice que hace al pulsarlo. */}
            <button
              type="button"
              onClick={alternarVista}
              title={vistaCatalogo === 'grid' ? t('catalog.viewAsList') : t('catalog.viewAsGrid')}
              aria-label={vistaCatalogo === 'grid' ? t('catalog.viewAsList') : t('catalog.viewAsGrid')}
              className="btn-secondary text-xs px-2.5 py-1.5 sm:py-2 shrink-0 order-last sm:order-none"
            >
              {vistaCatalogo === 'grid' ? (
                <List className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              )}
            </button>

            {/* Buscador y refresco en la misma fila. */}
            <label className="flex-1 min-w-0 sm:flex-initial flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md text-xs sm:min-w-[140px] cursor-text focus-within:border-[var(--border-focus)]">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <input
                suppressHydrationWarning
                type="text"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('catalog.searchPlaceholder')}
                className="bg-transparent outline-none text-xs w-full sm:w-56 lg:w-72 xl:w-80 text-[var(--text-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </label>

            {/* Botón Refrescar */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading || !catalogResponse?.connected}
              className="btn-secondary text-xs px-2.5 sm:px-3 py-1.5 sm:py-2"
              title={`Sincronizar ahora con ${selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? 'Base Local' : 'AniList'}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-semibold">{refreshing ? t('catalog.refreshing') : t('catalog.refresh')}</span>
            </button>
          </div>
        </div>

        {/* FILA 2: estado a la izquierda, tracker a la derecha.

            En escritorio son pildoras, que dejan ver de un golpe todos los
            estados con sus cuentas. En movil eso eran dos filas enteras de la
            cabecera -y la de estados ni siquiera cabia, se cortaba a media
            palabra-, asi que ahi se convierten en dos desplegables que
            comparten una sola fila.

            Las listas se declaran una vez y las usan las dos vistas: antes
            eran seis botones copiados con el texto en castellano escrito a
            mano y cuatro pestanas mas al lado. */}
        {catalogResponse?.connected && (() => {
          const estados = [
            { id: 'ALL', etiqueta: t('catalog.filterAll'), cuenta: counts.all, activo: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'CURRENT', etiqueta: t('catalog.filterWatching'), cuenta: counts.watching, activo: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'COMPLETED', etiqueta: t('catalog.filterCompleted'), cuenta: counts.completed, activo: 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]' },
            { id: 'PLANNING', etiqueta: t('catalog.filterPlanning'), cuenta: counts.planning, activo: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'PAUSED_DROPPED', etiqueta: t('catalog.filterPausedDropped'), cuenta: (counts.paused || 0) + (counts.dropped || 0), activo: 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]' },
            { id: 'FAVORITES', etiqueta: t('catalog.filterFavorites'), cuenta: counts.favorites, activo: 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]' },
          ];

          const trackers = [
            { id: 'LOCAL', nombre: t('catalog.localLibrary'), punto: 'bg-[var(--text-muted)]', activo: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]', conectado: true },
            { id: 'ANILIST', nombre: 'AniList', punto: 'bg-[var(--brand-anilist)]', activo: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30', conectado: isAnilistActive },
            { id: 'MAL', nombre: 'MAL', punto: 'bg-[var(--brand-mal)]', activo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30', conectado: isMalActive },
            { id: 'KITSU', nombre: 'Kitsu', punto: 'bg-[var(--brand-kitsu)]', activo: 'bg-[var(--brand-kitsu)]/15 text-[var(--brand-kitsu)] border-[var(--brand-kitsu)]/30', conectado: isKitsuActive },
          ];

          const punto = (clase: string) => (
            <span className={`w-2 h-2 rounded-full shrink-0 ${clase}`} />
          );

          const desplegableEstado = (
            <CustomSelect
              value={statusFilter}
              onChange={(v: string) => handleStatusChange(v)}
              options={estados.map((e) => ({
                value: e.id,
                label: e.etiqueta,
                badge: String(e.cuenta ?? 0),
              }))}
            />
          );

          const pastillasTrackers = (
            <div
              role="tablist"
              aria-label={t('catalog.selectProvider')}
              className="inline-flex items-center p-1 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] gap-1 shrink-0"
            >
              {trackers.map((tr) => {
                const seleccionado = selectedTracker === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    role="tab"
                    aria-selected={seleccionado}
                    disabled={!tr.conectado}
                    onClick={() => handleTrackerChange(tr.id as any)}
                    title={tr.conectado ? tr.nombre : t('catalog.trackerNotLinked', { tracker: tr.nombre })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] text-xs font-semibold border transition-colors select-none ${
                      !tr.conectado
                        ? 'border-transparent text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        : seleccionado
                        ? `${tr.activo} shadow-xs font-bold cursor-pointer`
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer'
                    }`}
                  >
                    {punto(tr.punto)}
                    <span>{tr.nombre}</span>
                  </button>
                );
              })}
            </div>
          );

          return (
            <>
              {/* MOVIL: dos desplegables en una fila */}
              <div className="grid grid-cols-2 gap-2 sm:hidden pt-0.5">
                {desplegableEstado}
                <CustomSelect
                  value={selectedTracker}
                  onChange={(v: string) => handleTrackerChange(v as any)}
                  options={trackers.map((tr) => ({
                    value: tr.id,
                    label: tr.nombre,
                    icon: punto(tr.punto),
                    disabled: !tr.conectado,
                    disabledReason: t('catalog.trackerNotLinked', { tracker: tr.nombre }),
                  }))}
                />
              </div>

              {/* TABLET: los seis estados no caben en pastillas al lado del
                  grupo de trackers -se cortaban a media palabra-, asi que aqui
                  el estado es un desplegable y los trackers se quedan como
                  estan, que si caben. */}
              <div className="hidden sm:flex lg:hidden items-center justify-between gap-2.5 pt-0.5">
                <div className="w-[220px] shrink-0">{desplegableEstado}</div>
                {pastillasTrackers}
              </div>

              {/* ESCRITORIO: todo en pildoras */}
              <div className="hidden lg:flex lg:items-center justify-between gap-2.5 pt-0.5">
                {/* Una tira que se desplaza, no seis pastillas que envuelven.
                    A 768 px los seis estados se partian en tres lineas y el
                    grupo de trackers quedaba encajado en medio, con
                    "Favoritos" solo en la tercera. Sin envolver, la cabecera
                    mide siempre lo mismo y los estados se recorren de lado. */}
                <div
                  role="tablist"
                  aria-label={t('catalog.filterByStatus')}
                  className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar min-w-0 flex-1 text-xs -mx-1 px-1"
                >
                  {estados.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === e.id}
                      onClick={() => handleStatusChange(e.id)}
                      className={`px-3 py-1.5 rounded-[var(--radius-md)] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        statusFilter === e.id
                          ? `${e.activo} font-bold shadow-sm`
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {e.etiqueta} ({e.cuenta ?? 0})
                    </button>
                  ))}
                </div>

                {pastillasTrackers}
              </div>
            </>
          );
        })()}
        </div>
      </div>

      {/* CONTENEDOR PRINCIPAL CON SCROLL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-7 min-w-0" ref={catalogTopRef}>

        {/* Estado de Carga con Skeleton Cards */}
        {loading ? (
          <div className={`${getGridClass()} animate-in fade-in`}>
            {[...Array(16)].map((_, i) => (
              <div
                key={i}
                className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col justify-between p-1.5 space-y-1.5"
              >
                <div className="skeleton aspect-[2/3] w-full rounded-md" />
                <div className="space-y-1 px-1 pb-1">
                  <div className="skeleton h-3 w-4/5 rounded" />
                  <div className="skeleton h-2 w-1/2 rounded" />
                  <div className="skeleton h-1 w-full rounded-full mt-1" />
                </div>
              </div>
            ))}
          </div>
        ) : !catalogResponse?.connected ? (
          <div className="p-10 sm:p-14 rounded-[8px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-5 max-w-xl mx-auto">
            <div className="flex items-center justify-center gap-3">
              <div
                className="w-12 h-12 rounded-[8px] flex items-center justify-center text-base font-bold shadow-sm"
                style={{ backgroundColor: 'var(--brand-anilist)', color: '#fff' }}
              >
                AL
              </div>
              <div
                className="w-12 h-12 rounded-[8px] flex items-center justify-center text-base font-bold shadow-sm"
                style={{ backgroundColor: '#2e51a2', color: '#fff' }}
              >
                MAL
              </div>
            </div>
            <div className="space-y-1.5">
              <h3 className="font-bold text-base text-[var(--text-primary)] font-heading">{t('catalog.connectTracker')}</h3>
              <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">{t('catalog.connectTrackerDesc')}</p>
            </div>
            <Link
              href="/connections"
              className="btn-primary inline-flex items-center gap-2 mx-auto"
            >
              <Sparkles className="w-4 h-4" />
              <span>{t('catalog.goToConnectionsHub')}</span>
            </Link>
          </div>
        ) : catalog.length === 0 ? (
          <div className="p-16 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-3 max-w-lg mx-auto">
            <p className="text-xs font-medium text-[var(--text-secondary)]">{t('catalog.noAnimeForFilters')}</p>
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="text-xs text-[var(--accent-text)] hover:underline cursor-pointer">{t('catalog.clearSearch')}</button>
            )}
          </div>
        ) : (
          /* GRID FLUIDO COMPACTO Y ELEGANTE CON DENSIDAD RESPONSIVA */
          <div className="space-y-8">
            {vistaCatalogo === 'list' ? (
                          /* Misma fila que el historial y el resto de listas. Cambia lo
                             que se pinta dentro, no la estructura: asi el catalogo no
                             vuelve a ser una variante propia del mismo concepto. */
                          <>
                          {/* Con los valores ya alineados, lo unico que le
                              faltaba a esto para leerse como una tabla era
                              decir que es cada columna. */}
                          <ListRowsHeader
                            plantilla={PLANTILLA_COLUMNAS_CATALOGO}
                            titulo={t('catalog.colTitle')}
                            columnas={[
                              t('catalog.colEpisodes'),
                              t('catalog.colSeason'),
                              t('catalog.colProgress'),
                              t('catalog.colScore'),
                              t('catalog.colFormat'),
                              t('catalog.colSource'),
                            ]}
                            estado={t('catalog.colStatus')}
                          />
                          <ListRows label={t('catalog.title')}>
                            {catalog.map((anime) => {
                              const badge = getStatusBadge(anime.status);
                              const vistos = Number(anime.episodesWatched || 0);
                              const totales = Number(anime.episodesTotal || 0);
                              return (
                                <ListRow
                                  key={anime.id || anime.anilistId}
                                  onOpen={() => setSelectedAnime(anime)}
                                  openLabel={t('catalog.openDetails')}
                                  // La fila mide 2230 px y el titulo gasta 400:
                                  // los datos caben en la misma linea, a la
                                  // derecha, en vez de colgar debajo dejando el
                                  // resto en blanco.
                                  metaALaDerecha
                                  metaPlantilla={PLANTILLA_COLUMNAS_CATALOGO}
                                  media={
                                    <img
                                      src={anime.coverUrl}
                                      alt=""
                                      loading="lazy"
                                      onError={(e) => {
                                        e.currentTarget.onerror = null;
                                        e.currentTarget.src =
                                          'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                                      }}
                                      className="w-9 h-12 rounded-[var(--radius-sm)] object-cover border border-[var(--border-subtle)] bg-[var(--bg-app)]"
                                    />
                                  }
                                  title={anime.title}
                                  // La lista tiene sitio de sobra en escritorio
                                  // y estaba ensenando menos que la cuadricula:
                                  // dos datos y un hueco de 1500 px. Estos son
                                  // los mismos que pinta la card, y ListRow ya
                                  // recorta del tercero en adelante cuando la
                                  // pantalla es estrecha.
                                  //
                                  // El tercero era `anime.score`, un campo que
                                  // no existe -la nota vive en `rating` y, si no
                                  // la has puesto tu, en `averageScore`- asi que
                                  // salia siempre vacio.
                                  meta={[
                                    totales > 0 ? `Ep. ${vistos}/${totales}` : `Ep. ${vistos}`,
                                    getSeasonNumber(anime) > 1 ? `T${getSeasonNumber(anime)}` : anime.season || null,
                                    anime.progressPercentage > 0 ? `${anime.progressPercentage}%` : null,
                                    anime.rating > 0
                                      ? `★ ${Number(anime.rating).toFixed(1)}`
                                      : anime.averageScore
                                      ? `★ ${(Number(anime.averageScore) / 10).toFixed(1)}`
                                      : null,
                                    anime.format || null,
                                    anime.studio || null,
                                  ]}
                                  status={(() => {
                                    const Icono = getStatusIcon(anime.status);
                                    const color =
                                      badge?.className ||
                                      'border-[var(--border-subtle)] text-[var(--text-muted)]';
                                    return (
                                      <>
                                        {/* En movil solo el icono, que es donde
                                            no hay espacio; en escritorio el
                                            icono con su texto, que es lo que
                                            hace falta leer. */}
                                        <span
                                          title={badge?.label}
                                          aria-label={badge?.label}
                                          role="img"
                                          className={`lg:hidden shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${color}`}
                                        >
                                          <Icono className="w-4 h-4" aria-hidden="true" />
                                        </span>
                                        <span
                                          className={`hidden lg:inline-flex shrink-0 items-center justify-center gap-1.5 h-7 w-[104px] rounded-[var(--radius-md)] border text-[11px] font-semibold ${color}`}
                                        >
                                          <Icono className="w-3.5 h-3.5" aria-hidden="true" />
                                          {badge?.label}
                                        </span>
                                      </>
                                    );
                                  })()}
                                />
                              );
                            })}
                          </ListRows>
                          </>
                        ) : (
              <div className={getGridClass()}>
                {catalog.map((anime) => {
                  const badge = getStatusBadge(anime.status);
                  return (
                    <div
                      key={anime.id || anime.anilistId}
                      onClick={() => setSelectedAnime(anime)}
                      className="group relative rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-sky-500/50 hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
                    >
                      {/* Imagen de Portada */}
                      <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950">
                        <img
                          src={anime.coverUrl}
                          alt={anime.title}
                          width={230}
                          height={345}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                          }}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />

                        {/* Header Flotante Superior (Estado + Calificación) */}
                        <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between gap-1 pointer-events-none">
                          <div
                            // max-w-[50%] recortaba "Completado" a "Complet…" en tarjetas
                            // estrechas (160px en móvil): el 50% daba 80px y la etiqueta
                            // necesita ~75px más relleno. "Viendo", más corto, sí cabía, y
                            // de ahí que unas tarjetas se vieran bien y otras no.
                            className="px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold bg-black/80 backdrop-blur-md border shadow-sm truncate max-w-[62%] shrink-0"
                            style={{
                              color: badge.text,
                              borderColor: badge.border,
                            }}
                          >
                            {badge.label}
                          </div>

                          <div className="flex items-center gap-1 pointer-events-auto">
                            {/*
                              Ambas variantes comparten forma, tamaño y escala /10.
                              Antes, al no haber nota propia se pintaba averageScore crudo
                              ("90%"): escala sobre 100, sin icono y en otro color, en el
                              mismo hueco donde el resto muestra una nota sobre 10. Rompía
                              la lectura de la rejilla y no se entendía qué medía.
                              El color y el icono siguen distinguiendo tu nota del promedio
                              de la comunidad, pero ya no cambia la unidad.
                            */}
                            {anime.rating > 0 ? (
                              <div
                                title={`Tu puntuación: ${Number(anime.rating).toFixed(1)} de 10`}
                                className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-black/80 backdrop-blur-md text-amber-300 flex items-center gap-0.5 border border-amber-500/25 shadow-sm shrink-0"
                              >
                                <Star className="hidden min-[420px]:block w-2.5 h-2.5 fill-amber-300 shrink-0" aria-hidden="true" />
                                {Number(anime.rating).toFixed(1)}
                              </div>
                            ) : anime.averageScore ? (
                              <div
                                title={`Promedio de la comunidad: ${(Number(anime.averageScore) / 10).toFixed(1)} de 10`}
                                className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-black/80 backdrop-blur-md text-sky-300 flex items-center gap-0.5 border border-sky-500/25 shadow-sm shrink-0"
                              >
                                <Star className="hidden min-[420px]:block w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                                {(Number(anime.averageScore) / 10).toFixed(1)}
                              </div>
                            ) : null}

                            <button
                              type="button"
                              onClick={(e) => handleToggleFavorite(anime, e)}
                              className="w-5 h-5 rounded-[4px] bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-amber-400 transition-colors shadow-sm cursor-pointer"
                              title={favoritesList.includes(String(anime.anilistId || anime.malId || anime.kitsuId || anime.id)) ? t('catalog.removeFromFavourites') : t('catalog.addToFavourites')}
                            >
                              <Star
                                className={`w-3 h-3 transition-all ${
                                  favoritesList.includes(String(anime.anilistId || anime.malId || anime.kitsuId || anime.id))
                                    ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]'
                                    : 'text-zinc-400 hover:text-amber-300'
                                }`}
                              />
                            </button>
                          </div>
                        </div>

                        {/* Barra Flotante de Progreso de Episodios */}
                        <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between text-[9.5px] font-mono font-medium text-white bg-black/85 backdrop-blur-md px-1.5 py-0.5 rounded-[4px] border border-white/10 shadow-sm">
                          <span className="truncate">
                            Ep. {anime.episodesWatched}/{anime.episodesTotal || '?'}
                          </span>
                          <span
                            className={
                              anime.progressPercentage === 100 ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'
                            }
                          >
                            {anime.progressPercentage}%
                          </span>
                        </div>
                      </div>

                      {/* Información Inferior de la Tarjeta */}
                      <div className="p-2 space-y-1">
                        <h3
                          className="font-bold text-xs truncate text-[var(--text-primary)] leading-tight group-hover:text-sky-400 transition-colors"
                          title={anime.title}
                        >
                          {anime.title}
                        </h3>
                        <div
                          className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
                        >
                          <span className="truncate max-w-[60%]">{anime.studio || 'Studio'}</span>
                          <div className="flex items-center gap-1 font-mono shrink-0">
                            {/* Dos datos distintos: que temporada es y cuando
                                se emitio. Se pinta cada uno solo si lo hay, en
                                vez de rellenar con 'TV' lo que no se sabe. */}
                            {getSeasonNumber(anime) > 1 && (
                              <span className="text-sky-400 font-bold">T{getSeasonNumber(anime)}</span>
                            )}
                            {anime.season && <span className="truncate">{anime.season}</span>}
                            {!anime.season && getSeasonNumber(anime) <= 1 && (
                              <span className="truncate">{anime.format || 'TV'}</span>
                            )}
                          </div>
                        </div>

                        {/* Barra de Progreso Sutil */}
                        <div className="w-full h-1 rounded-full bg-zinc-800/80 overflow-hidden mt-1">
                          <div
                            className="h-full rounded-full transition-all duration-300"
                            style={{
                              width: `${anime.progressPercentage}%`,
                              backgroundColor:
                                anime.progressPercentage === 100
                                  ? 'var(--status-success)'
                                  : 'var(--brand-anilist)',
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* BARRA DE PAGINACIÓN MINIMALISTA Y ROBUSTA */}
            {pagination.totalPages > 1 && (
              <div className="pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
                <div className="text-sm font-mono text-zinc-400">
                  Mostrando{' '}
                  <span className="text-white font-bold">
                    {(currentPage - 1) * itemsPerPage + 1}
                  </span>{' '}
                  a{' '}
                  <span className="text-white font-bold">
                    {Math.min(currentPage * itemsPerPage, pagination.filteredItems)}
                  </span>{' '}
                  de <span className="text-sky-400 font-bold">{pagination.filteredItems}</span> animes
                </div>

                {renderPaginationButtons()}
              </div>
            )}
          </div>
        )}
      </main>

      {/* MODAL SEMITRANSPARENTE VIDRIO TEMPLADO (TOTALMENTE RESPONSIVE EN MÓVIL Y DESKTOP) */}
      {selectedAnime && (
        <div
          onClick={() => setSelectedAnime(null)}
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 md:p-6 bg-black/75 backdrop-blur-md animate-in fade-in overflow-y-auto cursor-pointer"
        >
          <div
            {...dialogProps}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl max-h-[92vh] lg:h-[88vh] lg:max-h-[850px] rounded-t-[16px] sm:rounded-[8px] border border-[var(--glass-border)] overflow-y-auto overscroll-contain shadow-[var(--glass-shadow-lg)] flex flex-col relative backdrop-blur-2xl bg-[var(--glass-bg)] text-[var(--text-primary)] cursor-default my-0 sm:my-auto outline-none"
          >
            {/* Tirador táctil móvil estilo Android */}
            <div className="w-12 h-1.5 rounded-full bg-white/25 mx-auto mt-3 mb-1 sm:hidden shrink-0" />

            {/* Botón cerrar flotante arriba a la derecha */}
            <button
              onClick={() => setSelectedAnime(null)}
              className="absolute top-3 right-3 sm:top-4 sm:right-4 p-2 rounded-[6px] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors z-30 backdrop-blur-md cursor-pointer"
              title={t('common.closeModal')}
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>

            {/* GRID PRINCIPAL: Flex en móvil, Grid 12 col en desktop */}
            <div className="flex flex-col lg:grid lg:grid-cols-12 flex-1 min-h-0 lg:overflow-hidden">
              
              {/* CABECERA COMPACTA EN MÓVIL (Oculta en Desktop para no duplicar ni sobrecargar el scroll móvil) */}
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

                    {/* Calificación y Tracker */}
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
                          title="Este anime no está vinculado a ningún tracker. Haz clic para crear el mapeo."
                        >
                          <span>Local</span>
                          <Sliders className="w-3 h-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Sinopsis compacta en móvil */}
                {selectedAnime.description && (
                  <p className="text-[11px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
                    {selectedAnime.description}
                  </p>
                )}
              </div>

              {/* 1. COLUMNA IZQUIERDA COMPLETA EN DESKTOP (lg:col-span-4) */}
              <div className="hidden lg:flex lg:col-span-4 p-5 space-y-3.5 border-r border-[var(--glass-border)] flex-col justify-start bg-[var(--bg-surface)] overflow-y-auto shrink-0">
                {/* Portada centrada con Badge de Estado en la esquina superior */}
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

                {/* Títulos y Metadata (Centrados) */}
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
                      Temporada {getSeasonNumber(selectedAnime)}
                    </span>
                  </div>
                </div>

                {/* CALIFICACIÓN */}
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

                {/* Géneros */}
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

                {/* Botón Abrir en Tracker o Mapear si es Local */}
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
                    title="Este anime no está vinculado a ningún tracker. Haz clic para crear el mapeo."
                  >
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Registro Local (Vincular a Tracker)</span>
                  </Link>
                )}
              </div>

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

                {/* 2.1 CABECERA SUPERIOR DERECHA: Progreso y Temporadas de la Saga */}
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

                {/* 2.2 ACORDEÓN DE EPISODIOS: Flujo natural en móvil, scroll independiente en desktop */}
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
                        {/* Cabecera de la Temporada */}
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

                        {/* Grid de Episodios con Animación CSS Grid Ease-in-Out */}
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
                                          Episodio {ep.number}
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
                                      title={`Sincronizar Episodio ${ep.number}`}
                                    >
                                      {isSyncing ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                      ) : ep.isWatched ? (
                                        <Check className="w-3 h-3" />
                                      ) : (
                                        <Play className="w-2.5 h-2.5 fill-current" />
                                      )}
                                      <span className="whitespace-nowrap">{ep.isWatched ? 'Re-sync' : 'Marcar'}</span>
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

                {/* 2.3 BARRA DE SINCRONIZACIÓN MULTIPROVEEDOR MINIMALISTA (Siempre al final del contenido) */}
                <div className="p-3.5 sm:p-5 pt-2 relative z-10 shrink-0 mt-auto">
                  <div className="p-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-sm">
                    <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
                      <Database className="w-3.5 h-3.5 text-[#01bcf3]" />
                      <span>{t('catalog.syncLabel')}</span>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap text-[11px]">
                      {/* Estado Local si no tiene ningún tracker vinculado */}
                      {!selectedAnime.anilistId && !selectedAnime.malId && !selectedAnime.kitsuId && (
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                          <span>Local (Sin trackers)</span>
                        </div>
                      )}

                      {/* Jellyfin */}
                      {(selectedAnime.syncedJellyfin || isJellyfinServerConnected) && (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                            selectedAnime.syncedJellyfin
                              ? 'border-[#00a4dc]/30 bg-[#00a4dc]/10 text-[#00a4dc]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedAnime.syncedJellyfin ? 'bg-[#00a4dc]' : 'bg-zinc-500'}`} />
                          <span>Jellyfin {catalogResponse?.providers?.jellyfin?.serverName ? `(${catalogResponse.providers.jellyfin.serverName})` : ''}</span>
                        </div>
                      )}

                      {/* Emby */}
                      {(selectedAnime.syncedEmby || isEmbyServerConnected) && (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                            selectedAnime.syncedEmby
                              ? 'border-[#52b54b]/30 bg-[#52b54b]/10 text-[#52b54b]'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedAnime.syncedEmby ? 'bg-[#52b54b]' : 'bg-zinc-500'}`} />
                          <span>Emby {catalogResponse?.providers?.emby?.serverName ? `(${catalogResponse.providers.emby.serverName})` : ''}</span>
                        </div>
                      )}

                      {/* Plex */}
                      {(selectedAnime.syncedPlex || isPlexServerConnected) && (
                        <div
                          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                            selectedAnime.syncedPlex
                              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                              : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                          }`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${selectedAnime.syncedPlex ? 'bg-amber-400' : 'bg-zinc-500'}`} />
                          <span>Plex {catalogResponse?.providers?.plex?.serverName ? `(${catalogResponse.providers.plex.serverName})` : ''}</span>
                        </div>
                      )}

                      {/* AniList */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                          (selectedAnime.syncedAnilist || (selectedAnime.anilistId && selectedAnime.anilistId > 0)) && isAnilistActive
                            ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${(selectedAnime.syncedAnilist || (selectedAnime.anilistId && selectedAnime.anilistId > 0)) && isAnilistActive ? 'bg-sky-400' : 'bg-zinc-500'}`} />
                        <span>AniList {isAnilistActive && catalogResponse?.providers?.anilist?.username ? `(@${catalogResponse.providers.anilist.username})` : ''}</span>
                      </div>

                      {/* MyAnimeList */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                          (selectedAnime.syncedMal || selectedAnime.malId) && isMalActive
                            ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${(selectedAnime.syncedMal || selectedAnime.malId) && isMalActive ? 'bg-indigo-400' : 'bg-zinc-500'}`} />
                        <span>MAL {isMalActive && catalogResponse?.providers?.mal?.username ? `(@${catalogResponse.providers.mal.username})` : ''}</span>
                      </div>

                      {/* Kitsu */}
                      <div
                        className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                          (selectedAnime.syncedKitsu || selectedAnime.kitsuId) && isKitsuActive
                            ? 'border-[#fd755c]/30 bg-[#fd755c]/10 text-[#fd755c]'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${(selectedAnime.syncedKitsu || selectedAnime.kitsuId) && isKitsuActive ? 'bg-[#fd755c]' : 'bg-zinc-500'}`} />
                        <span>Kitsu {isKitsuActive && catalogResponse?.providers?.kitsu?.username ? `(@${catalogResponse.providers.kitsu.username})` : ''}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
