'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/components/CustomSelect';
import {
  Image as ImageIcon,
  HardDrive,
  Trash2,
  RefreshCw,
  Search,
  Copy,
  Check,
  Filter,
  ExternalLink,
  Layers,
  Sparkles,
  AlertTriangle,
  X,
  FileImage,
  Calendar,
  Eye,
  Info,
  ArrowUpDown,
  Link as LinkIcon,
  Unlink,
  RotateCw,
  Loader2,
} from 'lucide-react';

interface MediaItem {
  filename: string;
  category: string;
  url: string;
  sizeBytes: number;
  formattedSize: string;
  mimeType: string;
  createdAt: string;
  modifiedAt: string;
  anilistId?: number | null;
  malId?: number | null;
  titleEnglish?: string | null;
  titleRomaji?: string | null;
  plexTitles?: string[];
  usageCount?: number;
  isOrphan?: boolean;
}

// COMPONENTE LAZY LOAD CON INTERSECTION OBSERVER (TIPO WORDPRESS)
function LazyMediaThumbnail({
  item,
  isSelected,
  onClick,
}: {
  item: MediaItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [item.url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '300px' }
      );

      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setIsVisible(true);
    }
  }, [item.url]);

  const handleImageRef = (imgEl: HTMLImageElement | null) => {
    imgRef.current = imgEl;
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setIsLoaded(true);
    }
  };

  const displayName = item.titleEnglish || item.titleRomaji || item.filename;

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`group relative aspect-square rounded-[8px] border bg-[var(--bg-surface)] overflow-hidden cursor-pointer select-none transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-[var(--accent-primary)] border-[var(--accent-primary)] shadow-md shadow-[var(--accent-primary)]/20 scale-[1.02]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
      }`}
      title={`${displayName} (${item.formattedSize})`}
    >
      {isVisible ? (
        <>
          {hasError ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-zinc-900/40">
              <ImageIcon className="w-5 h-5 text-zinc-500 mb-1" />
              <span className="text-[9px] font-mono text-zinc-400 truncate max-w-full">
                {displayName}
              </span>
            </div>
          ) : (
            <img
              ref={handleImageRef}
              src={item.url}
              alt={displayName}
              loading="lazy"
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                setHasError(true);
                setIsLoaded(true);
              }}
              className={`w-full h-full object-cover transition-all duration-300 ${
                isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              } group-hover:scale-105`}
            />
          )}
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 skeleton" />
          )}
        </>
      ) : (
        <div className="w-full h-full bg-[var(--bg-surface-elevated)]/40 flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-[var(--text-muted)] opacity-20" />
        </div>
      )}

      {/* Indicador de Selección */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-[4px] bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-md">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      )}

      {/* Badge Estado: Huérfano vs En Uso */}
      {item.category === t('admin.animeCovers') && (
        <div className="absolute top-1.5 left-1.5 z-10">
          {item.isOrphan ? (
            <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500/90 text-zinc-950 font-bold text-[8px] font-mono shadow-xs backdrop-blur-xs flex items-center gap-0.5" title={t('admin.orphanTooltip')}>
              <Unlink className="w-2.5 h-2.5" />
              <span>{t('admin.orphan')}</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-600/90 text-white font-bold text-[8px] font-mono shadow-xs backdrop-blur-xs flex items-center gap-0.5" title={`En uso activo: ${item.usageCount} referencias`}>
              <LinkIcon className="w-2.5 h-2.5" />
              <span>{item.usageCount || 1}</span>
            </span>
          )}
        </div>
      )}

      {/* Overlay inferior con títulos e info técnica */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 pt-6 text-left pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[11px] font-bold text-white truncate leading-tight">
          {displayName}
        </p>
        {item.titleRomaji && item.titleRomaji !== displayName && (
          <p className="text-[9px] text-zinc-400 truncate italic mt-0.5 font-mono">
            {item.titleRomaji}
          </p>
        )}
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-300 mt-1">
          <span className="text-zinc-300 font-semibold">{item.formattedSize}</span>
          <span className="uppercase text-[8px] px-1 py-0.2 rounded bg-white/20 text-white font-bold">
            {item.mimeType.split('/')[1] || 'webp'}
          </span>
        </div>
      </div>
    </div>
  );
}

// Array a nivel de modulo: guarda claves y se traduce donde se consume.
const sortOptions = [
  { value: 'RECENT', label: 'admin.sortNewest' },
  { value: 'OLDEST', label: 'admin.sortOldest' },
  { value: 'TITLE_EN_ASC', label: 'admin.sortEnglishAsc' },
  { value: 'TITLE_EN_DESC', label: 'admin.sortEnglishDesc' },
  { value: 'TITLE_ROMAJI_ASC', label: 'admin.sortRomajiAsc' },
  { value: 'TITLE_ROMAJI_DESC', label: 'admin.sortRomajiDesc' },
  { value: 'SIZE_DESC', label: 'admin.sortLargest' },
  { value: 'SIZE_ASC', label: 'admin.sortSmallest' },
];

export default function AdminMediaPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  /*
   * Si la carga falla, la lista se queda vacia y la pantalla decia "no hay
   * medios que coincidan": una mentira sobre unos ficheros que si estan. Hay
   * que distinguir "cargado y vacio" de "no se pudo cargar".
   */
  const [errorCarga, setErrorCarga] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSizeFormatted, setTotalSizeFormatted] = useState('0 KB');
  const [totalLinked, setTotalLinked] = useState(0);
  const [totalOrphans, setTotalOrphans] = useState(0);

  // Filtros, Búsqueda, Ordenamiento & Paginación
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LINKED' | 'ORPHAN'>('ALL');
  const [sortBy, setSortBy] = useState<string>('RECENT');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 32;

  // Acciones en Medios
  const [isRefreshingItem, setIsRefreshingItem] = useState(false);

  // Avatares predeterminados
  const [presetAvatars, setPresetAvatars] = useState<string[]>([]);
  const [uploadingPreset, setUploadingPreset] = useState(false);
  const presetInputRef = useRef<HTMLInputElement>(null);

  // Modales
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null);

  const [purgeModalOpen, setPurgeModalOpen] = useState(false);
  const [isPurging, setIsPurging] = useState(false);

  const [purgeOrphansModalOpen, setPurgeOrphansModalOpen] = useState(false);
  const [isPurgingOrphans, setIsPurgingOrphans] = useState(false);

  // Cargar estado de página y categoría guardados (URL o localStorage)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPage = params.get('page');
    const urlCat = params.get('category');

    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p > 0) setPage(p);
    } else {
      const savedPage = localStorage.getItem('plexsync_admin_media_page');
      if (savedPage) {
        const p = parseInt(savedPage, 10);
        if (!isNaN(p) && p > 0) setPage(p);
      }
    }

    if (urlCat) {
      setCategoryFilter(urlCat);
    } else {
      const savedCat = localStorage.getItem('plexsync_admin_media_category');
      if (savedCat) setCategoryFilter(savedCat);
    }
  }, []);

  useEffect(() => {
    loadMedia();
    api.admin
      .presetAvatars()
      .then((res) => setPresetAvatars(res.avatars || []))
      .catch(() => setPresetAvatars([]));
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setSelectedItem(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const changePage = (newPage: number) => {
    setPage(newPage);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexsync_admin_media_page', String(newPage));
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(newPage));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleSearchChange = (val: string) => {
    setSearchQuery(val);
    changePage(1);
  };

  const handleCategoryChange = (cat: string) => {
    setCategoryFilter(cat);
    changePage(1);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexsync_admin_media_category', cat);
      const url = new URL(window.location.href);
      url.searchParams.set('category', cat);
      url.searchParams.set('page', '1');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const loadMedia = async () => {
    try {
      setLoading(true);
      setErrorCarga(false);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const res = await api.admin.getMedia();
      setMediaList(res.media || []);
      setTotalFiles(res.totalFiles || 0);
      setTotalSizeFormatted(res.totalSizeFormatted || '0 KB');
      setTotalLinked(res.totalLinked || 0);
      setTotalOrphans(res.totalOrphans || 0);

      if (selectedItem && res.media) {
        const found = res.media.find((m: MediaItem) => m.filename === selectedItem.filename);
        if (found) setSelectedItem(found);
        else setSelectedItem(null);
      }
    } catch (err: any) {
      setErrorCarga(true);
      showToast(`${t('admin.loadMediaError')} ` + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMedia();
    setIsRefreshing(false);
    showToast(t('admin.mediaLibraryUpdated'), 'success');
  };

  const handlePresetFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // El input se limpia siempre: sin esto, volver a elegir el mismo fichero
    // tras un fallo no dispararia el evento y pareceria que el boton no hace nada.
    e.target.value = '';
    if (!file) return;

    setUploadingPreset(true);
    try {
      const formData = new FormData();
      formData.append('avatar', file);
      const res = await api.admin.addPresetAvatar(formData);
      setPresetAvatars(res.avatars || []);
      showToast(t('admin.presetAvatarsAdded'), 'success');
    } catch (err: any) {
      showToast(`${t('admin.presetAvatarsError')} ` + err.message, 'error');
    } finally {
      setUploadingPreset(false);
    }
  };

  const handleRemovePreset = (preset: string) => {
    setPresetAvatars((prev) => prev.filter((p) => p !== preset));
    showUndoToast(t('common.deletingItem', { name: preset }), {
      alDeshacer: () => setPresetAvatars((prev) => [...prev, preset]),
      alExpirar: async () => {
        try {
          const res = await api.admin.removePresetAvatar(preset);
          setPresetAvatars(res.avatars || []);
          showToast(t('admin.presetAvatarsRemoved'), 'success');
        } catch (err: any) {
          setPresetAvatars((prev) => [...prev, preset]);
          showToast(`${t('admin.presetAvatarsError')} ` + err.message, 'error');
        }
      },
    });
  };

  const handleDeleteClick = (item: MediaItem) => {
    setItemToDelete(item);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const fichero = itemToDelete;
    setDeleteModalOpen(false);
    setItemToDelete(null);
    if (selectedItem?.filename === fichero.filename) setSelectedItem(null);
    setMediaList((prev) => prev.filter((m) => m.filename !== fichero.filename));
    showUndoToast(t('common.deletingItem', { name: fichero.filename }), {
      alDeshacer: () => loadMedia(),
      alExpirar: async () => {
        try {
          await api.admin.deleteMedia(fichero.filename);
          showToast(t('admin.fileDeleted', { name: fichero.filename }), 'success');
        } catch (err: any) {
          showToast(`${t('admin.deleteFileError')} ` + err.message, 'error');
        }
        loadMedia();
      },
    });
  };

  const handleConfirmPurge = () => {
    setPurgeModalOpen(false);
    showUndoToast(t('admin.purgingCache'), {
      alDeshacer: () => {},
      alExpirar: async () => {
        try {
          setIsPurging(true);
          const res = await api.admin.purgeMedia();
          showToast(res.message || t('admin.cachePurged'), 'success');
          setSelectedItem(null);
          loadMedia();
        } catch (err: any) {
          showToast(`${t('admin.purgeCacheError')} ` + err.message, 'error');
        } finally {
          setIsPurging(false);
        }
      },
    });
  };

  const handleConfirmPurgeOrphans = () => {
    setPurgeOrphansModalOpen(false);
    showUndoToast(t('admin.purgingOrphans'), {
      alDeshacer: () => {},
      alExpirar: async () => {
        try {
          setIsPurgingOrphans(true);
          const res = await api.admin.purgeOrphanMedia();
          showToast(res.message || t('admin.orphansDeleted'), 'success');
          setSelectedItem(null);
          loadMedia();
        } catch (err: any) {
          showToast(`${t('admin.deleteOrphansError')} ` + err.message, 'error');
        } finally {
          setIsPurgingOrphans(false);
        }
      },
    });
  };

  const handleRefreshCover = async (item: MediaItem) => {
    try {
      setIsRefreshingItem(true);
      const res = await api.admin.refreshMedia(item.filename);
      showToast(res.message || t('admin.coverRefreshed'), 'success');
      await loadMedia();
    } catch (err: any) {
      showToast(`${t('admin.refreshCoverError')} ` + err.message, 'error');
    } finally {
      setIsRefreshingItem(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    showToast(t('admin.linkCopied'), 'info');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  // Filtrado Universal y Ordenamiento Multicriterio
  const filteredMedia = mediaList
    .filter((item) => {
      const matchesCategory = categoryFilter === 'ALL' || item.category === categoryFilter;
      const matchesStatus =
        statusFilter === 'ALL' ||
        (statusFilter === 'LINKED' && !item.isOrphan) ||
        (statusFilter === 'ORPHAN' && item.isOrphan);

      if (!matchesCategory || !matchesStatus) return false;

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase().trim();
      return (
        item.filename.toLowerCase().includes(q) ||
        (item.titleEnglish && item.titleEnglish.toLowerCase().includes(q)) ||
        (item.titleRomaji && item.titleRomaji.toLowerCase().includes(q)) ||
        (item.plexTitles && item.plexTitles.some((t) => t.toLowerCase().includes(q))) ||
        (item.anilistId && String(item.anilistId).includes(q)) ||
        (item.malId && String(item.malId).includes(q))
      );
    })
    .sort((a, b) => {
      if (sortBy === 'RECENT') {
        return new Date(b.modifiedAt).getTime() - new Date(a.modifiedAt).getTime();
      }
      if (sortBy === 'OLDEST') {
        return new Date(a.modifiedAt).getTime() - new Date(b.modifiedAt).getTime();
      }
      if (sortBy === 'TITLE_EN_ASC') {
        const nameA = a.titleEnglish || a.titleRomaji || a.filename;
        const nameB = b.titleEnglish || b.titleRomaji || b.filename;
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'TITLE_EN_DESC') {
        const nameA = a.titleEnglish || a.titleRomaji || a.filename;
        const nameB = b.titleEnglish || b.titleRomaji || b.filename;
        return nameB.localeCompare(nameA);
      }
      if (sortBy === 'TITLE_ROMAJI_ASC') {
        const nameA = a.titleRomaji || a.titleEnglish || a.filename;
        const nameB = b.titleRomaji || b.titleEnglish || b.filename;
        return nameA.localeCompare(nameB);
      }
      if (sortBy === 'TITLE_ROMAJI_DESC') {
        const nameA = a.titleRomaji || a.titleEnglish || a.filename;
        const nameB = b.titleRomaji || b.titleEnglish || b.filename;
        return nameB.localeCompare(nameA);
      }
      if (sortBy === 'SIZE_DESC') {
        return b.sizeBytes - a.sizeBytes;
      }
      if (sortBy === 'SIZE_ASC') {
        return a.sizeBytes - b.sizeBytes;
      }
      return 0;
    });

  const totalPages = Math.max(1, Math.ceil(filteredMedia.length / itemsPerPage));
  const paginatedMedia = filteredMedia.slice((page - 1) * itemsPerPage, page * itemsPerPage);

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.mediaTitle')} />

      {/* TOP HEADER */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.mediaLibraryTitle')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.mediaLibrarySubtitle')}</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="btn-secondary"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t('admin.refreshShort')}</span>
            </button>

            {totalOrphans > 0 && (
              <button
                onClick={() => setPurgeOrphansModalOpen(true)}
                disabled={loading}
                className="px-3.5 py-2 rounded-[6px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>Limpiar {totalOrphans} Huérfanas</span>
              </button>
            )}

            <button
              onClick={() => setPurgeModalOpen(true)}
              disabled={loading || mediaList.length === 0}
              className="px-3.5 py-2 rounded-[6px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('admin.purgeAll')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        {/* KPI CARDS (4 COLUMNAS EN DESKTOP) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">Archivos Totales</span>
              <ImageIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)] font-heading">
              {loading ? <div className="skeleton h-8 w-16 rounded" /> : totalFiles}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.cachedImagesOnDisk')}</p>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.diskSpace')}</span>
              <HardDrive className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)] font-heading">
              {loading ? <div className="skeleton h-8 w-24 rounded" /> : totalSizeFormatted}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.webpOptimisedUsage')}</p>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.inActiveUse')}</span>
              <LinkIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-heading">
              {loading ? <div className="skeleton h-8 w-16 rounded" /> : totalLinked}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.linkedToMappings')}</p>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.orphanedUnused')}</span>
              <Unlink className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-heading">
              {loading ? <div className="skeleton h-8 w-16 rounded" /> : totalOrphans}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.residualFiles')}</p>
          </div>
        </div>

        {/* AVATARES PREDETERMINADOS: los que se ofrecen a quien no sube foto */}
        <div className="glass-card p-5 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                {t('admin.presetAvatarsTitle')}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('admin.presetAvatarsSubtitle')}
              </p>
            </div>
            <input
              ref={presetInputRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="hidden"
              onChange={handlePresetFileChange}
            />
            <button
              onClick={() => presetInputRef.current?.click()}
              disabled={uploadingPreset}
              className="btn-secondary shrink-0"
            >
              {uploadingPreset ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-[var(--accent-text)]" />
              )}
              <span>{t('admin.presetAvatarsAdd')}</span>
            </button>
          </div>

          {presetAvatars.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">{t('admin.presetAvatarsEmpty')}</p>
          ) : (
            <div className="flex flex-wrap gap-3">
              {presetAvatars.map((preset) => (
                <div key={preset} className="relative group">
                  <img
                    src={preset}
                    alt=""
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)]"
                  />
                  <button
                    onClick={() => handleRemovePreset(preset)}
                    title={t('admin.presetAvatarsRemove')}
                    aria-label={t('admin.presetAvatarsRemove')}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-rose-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer shadow-md"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* CONTENEDOR PRINCIPAL: TOOLBAR + GRID + INSPECTOR */}
        <div className="glass-card p-5 space-y-4">
          {/* BARRA DE HERRAMIENTAS, FILTROS Y ORDENAMIENTO */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {/* Buscador Universal */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs flex-1 min-w-[240px] max-w-[380px]">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder={t('admin.searchMediaPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full text-[var(--text-primary)]"
                />
                {searchQuery && (
                  <button onClick={() => handleSearchChange('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                    ×
                  </button>
                )}
              </div>

              {/* Filtro por Categoría */}
              <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('ALL')}
                  className={`px-2.5 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >{t('common.all')}</button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange(t('admin.animeCovers'))}
                  className={`px-2.5 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    categoryFilter === t('admin.animeCovers')
                      ? 'bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >
                  Portadas
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('General')}
                  className={`px-2.5 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    categoryFilter === 'General'
                      ? 'bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >
                  General
                </button>
              </div>

              {/* Filtro por Estado (Vinculadas vs Huérfanas) */}
              <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
                <button
                  type="button"
                  onClick={() => { setStatusFilter('ALL'); changePage(1); }}
                  className={`px-2 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/30'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                  }`}
                >{t('admin.statusAll')}</button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('LINKED'); changePage(1); }}
                  className={`px-2 py-1 rounded-[4px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'LINKED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-[var(--text-secondary)] hover:text-emerald-400 border border-transparent'
                  }`}
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>En Uso ({totalLinked})</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('ORPHAN'); changePage(1); }}
                  className={`px-2 py-1 rounded-[4px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'ORPHAN'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'text-[var(--text-secondary)] hover:text-amber-400 border border-transparent'
                  }`}
                >
                  <Unlink className="w-3 h-3" />
                  <span>Huérfanas ({totalOrphans})</span>
                </button>
              </div>
            </div>

            {/* Ordenamiento y Contador */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-48 sm:w-52">
                <CustomSelect
                  options={sortOptions.map((o) => ({ ...o, label: t(o.label) }))}
                  value={sortBy}
                  onChange={(val) => setSortBy(val)}
                  placeholder={t('admin.sortBy')}
                />
              </div>

              <div className="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                <span>{filteredMedia.length} elementos</span>
              </div>
            </div>
          </div>

          {/* GRID DE MINIATURAS CON LAZY LOADING */}
          <div className="w-full space-y-4">
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {[...Array(itemsPerPage)].map((_, i) => (
                  <div key={i} className="skeleton aspect-square w-full rounded-[8px]" />
                ))}
              </div>
            ) : errorCarga ? (
              <div className="py-20 text-center space-y-3">
                <AlertTriangle className="w-12 h-12 text-[var(--status-danger)] mx-auto opacity-70" aria-hidden="true" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">{t('admin.mediaLoadFailed')}</p>
                <button type="button" onClick={() => loadMedia()} className="btn-secondary mx-auto">
                  <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('admin.retry')}</span>
                </button>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <ImageIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto opacity-30" />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">{t('admin.noMediaForFilters')}</p>
                <p className="text-xs text-[var(--text-muted)]">{t('admin.tryChangingSearch')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5">
                {paginatedMedia.map((item) => (
                  <LazyMediaThumbnail
                    key={item.filename}
                    item={item}
                    isSelected={selectedItem?.filename === item.filename}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )}

            {/* BARRA DE PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--glass-border)] text-xs font-mono text-[var(--text-secondary)]">
                <div>
                  Mostrando{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {(page - 1) * itemsPerPage + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {Math.min(page * itemsPerPage, filteredMedia.length)}
                  </span>{' '}
                  de{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {filteredMedia.length}
                  </span>{' '}
                  archivos
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => changePage(Math.max(1, page - 1))}
                    className="px-3 py-1.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >{t('common.previous')}</button>

                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= page - 2 && pageNum <= page + 2)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => changePage(pageNum)}
                            className={`w-8 h-8 rounded-[6px] text-xs font-bold transition-all cursor-pointer ${
                              page === pageNum
                                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === page - 3 ||
                        pageNum === page + 3
                      ) {
                        return (
                          <span key={pageNum} className="px-1 text-[var(--text-muted)]">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                    className="px-3 py-1.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >{t('common.next')}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* DRAWER LATERAL ANIMADO CON METADATOS COMPLETOS (INGLÉS / ROMAJI / PLEX / TRACKERS) */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300 animate-in fade-in cursor-pointer"
          onClick={() => setSelectedItem(null)}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-[var(--bg-surface-elevated)] border-l border-[var(--border-subtle)] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          selectedItem ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {selectedItem && (
          <div className="space-y-5">
            {/* Header del Visualizador */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] font-mono flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>{t('admin.coverInspection')}</span>
                </h3>
                {selectedItem.isOrphan ? (
                  <span className="px-2 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Unlink className="w-3 h-3" />{t('admin.orphan')}</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    En Uso ({selectedItem.usageCount || 1})
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                title={t('admin.closePanelEsc')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Vista Previa Completa Sin Recorte */}
            <div className="relative w-full h-80 rounded-[8px] overflow-hidden border border-[var(--border-subtle)] bg-black/60 flex items-center justify-center p-3 group shadow-inner">
              <img
                src={selectedItem.url}
                alt={selectedItem.titleEnglish || selectedItem.titleRomaji || selectedItem.filename}
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-[4px] shadow-lg transition-transform duration-300 group-hover:scale-105"
              />
              <a
                href={selectedItem.url}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold backdrop-blur-xs"
              >
                <Eye className="w-4 h-4" />
                <span>{t('admin.openAtOriginalSize')}</span>
              </a>
            </div>

            {/* Metadatos de Anime Enriquecidos */}
            <div className="space-y-3.5 text-xs">
              {/* Título en Inglés */}
              {selectedItem.titleEnglish && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono text-[var(--text-muted)]">
                    <span>{t('admin.englishTitle')}</span>
                    <span className="text-sky-400 font-bold">EN</span>
                  </div>
                  <div className="font-heading font-bold text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                    {selectedItem.titleEnglish}
                  </div>
                </div>
              )}

              {/* Título en Romaji */}
              {selectedItem.titleRomaji && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono text-[var(--text-muted)]">
                    <span>{t('admin.romajiTitle')}</span>
                    <span className="text-purple-400 font-bold">ROMAJI</span>
                  </div>
                  <div className="font-sans font-semibold text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                    {selectedItem.titleRomaji}
                  </div>
                </div>
              )}

              {/* Títulos en Plex Asociados */}
              {selectedItem.plexTitles && selectedItem.plexTitles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">{t('admin.linkedPlexTitles')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.plexTitles.map((pt, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-[4px] bg-[#e5a00d]/10 text-[#e5a00d] border border-[#e5a00d]/30 font-mono text-[11px] font-semibold flex items-center gap-1"
                      >
                        <span>🎬</span>
                        <span>{pt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Identificadores en Trackers (AniList & MAL) */}
              {(selectedItem.anilistId || selectedItem.malId) && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {selectedItem.anilistId && (
                    <a
                      href={`https://anilist.co/anime/${selectedItem.anilistId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500/50 hover:bg-sky-500/5 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-[9px] uppercase font-mono text-[var(--text-muted)] block">AniList ID</span>
                        <span className="text-xs font-mono font-bold text-sky-400">#{selectedItem.anilistId}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400" />
                    </a>
                  )}

                  {selectedItem.malId && (
                    <a
                      href={`https://myanimelist.net/anime/${selectedItem.malId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-[9px] uppercase font-mono text-[var(--text-muted)] block">MyAnimeList ID</span>
                        <span className="text-xs font-mono font-bold text-blue-400">#{selectedItem.malId}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400" />
                    </a>
                  )}
                </div>
              )}

              {/* Metadatos Técnicos de Archivo */}
              <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">{t('admin.fileOnDisk')}</span>
                <div className="font-mono font-bold text-[var(--text-primary)] break-all text-xs bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]" title={selectedItem.filename}>
                  {selectedItem.filename}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase">Formato</span>
                  <span className="text-emerald-400 font-bold uppercase">{selectedItem.mimeType.split('/')[1] || 'webp'}</span>
                </div>
                <div className="bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase">{t('admin.size')}</span>
                  <span className="text-[var(--text-primary)] font-bold">{selectedItem.formattedSize}</span>
                </div>
              </div>

              {/* URL Directa para Copiar */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">{t('admin.localPublicLink')}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}${selectedItem.url}` : selectedItem.url}
                    className="glass-input text-[11px] font-mono py-1.5 px-2.5 w-full text-[var(--text-secondary)] select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(selectedItem.url)}
                    className="btn-secondary p-2 shrink-0 cursor-pointer"
                    title={t('admin.copyLink')}
                  >
                    {copiedUrl === selectedItem.url ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Acciones de la Portada */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
              {selectedItem.category === t('admin.animeCovers') && (
                <button
                  type="button"
                  disabled={isRefreshingItem}
                  onClick={() => handleRefreshCover(selectedItem)}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-2 cursor-pointer font-semibold disabled:opacity-50"
                >
                  {isRefreshingItem ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  )}
                  <span>{t('admin.refreshCoverFromTracker')}</span>
                </button>
              )}

              <div className="flex items-center justify-between gap-3">
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Ver original</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleDeleteClick(selectedItem)}
                  className="px-3.5 py-2 rounded-[6px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all flex-1 justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFIRMAR ELIMINACIÓN INDIVIDUAL */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title={t('admin.confirmDeleteMediaFile')}
        description={`Estás a punto de eliminar "${itemToDelete?.titleEnglish || itemToDelete?.titleRomaji || itemToDelete?.filename}". Esta acción no se puede deshacer.`}
        confirmText="Eliminar Archivo"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteModalOpen(false)}
      />

      {/* MODAL CONFIRMAR PURGA COMPLETA */}
      <ConfirmModal
        isOpen={purgeModalOpen}
        title={t('admin.confirmPurgeCache')}
        description="Se eliminarán todas las portadas descargadas localmente. La aplicación las descargará de nuevo según sea necesario cuando los usuarios exploren el catálogo o sintonicen animes."
        confirmText="Purgar Todo"
        cancelText="Cancelar"
        variant="warning"
        loading={isPurging}
        onConfirm={handleConfirmPurge}
        onClose={() => setPurgeModalOpen(false)}
      />

      {/* MODAL CONFIRMAR LIMPIEZA DE PORTADAS HUÉRFANAS */}
      <ConfirmModal
        isOpen={purgeOrphansModalOpen}
        title={t('admin.confirmCleanOrphans')}
        description={`Se eliminarán de forma segura las ${totalOrphans} portadas que ya no están vinculadas a ningún anime o historial en la base de datos, liberando almacenamiento sin afectar a tus animes activos.`}
        confirmText="Limpiar Huérfanas"
        cancelText="Cancelar"
        variant="warning"
        loading={isPurgingOrphans}
        onConfirm={handleConfirmPurgeOrphans}
        onClose={() => setPurgeOrphansModalOpen(false)}
      />
    </div>
  );
}
