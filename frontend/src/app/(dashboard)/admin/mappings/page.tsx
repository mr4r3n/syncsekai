'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  GitMerge,
  Search,
  Check,
  Globe,
  Plus,
  Minus,
  RefreshCw,
  Trash2,
  Edit3,
  Film,
  Sparkles,
  Loader2,
  X,
  Layers,
  Users,
  ShieldCheck,
  AlertTriangle,
  MoreVertical,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { CustomSelect } from '@/components/CustomSelect';
import { useModalA11y } from '@/components/useModalA11y';

export default function AdminMappingsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GLOBAL' | 'USER' | 'PENDING'>('ALL');

  // Estados de Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [jumpPage, setJumpPage] = useState('');

  // Cargar estado inicial de paginación desde URL o localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPage = params.get('page');
    const urlLimit = params.get('limit');

    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p > 0) setPage(p);
    } else {
      const savedPage = localStorage.getItem('plexsync_admin_mappings_page');
      if (savedPage) {
        const p = parseInt(savedPage, 10);
        if (!isNaN(p) && p > 0) setPage(p);
      }
    }

    if (urlLimit) {
      const l = parseInt(urlLimit, 10);
      if (!isNaN(l) && l > 0) setLimit(l);
    } else {
      const savedLimit = localStorage.getItem('plexsync_admin_mappings_limit');
      if (savedLimit) {
        const l = parseInt(savedLimit, 10);
        if (!isNaN(l) && l > 0) setLimit(l);
      }
    }
  }, []);

  const changePage = (newPage: number, newLimit = limit) => {
    setPage(newPage);
    setLimit(newLimit);
    if (typeof window !== 'undefined') {
      localStorage.setItem('plexsync_admin_mappings_page', String(newPage));
      localStorage.setItem('plexsync_admin_mappings_limit', String(newLimit));
      const url = new URL(window.location.href);
      url.searchParams.set('page', String(newPage));
      url.searchParams.set('limit', String(newLimit));
      window.history.replaceState({}, '', url.toString());
    }
  };

  const handleLimitChange = (newLimit: number) => {
    changePage(1, newLimit);
  };

  const handleSearchFilterChange = (val: string) => {
    setSearchFilter(val);
    changePage(1);
  };

  const handleTypeFilterChange = (val: 'ALL' | 'GLOBAL' | 'USER' | 'PENDING') => {
    setTypeFilter(val);
    changePage(1);
  };

  // Modal de Confirmación
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [isNewMapping, setIsNewMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [activeAdminMappingSheetItem, setActiveAdminMappingSheetItem] = useState<any | null>(null);
  const [plexTitleInput, setPlexTitleInput] = useState('');
  const [plexSeasonInput, setPlexSeasonInput] = useState(1);
  const [isGlobalInput, setIsGlobalInput] = useState(true);

  // Búsqueda en vivo de AniList
  const [remoteSearchQuery, setRemoteSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedRemoteAnime, setSelectedRemoteAnime] = useState<any | null>(null);

  // Semántica de diálogo y gestión de foco de los modales de esta vista.
  const { dialogProps: propsMapeo } = useModalA11y(Boolean(showModal), () => setShowModal(false));

  useEffect(() => {
    loadAdminMappings();
  }, []);

  const loadAdminMappings = async () => {
    try {
      setLoading(true);
      const res = await api.mappings.getAdminAll();
      setMappings(res || []);
    } catch (e: any) {
      showToast(`${t('admin.loadGlobalMappingsError')} ` + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadAdminMappings();
    setIsRefreshing(false);
    showToast(t('admin.systemMappingsUpdated'), 'success');
  };

  const handleToggleGlobal = async (id: string) => {
    try {
      const res = await api.mappings.toggleGlobal(id);
      showToast(
        res.isGlobal
          ? t('mappings.mappingNowGlobal')
          : 'Mapeo global revocado a mapeo personal.',
        'success',
      );
      loadAdminMappings();
    } catch (e: any) {
      showToast('Error: ' + e.message, 'error');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await api.mappings.approve(id);
      showToast(t('mappings.mappingApproved'), 'success');
      loadAdminMappings();
    } catch (e: any) {
      showToast(`${t('admin.approveMappingError')} ` + e.message, 'error');
    }
  };

  const handleDelete = (item: any) => {
    setConfirmModal({
      isOpen: true,
      title: t('admin.confirmDeleteGlobalMapping'),
      description: `¿Deseas eliminar permanentemente el mapeo para "${item.plexTitle}" (Temporada ${item.plexSeason || 1})?`,
      onConfirm: async () => {
        try {
          await api.mappings.unlink(item.id);
          showToast(t('admin.mappingDeleted'), 'info');
          loadAdminMappings();
        } catch (e: any) {
          showToast(`${t('admin.deleteMappingError')} ` + e.message, 'error');
        } finally {
          setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleOpenCreateModal = () => {
    setIsNewMapping(true);
    setEditingMappingId(null);
    setPlexTitleInput('');
    setPlexSeasonInput(1);
    setIsGlobalInput(true);
    setRemoteSearchQuery('');
    setRemoteResults([]);
    setSelectedRemoteAnime(null);
    setShowModal(true);
  };

  const handleOpenEditModal = (item: any) => {
    setIsNewMapping(false);
    setEditingMappingId(item.id);
    setPlexTitleInput(item.plexTitle);
    setPlexSeasonInput(item.plexSeason || 1);
    setIsGlobalInput(item.isGlobal ?? true);
    setRemoteSearchQuery(item.anilistTitle || item.plexTitle);
    setSelectedRemoteAnime({
      id: item.anilistMediaId,
      idMal: item.malMediaId,
      title: {
        romaji: item.anilistTitle || item.plexTitle,
      },
      coverImage: {
        large: item.coverImage,
      },
    });
    setRemoteResults([]);
    setShowModal(true);
    executeRemoteSearch(item.anilistTitle || item.plexTitle, item.plexSeason || 1);
  };

  const executeRemoteSearch = async (query: string, season = 1) => {
    if (!query || query.trim().length === 0) return;
    setIsSearchingRemote(true);
    try {
      const results = await api.mappings.searchRemote(query.trim());
      setRemoteResults(results || []);
    } catch (e: any) {
      console.warn('Error buscando en AniList:', e.message);
    } finally {
      setIsSearchingRemote(false);
    }
  };

  const handleSaveMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!plexTitleInput.trim()) {
      showToast(t('mappings.enterPlexShowName'), 'error');
      return;
    }
    if (!selectedRemoteAnime) {
      showToast(t('mappings.selectAnimeFromResults'), 'error');
      return;
    }

    try {
      await api.mappings.setManual({
        mappingId: editingMappingId || undefined,
        plexTitle: plexTitleInput.trim(),
        plexSeason: Number(plexSeasonInput || 1),
        anilistMediaId: selectedRemoteAnime.id,
        anilistTitle: selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english || plexTitleInput,
        malMediaId: selectedRemoteAnime.idMal || selectedRemoteAnime.id,
        malTitle: selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english,
        isGlobal: isGlobalInput,
      });

      showToast(t('admin.globalMappingSaved'), 'success');
      setShowModal(false);
      loadAdminMappings();
    } catch (err: any) {
      showToast(`${t('mappings.saveMappingError')} ` + err.message, 'error');
    }
  };

  // KPIs
  const totalCount = mappings.length;
  const globalCount = mappings.filter((m) => m.isGlobal).length;
  const userSpecificCount = mappings.filter((m) => !m.isGlobal).length;
  const pendingCount = mappings.filter((m) => !m.isApproved).length;

  // Filtrado
  const filteredMappings = mappings.filter((item) => {
    const matchesSearch =
      (item.plexTitle || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.anilistTitle || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.user?.username || '').toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;
    if (typeFilter === 'GLOBAL') return item.isGlobal;
    if (typeFilter === 'USER') return !item.isGlobal;
    if (typeFilter === 'PENDING') return !item.isApproved;
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredMappings.length / limit));
  const paginatedMappings = filteredMappings.slice((page - 1) * limit, page * limit);

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.mappingsTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <GitMerge className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.globalMappingsTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.globalMappingsSubtitle')}</p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                onClick={handleOpenCreateModal}
                className="btn-primary"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Crear Mapeo Global</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="btn-secondary"
                title={t('admin.refreshMappings')}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('admin.refreshShort')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {/* TARJETAS KPI DE ESTADO */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="glass-card p-5 space-y-1">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span className="text-xs font-mono font-semibold">Total Registrados</span>
              <Layers className="w-4 h-4 text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] font-heading">{totalCount}</p>
          </div>

          <div className="glass-card p-5 space-y-1">
            <div className="flex items-center justify-between text-amber-400">
              <span className="text-xs font-mono font-semibold">Globales Oficiales</span>
              <Globe className="w-4 h-4 text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-400 font-heading">{globalCount}</p>
          </div>

          <div className="glass-card p-5 space-y-1">
            <div className="flex items-center justify-between text-[var(--text-secondary)]">
              <span className="text-xs font-mono font-semibold">{t('admin.userMappings')}</span>
              <Users className="w-4 h-4 text-zinc-400" />
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] font-heading">{userSpecificCount}</p>
          </div>

          <div className="glass-card p-5 space-y-1">
            <div className="flex items-center justify-between text-rose-400">
              <span className="text-xs font-mono font-semibold">{t('admin.pendingConflicts')}</span>
              <AlertTriangle className="w-4 h-4 text-rose-400" />
            </div>
            <p className="text-2xl font-bold text-rose-400 font-heading">{pendingCount}</p>
          </div>
        </div>

        {/* TABLA PRINCIPAL DE MAPEOS ADMIN */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--glass-border)] gap-3">
            <div className="flex items-center gap-2.5">
              <GitMerge className="w-4 h-4 text-[var(--accent-text)]" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.generalMappingCatalogue')}</h2>
              <span className="text-xs text-[var(--text-muted)] font-mono">
                ({filteredMappings.length} mostrados)
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Tabs de Filtro (Swipeable en móvil) */}
              <div className="w-full sm:w-auto flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap shrink-0 pb-1 sm:pb-0">
                <button
                  onClick={() => handleTypeFilterChange('ALL')}
                  className={`${typeFilter === 'ALL' ? 'filter-tab-active' : 'filter-tab'} shrink-0`}
                >
                  Todos ({totalCount})
                </button>
                <button
                  onClick={() => handleTypeFilterChange('GLOBAL')}
                  className={`${typeFilter === 'GLOBAL' ? 'filter-tab-active text-amber-400 border-amber-500/30' : 'filter-tab'} shrink-0`}
                >
                  Globales ({globalCount})
                </button>
                <button
                  onClick={() => handleTypeFilterChange('USER')}
                  className={`${typeFilter === 'USER' ? 'filter-tab-active text-sky-400 border-sky-500/30' : 'filter-tab'} shrink-0`}
                >
                  Usuarios ({userSpecificCount})
                </button>
                <button
                  onClick={() => handleTypeFilterChange('PENDING')}
                  className={`${typeFilter === 'PENDING' ? 'filter-tab-active text-rose-400 border-rose-500/30' : 'filter-tab'} shrink-0`}
                >
                  Pendientes ({pendingCount})
                </button>
              </div>

              {/* Buscador */}
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                <input
                  type="text"
                  placeholder={t('admin.searchAnimeOrUser')}
                      aria-label={t('admin.searchMappingsBy')}
                  value={searchFilter}
                  onChange={(e) => handleSearchFilterChange(e.target.value)}
                  suppressHydrationWarning
                  className="glass-input glass-input-icon w-full sm:w-64 text-xs"
                />
              </div>
            </div>
          </div>

          {/* Lista con Formato Adaptable */}
          <div className="divide-y divide-[var(--glass-border)]">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="py-4 px-2 sm:px-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
                  <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1">
                    <div className="skeleton w-12 h-16 sm:w-12 sm:h-18 rounded-[6px] shrink-0" />
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="skeleton h-4 w-44 rounded" />
                        <div className="skeleton h-4 w-24 rounded-full" />
                        <div className="skeleton h-4 w-20 rounded" />
                      </div>
                      <div className="skeleton h-3 w-64 rounded" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="skeleton h-8 w-24 rounded-[6px]" />
                    <div className="skeleton h-8 w-24 rounded-[6px]" />
                    <div className="skeleton h-8 w-8 rounded-[6px]" />
                  </div>
                </div>
              ))
            ) : filteredMappings.length === 0 ? (
              <div className="py-16 text-center text-xs font-mono text-[var(--text-muted)]">{t('admin.noMappingsForSelectedFilter')}</div>
            ) : (
              paginatedMappings.map((item) => {
                const isApproved = item.isApproved;

                return (
                  <div
                    key={item.id}
                    className="py-4 px-2 sm:px-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:bg-[var(--bg-surface-hover)] transition-colors rounded-[6px] group"
                  >
                    {/* LADO IZQUIERDO: PORTADA + DETALLES COMPLETOS */}
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                      {item.coverImage ? (
                        <img
                          src={item.coverImage}
                          alt={item.anilistTitle || item.plexTitle}
                          onError={(e) => {
                            e.currentTarget.onerror = null;
                            if (item.anilistMediaId) {
                              e.currentTarget.src = `https://img.anili.st/media/${item.anilistMediaId}`;
                            } else {
                              e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                            }
                          }}
                          className="w-12 h-16 sm:w-12 sm:h-18 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0"
                        />
                      ) : (
                        <div className="w-12 h-16 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-muted)] text-[10px] font-mono">
                          <Film className="w-4 h-4 text-[var(--text-muted)]" />
                        </div>
                      )}

                      <div className="min-w-0 space-y-1.5 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors leading-snug">
                            {item.plexTitle}
                          </h3>
                          <span className="badge-pill">
                            Temporada {item.plexSeason || 1}
                          </span>
                          {item.isGlobal && (
                            <span className="px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1 shadow-sm shrink-0">
                              <Globe className="w-3 h-3" /> GLOBAL OFICIAL
                            </span>
                          )}
                          <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">
                            Por: @{item.user?.username || 'Sistema'}
                          </span>
                        </div>

                        <p className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-2 flex-wrap">
                          <span className="text-sky-400 font-semibold">
                            AniList: {item.anilistTitle || item.plexTitle} (#{item.anilistMediaId})
                          </span>
                          {item.malMediaId && (
                            <>
                              <span className="text-[var(--text-muted)]">•</span>
                              <span className="text-purple-400">MAL: #{item.malMediaId}</span>
                            </>
                          )}
                          <span className="text-[var(--text-muted)]">•</span>
                          <span className="text-[var(--text-muted)]">
                            Confianza: {Math.round((item.confidenceScore || 0.95) * 100)}%
                          </span>
                        </p>
                      </div>
                    </div>

                    {/* LADO DERECHO EN MÓVIL: BADGE + BOTÓN 3 PUNTOS */}
                    <div className="flex md:hidden items-center justify-between gap-2 pt-2 border-t border-[var(--glass-border)]">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {item.isGlobal && (
                          <span className="badge-status-warning text-[10.5px]">
                            Global
                          </span>
                        )}
                        <span className={isApproved ? 'badge-action-success text-[10.5px]' : 'badge-action-warning text-[10.5px]'}>
                          {isApproved ? 'Vinculado' : 'Pendiente'}
                        </span>
                      </div>

                      <button
                        onClick={() => setActiveAdminMappingSheetItem(item)}
                        className="btn-secondary p-2 shrink-0 rounded-[8px]"
                        title={t('mappings.mappingOptions')}
                        aria-label={t('mappings.openMappingOptions')}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                    </div>

                    {/* LADO DERECHO EN ESCRITORIO (md:): ACCIONES ADMIN */}
                    <div className="hidden md:flex items-center flex-wrap gap-2 shrink-0 justify-end">
                      {/* Botón Convertir en Global / Revocar Global */}
                      <button
                        onClick={() => handleToggleGlobal(item.id)}
                        className={`btn-secondary text-xs font-mono flex items-center gap-1.5 ${
                          item.isGlobal
                            ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                            : ''
                        }`}
                        title={
                          item.isGlobal
                            ? 'Revocar estado Global Oficial'
                            : t('admin.makeOfficialGlobal')
                        }
                      >
                        <Globe className="w-3.5 h-3.5 text-amber-400" />
                        <span>{item.isGlobal ? 'Global ✔' : t('mappings.makeGlobal')}</span>
                      </button>

                      {/* Botón Aprobar (Si está pendiente) */}
                      {!isApproved && (
                        <button
                          onClick={() => handleApprove(item.id)}
                          className="btn-primary flex items-center gap-1 text-xs"
                          title="Aprobar mapeo"
                        >
                          <Check className="w-3 h-3 stroke-[3]" />
                          <span>Aprobar</span>
                        </button>
                      )}

                      {/* Botón Editar */}
                      <button
                        onClick={() => handleOpenEditModal(item)}
                        className="btn-secondary btn-icon"
                        title={t('admin.editMappingLabel')}
                      >
                        <Edit3 className="w-4 h-4 text-[var(--accent-text)]" />
                      </button>

                      {/* Botón Eliminar */}
                      <button
                        onClick={() => handleDelete(item)}
                        className="btn-danger btn-icon"
                        title={t('admin.deleteMappingPermanently')}
                      >
                        <Trash2 className="w-4 h-4 text-rose-400" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* BARRA DE PAGINACIÓN COMPLETA */}
          {filteredMappings.length > 0 && (
            <div className="pt-4 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Selector de Límite & Conteo */}
              <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)] flex-wrap">
                <span>
                  Mostrando <strong className="text-[var(--text-primary)]">{(page - 1) * limit + 1}</strong> a{' '}
                  <strong className="text-[var(--text-primary)]">{Math.min(page * limit, filteredMappings.length)}</strong> de{' '}
                  <strong className="text-[var(--text-primary)]">{filteredMappings.length}</strong>{' '}{t('admin.mappingsWord')}</span>

                <div className="flex items-center gap-1.5 ml-0 md:ml-2">
                  <span className="text-[11px]">Mostrar:</span>
                  <div className="w-28">
                    <CustomSelect
                      value={String(limit)}
                      onChange={(val) => handleLimitChange(Number(val))}
                      options={[
                        { value: '10', label: '10 / pág' },
                        { value: '25', label: '25 / pág' },
                        { value: '50', label: '50 / pág' },
                        { value: '100', label: t('mappings.hundredPerPage') },
                      ]}
                      accentColor="cinnabar"
                    />
                  </div>
                </div>
              </div>

              {/* Controles de Navegación de Página */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  {/* Ir a Primera Página */}
                  <button
                    onClick={() => changePage(1)}
                    disabled={page === 1 || loading}
                    className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title={t('mappings.firstPage')}
                  >
                    <ChevronsLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Página Anterior */}
                  <button
                    onClick={() => changePage(Math.max(1, page - 1))}
                    disabled={page === 1 || loading}
                    className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title={t('mappings.previousPage')}
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>

                  {/* Números de Página */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    let pageNum = page;
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (page <= 3) {
                      pageNum = i + 1;
                    } else if (page >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = page - 2 + i;
                    }

                    return (
                      <button
                        key={pageNum}
                        onClick={() => changePage(pageNum)}
                        disabled={loading}
                        className={`w-8 h-8 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                          page === pageNum
                            ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                            : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* Página Siguiente */}
                  <button
                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                    disabled={page === totalPages || loading}
                    className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title={t('mappings.nextPage')}
                  >
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>

                  {/* Ir a Última Página */}
                  <button
                    onClick={() => changePage(totalPages)}
                    disabled={page === totalPages || loading}
                    className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
                    title={t('mappings.lastPage')}
                  >
                    <ChevronsRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Salto Directo a Página */}
              {totalPages > 1 && (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    const target = parseInt(jumpPage, 10);
                    if (!isNaN(target) && target >= 1 && target <= totalPages) {
                      changePage(target);
                      setJumpPage('');
                    }
                  }}
                  className="flex items-center gap-2"
                >
                  <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">{t('mappings.goToPage')}</span>
                  <input
                    type="number"
                    min={1}
                    max={totalPages}
                    placeholder={String(page)}
                    value={jumpPage}
                    onChange={(e) => setJumpPage(e.target.value)}
                    className="glass-input text-xs font-mono w-14 py-1 text-center"
                  />
                  <button
                    type="submit"
                    disabled={!jumpPage || loading}
                    className="btn-secondary text-xs py-1 px-2.5 cursor-pointer"
                  >
                    Ir
                  </button>
                </form>
              )}
            </div>
          )}
        </div>

        {/* MODAL ADMIN */}
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in duration-200">
            <div
              {...propsMapeo}
              className="w-full max-w-2xl rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 space-y-6 shadow-[var(--glass-shadow-lg)] text-[var(--text-primary)]">
              <div className="flex items-center justify-between pb-3 border-b border-[var(--glass-border)]">
                <div className="flex items-center gap-2.5">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
                    {isNewMapping ? t('admin.createGlobalMapping') : t('admin.editAdminMapping')}
                  </h3>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveMapping} className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2 space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('admin.plexSeriesTitle')}</label>
                    <input
                      type="text"
                      required
                      placeholder="Ej. Mushoku Tensei: Isekai Ittara Honki Dasu"
                      aria-label={t('admin.animeTitleInPlex')}
                      value={plexTitleInput}
                      onChange={(e) => setPlexTitleInput(e.target.value)}
                      suppressHydrationWarning
                      className="glass-input text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">Temporada:</label>
                    <div className="relative flex items-center">
                      <input
                        type="number"
                        min="1"
                        required
                        value={plexSeasonInput}
                        onChange={(e) => setPlexSeasonInput(Math.max(1, parseInt(e.target.value) || 1))}
                        suppressHydrationWarning
                        className="glass-input text-xs font-mono font-medium pl-3 pr-16"
                      />
                      <div className="absolute right-1 flex items-center gap-0.5">
                        <button
                          type="button"
                          onClick={() => setPlexSeasonInput((prev) => Math.max(1, (Number(prev) || 1) - 1))}
                          className="w-6 h-6 flex items-center justify-center rounded-[4px] bg-[var(--btn-secondary-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer"
                          title={t('mappings.previousSeason')}
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPlexSeasonInput((prev) => (Number(prev) || 1) + 1)}
                          className="w-6 h-6 flex items-center justify-center rounded-[4px] bg-[var(--btn-secondary-bg)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-all active:scale-95 cursor-pointer"
                          title={t('mappings.nextSeason')}
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
                  <input
                    type="checkbox"
                    id="isGlobalCheckbox"
                    checked={isGlobalInput}
                    onChange={(e) => setIsGlobalInput(e.target.checked)}
                    className="w-4 h-4 rounded-[4px] accent-amber-500"
                  />
                  <label htmlFor="isGlobalCheckbox" className="text-xs font-semibold text-[var(--text-primary)] cursor-pointer">{t('admin.enableAsGlobal')}</label>
                </div>

                <div className="space-y-2 pt-2 border-t border-[var(--glass-border)]">
                  <label className="text-xs font-bold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>{t('admin.searchSeriesAniList')}</span>
                    {selectedRemoteAnime && (
                      <span className="text-[11px] font-mono text-emerald-400">
                        Seleccionado: #{selectedRemoteAnime.id}
                      </span>
                    )}
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                      <input
                        type="text"
                        placeholder={t('admin.searchByTitlePlaceholder')}
                      aria-label={t('admin.searchTitleOnAniList')}
                        value={remoteSearchQuery}
                        onChange={(e) => setRemoteSearchQuery(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            executeRemoteSearch(remoteSearchQuery, plexSeasonInput);
                          }
                        }}
                        suppressHydrationWarning
                        className="glass-input glass-input-icon text-xs font-mono"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => executeRemoteSearch(remoteSearchQuery, plexSeasonInput)}
                      disabled={isSearchingRemote}
                      className="btn-secondary text-xs flex items-center gap-1.5"
                    >
                      {isSearchingRemote ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Search className="w-3.5 h-3.5" />}
                      <span>{t('admin.searchWord')}</span>
                    </button>
                  </div>

                  {remoteResults.length > 0 && (
                    <div className="max-h-56 overflow-y-auto space-y-2 p-2 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] mt-2">
                      {remoteResults.map((r) => {
                        const isSelected = selectedRemoteAnime?.id === r.id;
                        return (
                          <div
                            key={r.id}
                            onClick={() => setSelectedRemoteAnime(r)}
                            className={`p-2 rounded-[6px] flex items-center justify-between gap-3 cursor-pointer transition-all ${
                              isSelected
                                ? 'bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] shadow-sm'
                                : 'hover:bg-[var(--bg-surface-hover)] border border-transparent'
                            }`}
                          >
                            <div className="flex items-center gap-3 min-w-0">
                              {r.coverImage?.large || r.coverImage?.medium ? (
                                <img
                                  src={r.coverImage.large || r.coverImage?.medium}
                                  alt={r.title?.romaji}
                                  className="w-8 h-11 rounded-[4px] object-cover border border-[var(--border-subtle)] shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-11 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0 flex items-center justify-center text-[9px] text-[var(--text-muted)]">
                                  IMG
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="text-xs font-bold text-[var(--text-primary)] truncate">
                                  {r.title?.romaji || r.title?.english}
                                </h4>
                                <p className="text-[10.5px] text-[var(--text-muted)] font-mono">
                                  ID: #{r.id} • {r.format || 'TV'} • {r.episodes ? `${r.episodes} eps` : 'En emisión'}
                                  {r.seasonYear ? ` • ${r.seasonYear}` : ''}
                                </p>
                              </div>
                            </div>

                            <div className="shrink-0">
                              {isSelected ? (
                                <span className="badge-status-success">
                                  SELECCIONADO
                                </span>
                              ) : (
                                <span className="badge-pill">
                                  Elegir
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--glass-border)]">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="btn-secondary"
                  >{t('common.cancel')}</button>
                  <button
                    type="submit"
                    disabled={!selectedRemoteAnime}
                    className="btn-primary"
                  >
                    <Check className="w-3.5 h-3.5 stroke-[3]" />
                    <span>{t('admin.saveGlobalMapping')}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      {/* BOTTOM SHEET NATIVO MÓVIL PARA MAPEOS ADMIN */}
      {activeAdminMappingSheetItem && (
        <BottomSheet
          isOpen={!!activeAdminMappingSheetItem}
          onClose={() => setActiveAdminMappingSheetItem(null)}
          title={activeAdminMappingSheetItem.plexTitle}
          subtitle={`Temporada ${activeAdminMappingSheetItem.plexSeason || 1} • Por: @${activeAdminMappingSheetItem.user?.username || 'Sistema'}`}
          headerImage={
            activeAdminMappingSheetItem.coverImage ? (
              <img
                src={activeAdminMappingSheetItem.coverImage}
                alt={activeAdminMappingSheetItem.anilistTitle || activeAdminMappingSheetItem.plexTitle}
                className="w-10 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
              />
            ) : (
              <div className="w-10 h-14 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Film className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            )
          }
          headerBadge={
            <span
              className={
                activeAdminMappingSheetItem.isGlobal
                  ? 'badge-status-warning text-[10px] font-mono'
                  : 'badge-pill text-[10px] font-mono'
              }
            >
              {activeAdminMappingSheetItem.isGlobal ? 'Global Oficial' : 'Usuario'}
            </span>
          }
          actions={[
            {
              label: t('mappings.editMapping'),
              sublabel: t('admin.searchAndLinkAnotherAnime'),
              icon: Edit3,
              iconColor: 'text-[var(--accent-text)]',
              onClick: () => handleOpenEditModal(activeAdminMappingSheetItem),
            },
            {
              label: activeAdminMappingSheetItem.isGlobal ? 'Revocar Mapeo Global' : t('mappings.promoteToGlobal'),
              sublabel: activeAdminMappingSheetItem.isGlobal
                ? t('admin.revertToStandardMapping')
                : t('admin.masterMappingApplied'),
              icon: Globe,
              iconColor: 'text-amber-400',
              onClick: () => handleToggleGlobal(activeAdminMappingSheetItem.id),
            },
            ...(!activeAdminMappingSheetItem.isApproved
              ? [
                  {
                    label: 'Aprobar Mapeo',
                    sublabel: t('admin.approveToEnableSync'),
                    icon: Check,
                    variant: 'success' as const,
                    onClick: () => handleApprove(activeAdminMappingSheetItem.id),
                  },
                ]
              : []),
            ...(activeAdminMappingSheetItem.anilistMediaId
              ? [
                  {
                    label: t('mappings.viewOnAniList'),
                    sublabel: `AniList: ${activeAdminMappingSheetItem.anilistTitle || activeAdminMappingSheetItem.plexTitle} (#${activeAdminMappingSheetItem.anilistMediaId})`,
                    icon: ExternalLink,
                    iconColor: 'text-sky-400',
                    onClick: () => {
                      window.open(`https://anilist.co/anime/${activeAdminMappingSheetItem.anilistMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            ...(activeAdminMappingSheetItem.malMediaId
              ? [
                  {
                    label: t('catalog.viewOnMal'),
                    sublabel: `MAL ID: #${activeAdminMappingSheetItem.malMediaId}`,
                    icon: ExternalLink,
                    iconColor: 'text-purple-400',
                    onClick: () => {
                      window.open(`https://myanimelist.net/anime/${activeAdminMappingSheetItem.malMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            {
              label: t('admin.deleteMappingPermanentlyTitle'),
              sublabel: t('admin.deleteMappingRuleDesc'),
              icon: Trash2,
              variant: 'danger' as const,
              onClick: () => handleDelete(activeAdminMappingSheetItem),
            },
          ]}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText="Eliminar"
        cancelText="Cancelar"
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
