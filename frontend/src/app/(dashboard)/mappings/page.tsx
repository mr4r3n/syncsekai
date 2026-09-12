'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ListRow, ListRows } from '@/components/ListRow';
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
  CheckCircle2,
  AlertCircle,
  Download,
  Upload,
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

export default function MappingsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t } = useI18n();
  const [currentUser, setCurrentUser] = useState<any>(null);
  // El historial y las notificaciones enlazan aqui con el anime a mapear:
  // /mappings?search=Titulo&season=2.
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL'>('ALL');

  // Estados de Paginación
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [jumpPage, setJumpPage] = useState('');

  // Cargar estado inicial de paginación desde URL o localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const titulo = (params.get('search') || '').trim();
    if (!titulo) return;

    const temporada = Math.max(1, parseInt(params.get('season') || '1', 10) || 1);
    setSearchFilter(titulo);
    handleOpenCreateModal(titulo, temporada);

    // La intencion se gasta al usarla: recargar la pagina despues no deberia
    // volver a abrir la ventana.
    const url = new URL(window.location.href);
    url.searchParams.delete('search');
    url.searchParams.delete('season');
    window.history.replaceState({}, '', url.toString());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const urlPage = params.get('page');
    const urlLimit = params.get('limit');

    if (urlPage) {
      const p = parseInt(urlPage, 10);
      if (!isNaN(p) && p > 0) setPage(p);
    } else {
      const savedPage = localStorage.getItem('plexsync_mappings_page');
      if (savedPage) {
        const p = parseInt(savedPage, 10);
        if (!isNaN(p) && p > 0) setPage(p);
      }
    }

    if (urlLimit) {
      const l = parseInt(urlLimit, 10);
      if (!isNaN(l) && l > 0) setLimit(l);
    } else {
      const savedLimit = localStorage.getItem('plexsync_mappings_limit');
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
      localStorage.setItem('plexsync_mappings_page', String(newPage));
      localStorage.setItem('plexsync_mappings_limit', String(newLimit));
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

  const handleStatusFilterChange = (val: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL') => {
    setStatusFilter(val);
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

  // Modal de Búsqueda y Edición Manual
  const [showModal, setShowModal] = useState(false);
  const [isNewMapping, setIsNewMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [activeMappingSheetItem, setActiveMappingSheetItem] = useState<any | null>(null);
  const [plexTitleInput, setPlexTitleInput] = useState('');
  const [plexSeasonInput, setPlexSeasonInput] = useState(1);
  const [isSavingModal, setIsSavingModal] = useState(false);

  // Búsqueda en vivo de AniList dentro del modal
  const [remoteSearchQuery, setRemoteSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedRemoteAnime, setSelectedRemoteAnime] = useState<any | null>(null);

  // Semántica de diálogo y gestión de foco de los modales de esta vista.
  const { dialogProps: propsMapeo } = useModalA11y(Boolean(showModal), () => setShowModal(false));

  useEffect(() => {
    loadUserAndMappings();
  }, []);

  const loadUserAndMappings = async () => {
    try {
      setLoading(true);
      const [userRes, mapRes] = await Promise.allSettled([
        api.auth.me(),
        api.mappings.get(),
      ]);

      if (userRes.status === 'fulfilled') {
        const u = userRes.value?.user || userRes.value;
        setCurrentUser(u);
      }
      if (mapRes.status === 'fulfilled') {
        setMappings(mapRes.value || []);
      }
    } catch (e: any) {
      showToast(`${t('mappings.loadMappingsError')} ` + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUserAndMappings();
    setIsRefreshing(false);
    showToast(t('mappings.updatedToast'), 'success');
  };

  const handleApprove = async (id: string) => {
    try {
      await api.mappings.approve(id);
      showToast(t('mappings.mappingApproved'), 'success');
      loadUserAndMappings();
    } catch (e) {
      setMappings((prev) =>
        prev.map((m) => (m.id === id ? { ...m, isApproved: true, confidenceScore: 1.0 } : m)),
      );
      showToast(t('mappings.mappingApproved'), 'success');
    }
  };

  const handleToggleGlobal = async (id: string) => {
    try {
      const res = await api.mappings.toggleGlobal(id);
      showToast(
        res.isGlobal
          ? t('mappings.mappingNowGlobal')
          : t('mappings.revokedToPersonal'),
        'success',
      );
      loadUserAndMappings();
    } catch (e: any) {
      showToast(`${t('mappings.globalMappingError')} ` + e.message, 'error');
    }
  };

  const handleUnlink = (item: any) => {
    setConfirmModal({
      isOpen: true,
      title: t('mappings.unlinkConfirm'),
      description: `¿Deseas desvincular el mapeo para "${item.plexTitle}" (Temporada ${item.plexSeason || 1})? Los futuros scrobbles volverán a buscar coincidencias automáticamente.`,
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setMappings((prev) => prev.filter((m) => m.id !== item.id));
        showUndoToast(t('common.deletingItem', { name: item.plexTitle }), {
          alDeshacer: () => loadUserAndMappings(),
          alExpirar: async () => {
            try {
              await api.mappings.unlink(item.id);
              showToast(t('mappings.mappingUnlinked'), 'info');
            } catch (e: any) {
              showToast(e.message || t('mappings.deletedToast'), 'error');
            }
            loadUserAndMappings();
          },
        });
      },
    });
  };

  // Abrir Modal para Nuevo Mapeo
  const handleOpenCreateModal = (titulo = '', temporada = 1) => {
    setIsNewMapping(true);
    setEditingMappingId(null);
    setPlexTitleInput(titulo);
    setPlexSeasonInput(temporada);
    // Con titulo, la busqueda del tracker arranca por el: es lo unico que se
    // sabe del anime y lo primero que habria que escribir a mano.
    setRemoteSearchQuery(titulo);
    setRemoteResults([]);
    setSelectedRemoteAnime(null);
    setShowModal(true);
  };

  // Abrir Modal para Editar Mapeo Existente
  const handleOpenEditModal = (item: any) => {
    setIsNewMapping(false);
    setEditingMappingId(item.id);
    setPlexTitleInput(item.plexTitle);
    setPlexSeasonInput(item.plexSeason || 1);
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

  // Búsqueda en Vivo de AniList
  const executeRemoteSearch = async (query: string, season = 1) => {
    if (!query || query.trim().length === 0) return;
    setIsSearchingRemote(true);
    try {
      const results = await api.mappings.searchRemote(query.trim(), season);
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
      setIsSavingModal(true);
      await api.mappings.setManual({
        mappingId: editingMappingId || undefined,
        plexTitle: plexTitleInput.trim(),
        plexSeason: Number(plexSeasonInput || 1),
        anilistMediaId: selectedRemoteAnime.id,
        anilistTitle: selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english || plexTitleInput,
        // Antes caía a selectedRemoteAnime.id cuando no había idMal real: cuando el
        // resultado venía del fallback de Kitsu (sin match en MAL), eso guardaba el
        // ID de Kitsu como si fuera de MyAnimeList -- mismo tipo de bug que el de
        // kitsuMediaId de arriba, confirmado en vivo (malMediaId=48915 siendo en
        // realidad un ID de Kitsu). Sin idMal real, no se manda nada.
        malMediaId: selectedRemoteAnime.idMal ? Number(selectedRemoteAnime.idMal) : undefined,
        malTitle: selectedRemoteAnime.idMal
          ? (selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english)
          : undefined,
        // kitsuMediaId es Int? en la base de datos: solo se envía cuando el resultado
        // realmente viene de Kitsu (selectedRemoteAnime.kitsuId), nunca el id de AniList
        // disfrazado de id de Kitsu (guardaría el tracker equivocado) y nunca como string
        // (Prisma lo rechaza con un error 500 porque la columna es numérica).
        kitsuMediaId: selectedRemoteAnime.kitsuId ? Number(selectedRemoteAnime.kitsuId) : undefined,
        kitsuTitle: selectedRemoteAnime.kitsuId
          ? (selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english || plexTitleInput)
          : undefined,
      });

      showToast(t('mappings.mappingSaved'), 'success');
      setShowModal(false);
      loadUserAndMappings();
    } catch (err: any) {
      showToast(`${t('mappings.saveMappingError')} ` + err.message, 'error');
    } finally {
      setIsSavingModal(false);
    }
  };

  const isAdmin = currentUser?.role === 'ADMIN';

  // Exportar Mapeos en Formato JSON
  const handleExportMappings = () => {
    if (mappings.length === 0) {
      showToast(t('mappings.noMappingsToExport'), 'info');
      return;
    }
    const exportData = mappings.map((m) => ({
      plexTitle: m.plexTitle,
      plexSeason: m.plexSeason || 1,
      anilistMediaId: m.anilistMediaId,
      anilistTitle: m.anilistTitle,
      malMediaId: m.malMediaId,
      malTitle: m.malTitle,
      isGlobal: !!m.isGlobal,
    }));
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `plexsync-mappings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Se exportaron ${mappings.length} mapeos en archivo JSON.`, 'success');
  };

  // Importar Mapeos desde Archivo JSON
  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (!Array.isArray(parsed)) {
        showToast(t('mappings.invalidJsonMappings'), 'error');
        return;
      }
      const res = await api.mappings.import(parsed);
      showToast(res.message || t('mappings.mappingsImported'), 'success');
      await loadUserAndMappings();
    } catch (err: any) {
      showToast(`${t('mappings.importJsonError')} ` + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  // Filtrado de Mapeos
  const filteredMappings = mappings.filter((item) => {
    const matchesSearch =
      (item.plexTitle || '').toLowerCase().includes(searchFilter.toLowerCase()) ||
      (item.anilistTitle || '').toLowerCase().includes(searchFilter.toLowerCase());

    if (!matchesSearch) return false;
    if (statusFilter === 'APPROVED') return item.isApproved;
    if (statusFilter === 'PENDING') return !item.isApproved;
    if (statusFilter === 'GLOBAL') return item.isGlobal;
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
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          rootLabel={t('navigation.userLibrary')}
          currentLabel={t('mappings.title')}
          onRefresh={handleRefresh}
          isRefreshing={isRefreshing}
        />

        <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
          {/* HEADER MINIMALISTA */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="space-y-1">
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                {t('mappings.title')}
              </h1>
              <p className="text-xs text-[var(--text-secondary)]">
                {t('mappings.subtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <button
                onClick={() => handleOpenCreateModal()}
                className="btn-primary flex-1 sm:flex-initial"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('mappings.newMapping')}</span>
              </button>

              <label className="btn-secondary cursor-pointer" title={t('mappings.import')}>
                <Upload className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">{t('mappings.import')}</span>
                <input
                  type="file"
                  accept=".json,application/json"
                  className="hidden"
                  onChange={handleImportFile}
                />
              </label>

              <button
                type="button"
                onClick={handleExportMappings}
                className="btn-secondary"
                title={t('mappings.export')}
              >
                <Download className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">{t('mappings.export')}</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="btn-secondary"
                title={t('mappings.refreshMappings')}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[#02a9ff] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">{t('mappings.refresh')}</span>
              </button>
            </div>
          </div>

          {/* FILTROS, FUERA DEL CONTENEDOR
              Estaban dentro de la tarjeta, apretados contra su cabecera y
              compitiendo con el buscador por la misma fila. Filtrar decide QUE
              lista se ve, asi que va antes de la lista, no dentro. Es ademas
              como funciona el catalogo, que tenia el mismo problema.

              Pildoras en escritorio y desplegable en movil, por lo mismo que
              alli: cuatro pestanas no caben en 375 px sin cortarse. */}
          {(() => {
            const filtros: { id: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL'; etiqueta: string; cuenta: number; activo: string }[] = [
              { id: 'ALL', etiqueta: t('mappings.filterAll'), cuenta: mappings.length, activo: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]' },
              { id: 'APPROVED', etiqueta: t('mappings.filterLinked'), cuenta: mappings.filter((m) => m.isApproved).length, activo: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/30' },
              { id: 'PENDING', etiqueta: t('mappings.filterPending'), cuenta: mappings.filter((m) => !m.isApproved).length, activo: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30' },
              { id: 'GLOBAL', etiqueta: t('mappings.filterGlobal'), cuenta: mappings.filter((m) => m.isGlobal).length, activo: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]' },
            ];

            return (
              <>
                <div className="sm:hidden">
                  <CustomSelect
                    value={statusFilter}
                    onChange={(v: string) => handleStatusFilterChange(v as any)}
                    options={filtros.map((f) => ({
                      value: f.id,
                      label: f.etiqueta,
                      badge: String(f.cuenta),
                    }))}
                  />
                </div>

                <div
                  role="tablist"
                  aria-label={t('mappings.filterByStatus')}
                  className="hidden sm:flex items-center gap-1.5 flex-wrap text-xs"
                >
                  {filtros.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === f.id}
                      onClick={() => handleStatusFilterChange(f.id)}
                      className={`px-3 py-1.5 rounded-[var(--radius-md)] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        statusFilter === f.id
                          ? `${f.activo} font-bold shadow-sm`
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {f.etiqueta} ({f.cuenta})
                    </button>
                  ))}
                </div>
              </>
            );
          })()}

          {/* CONTENEDOR PRINCIPAL: ESTILO SHOWS MÁS VISTOS DE ADMIN */}
          <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-0 py-4 sm:p-6 space-y-4">
            {/* Cabecera & Barra de Filtros */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 px-3 sm:px-0 border-b border-[var(--glass-border)] gap-3">
              <div className="flex items-center gap-2.5">
                <GitMerge className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('mappings.activeAssociations')}</h2>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  ({t('mappings.countLabel', { n: filteredMappings.length })})
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2.5">

                {/* Input de Búsqueda */}
                <div className="relative flex-1 sm:flex-initial">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                  <input
                    type="text"
                    placeholder={t('mappings.searchPlaceholder')}
                    value={searchFilter}
                    onChange={(e) => handleSearchFilterChange(e.target.value)}
                    suppressHydrationWarning
                    className="glass-input glass-input-icon w-full sm:w-64 text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Listado de Mapeos con Formato Adaptable */}
            <div className="divide-y divide-[var(--glass-border)]">
              {loading ? (
                <div className="py-16 text-center text-xs font-mono text-[var(--text-muted)]">{t('mappings.loadingCatalogue')}</div>
              ) : filteredMappings.length === 0 ? (
                <div className="py-16 text-center text-xs font-mono text-[var(--text-muted)]">{t('mappings.noMappingsForFilter')}</div>
              ) : (
                <ListRows label={t('mappings.title')}>
                {paginatedMappings.map((item) => {
                  const isApproved = item.isApproved;

                  return (
                    <ListRow
                      key={item.id}
                      onOpen={() => setActiveMappingSheetItem(item)}
                      openLabel={t('mappings.openMappingOptions')}
                      tone={isApproved ? 'default' : 'danger'}
                      media={
                        item.coverImage ? (
                          <img
                            src={item.coverImage}
                            alt=""
                            loading="lazy"
                            onError={(e) => {
                              e.currentTarget.onerror = null;
                              e.currentTarget.src = item.anilistMediaId
                                ? `https://img.anili.st/media/${item.anilistMediaId}`
                                : 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                            }}
                            className="w-9 h-12 rounded-[var(--radius-sm)] object-cover border border-[var(--border-subtle)] bg-[var(--bg-app)]"
                          />
                        ) : (
                          <div className="w-9 h-12 rounded-[var(--radius-sm)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                            <Film className="w-4 h-4" aria-hidden="true" />
                          </div>
                        )
                      }
                      title={item.plexTitle}
                      badge={
                        item.isGlobal ? (
                          <span className="badge-status-warning shrink-0">
                            <Globe className="w-3 h-3" aria-hidden="true" /> {t('mappings.globalOfficial')}
                          </span>
                        ) : item.isManual ? (
                          <span className="badge-pill shrink-0">{t('mappings.manual')}</span>
                        ) : null
                      }
                      meta={[
                        `${t('mappings.seasonPrefix')}${item.plexSeason || 1}`,
                        <span key="al" className="text-[var(--brand-anilist)] font-semibold">
                          AniList #{item.anilistMediaId}
                        </span>,
                        item.malMediaId ? `MAL #${item.malMediaId}` : null,
                        item.matchScore ? `${Math.round(item.matchScore * 100)}%` : null,
                      ]}
                      status={
                        // Pildora, no boton: antes compartia altura, borde y
                        // familia visual con "Editar" y "Hacer Global" que
                        // tiene al lado, y la gente la pulsaba esperando algo.
                        // pointer-events-none lo deja claro tambien al raton.
                        <span
                          className={`shrink-0 pointer-events-none inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                            isApproved
                              ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]'
                              : 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
                          }`}
                        >
                          {isApproved ? (
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          ) : (
                            <AlertCircle className="w-3 h-3" aria-hidden="true" />
                          )}
                          {isApproved ? t('mappings.linked') : t('mappings.pending')}
                        </span>
                      }
                      actions={
                        <div className="hidden xl:flex items-center gap-1.5">
                          {!isApproved && (
                            <button
                              onClick={() => handleApprove(item.id)}
                              className="btn-primary"
                              title={t('mappings.approveForAutoSync')}
                            >
                              <Check className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{t('mappings.approve')}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleOpenEditModal(item)}
                            className="btn-secondary"
                            title={t('mappings.changeLinkedAnime')}
                          >
                            <Edit3 className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                            <span>{t('mappings.edit')}</span>
                          </button>

                          {currentUser?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleToggleGlobal(item.id)}
                              className={`btn-secondary ${
                                item.isGlobal ? 'text-[var(--status-warning)] border-[var(--status-warning)]/30' : ''
                              }`}
                              title={
                                item.isGlobal
                                  ? t('mappings.globalActiveClickRevoke')
                                  : t('mappings.promoteToGlobalTitle')
                              }
                            >
                              <Globe className="w-3.5 h-3.5 text-[var(--status-warning)]" aria-hidden="true" />
                              <span>{item.isGlobal ? t('mappings.globalOn') : t('mappings.makeGlobal')}</span>
                            </button>
                          )}

                          <button
                            onClick={() => handleUnlink(item)}
                            className="btn-danger btn-icon"
                            title={t('mappings.deleteMapping')}
                            aria-label={t('mappings.deleteMapping')}
                          >
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          </button>
                        </div>
                      }
                    />
                  );
                })}
                </ListRows>
              )}
            </div>

            {/* BARRA DE PAGINACIÓN COMPLETA */}
            {filteredMappings.length > 0 && (
              <div className="pt-4 px-3 sm:px-0 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-4">
                {/* Selector de Límite & Conteo */}
                <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)] flex-wrap">
                  <span>
                    {t('mappings.showingRange', { from: (page - 1) * limit + 1, to: Math.min(page * limit, filteredMappings.length), total: filteredMappings.length })}
                  </span>

                  <div className="flex items-center gap-1.5 ml-0 md:ml-2">
                    <span className="text-[11px]">{t('mappings.show')}</span>
                    <div className="w-28">
                      <CustomSelect
                        value={String(limit)}
                        onChange={(val) => handleLimitChange(Number(val))}
                        options={[
                          { value: '10', label: t('mappings.perPage', { n: 10 }) },
                          { value: '25', label: t('mappings.perPage', { n: 25 }) },
                          { value: '50', label: t('mappings.perPage', { n: 50 }) },
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
                      {t('mappings.goButton')}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>

          {/* Modal de Búsqueda y Edición de Mapeo */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
              <div
                {...propsMapeo}
                className="relative w-full max-w-2xl rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-2xl shadow-[var(--glass-shadow-lg)] p-6 space-y-6 text-[var(--text-primary)] max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between pb-4 border-b border-[var(--border-subtle)]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center">
                      <Sparkles className="w-4 h-4" />
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">
                        {isNewMapping ? 'Crear Mapeo Manual' : t('mappings.editAnimeLink')}
                      </h2>
                      <p className="text-xs text-[var(--text-muted)]">{t('mappings.modalIntro')}</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setShowModal(false)}
                    className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSaveMapping} className="space-y-5">
                  {/* Título en Plex y Temporada */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('mappings.plexServerTitle')}</label>
                      <input
                        type="text"
                        required
                        value={plexTitleInput}
                        onChange={(e) => setPlexTitleInput(e.target.value)}
                        placeholder="Ej. Frieren: Beyond Journey's End"
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-[var(--text-secondary)]">
                        Temporada Servidor
                      </label>
                      <div className="relative flex items-center">
                        <input
                          type="number"
                          min={1}
                          required
                          value={plexSeasonInput}
                          onChange={(e) => setPlexSeasonInput(Math.max(1, parseInt(e.target.value) || 1))}
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

                  {/* Buscador en vivo de AniList */}
                  <div className="space-y-2 pt-2 border-t border-[var(--border-subtle)]">
                    <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                      <span>{t('mappings.searchAnimeAniList')}</span>
                      {selectedRemoteAnime && (
                        <span className="text-emerald-400 font-mono text-[11px] font-bold">
                          ✓ Seleccionado: #{selectedRemoteAnime.id}
                        </span>
                      )}
                    </label>

                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
                        <input
                          type="text"
                          value={remoteSearchQuery}
                          onChange={(e) => setRemoteSearchQuery(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), executeRemoteSearch(remoteSearchQuery, plexSeasonInput))}
                          placeholder={t('mappings.searchByNamePlaceholder')}
                          className="glass-input glass-input-icon text-xs w-full"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => executeRemoteSearch(remoteSearchQuery, plexSeasonInput)}
                        disabled={isSearchingRemote || !remoteSearchQuery.trim()}
                        className="btn-secondary text-xs"
                      >
                        {isSearchingRemote ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          t('mappings.searchButton')
                        )}
                      </button>
                    </div>

                    {/* Resultados de búsqueda */}
                    {remoteResults.length > 0 && (
                      <div className="max-h-60 overflow-y-auto space-y-1.5 p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] mt-2">
                        {remoteResults.map((anime) => {
                          const isSel = selectedRemoteAnime?.id === anime.id;
                          return (
                            <div
                              key={anime.id}
                              onClick={() => setSelectedRemoteAnime(anime)}
                              className={`p-2 rounded-[4px] flex items-center gap-3 cursor-pointer transition-colors ${
                                isSel
                                  ? 'bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] text-[var(--nav-active-text)]'
                                  : 'hover:bg-[var(--bg-surface-hover)]'
                              }`}
                            >
                              <img
                                src={anime.coverImage?.medium || anime.coverImage?.large}
                                alt={anime.title?.romaji || anime.title?.english}
                                className="w-8 h-11 rounded-[4px] object-cover shrink-0"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="text-xs font-bold truncate">
                                  {anime.title?.romaji || anime.title?.english || anime.title?.native}
                                </p>
                                <p className="text-[10.5px] text-[var(--text-muted)] font-mono truncate">
                                  {anime.format || 'TV'} • {anime.episodes || '?'} eps • {anime.seasonYear || 'N/A'} • #{anime.id}
                                </p>
                              </div>
                              {isSel && (
                                <Check className="w-4 h-4 text-emerald-400 shrink-0" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Acciones del Modal */}
                  <div className="flex items-center justify-end gap-3 pt-4 border-t border-[var(--border-subtle)]">
                    <button
                      type="button"
                      onClick={() => setShowModal(false)}
                      className="btn-secondary"
                    >{t('common.cancel')}</button>
                    <button
                      type="submit"
                      disabled={isSavingModal || !selectedRemoteAnime}
                      className="btn-primary"
                    >
                      {isSavingModal ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>Guardando...</span>
                        </>
                      ) : (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>{t('mappings.saveMapping')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* BOTTOM SHEET NATIVO MÓVIL PARA MAPEOS */}
      {activeMappingSheetItem && (
        <BottomSheet
          isOpen={!!activeMappingSheetItem}
          onClose={() => setActiveMappingSheetItem(null)}
          title={activeMappingSheetItem.plexTitle}
          subtitle={`${t('mappings.seasonPrefix')}${activeMappingSheetItem.plexSeason || 1} • AniList: ${activeMappingSheetItem.anilistTitle || activeMappingSheetItem.plexTitle}`}
          headerImage={
            activeMappingSheetItem.coverImage ? (
              <img
                src={activeMappingSheetItem.coverImage}
                alt={activeMappingSheetItem.anilistTitle || activeMappingSheetItem.plexTitle}
                className="w-10 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
              />
            ) : (
              <div className="w-10 h-14 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Film className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            )
          }
          headerBadge={
            <span
              className={
                activeMappingSheetItem.isApproved
                  ? 'badge-action-success text-[10px] font-mono'
                  : 'badge-action-warning text-[10px] font-mono'
              }
            >
              {activeMappingSheetItem.isApproved ? t('mappings.linked') : t('mappings.pending')}
            </span>
          }
          actions={[
            {
              label: t('mappings.editMapping'),
              sublabel: t('mappings.searchAndChangeAnime'),
              icon: Edit3,
              iconColor: 'text-[var(--accent-text)]',
              onClick: () => handleOpenEditModal(activeMappingSheetItem),
            },
            ...(!activeMappingSheetItem.isApproved
              ? [
                  {
                    label: t('mappings.approveLink'),
                    sublabel: t('mappings.confirmForImmediateSync'),
                    icon: Check,
                    variant: 'success' as const,
                    onClick: () => handleApprove(activeMappingSheetItem.id),
                  },
                ]
              : []),
            ...(currentUser?.role === 'ADMIN'
              ? [
                  {
                    label: activeMappingSheetItem.isGlobal ? 'Revocar Mapeo Global' : t('mappings.promoteToGlobal'),
                    sublabel: activeMappingSheetItem.isGlobal
                      ? t('mappings.revertToUserMapping')
                      : t('mappings.makeVisibleToAll'),
                    icon: Globe,
                    iconColor: 'text-amber-400',
                    onClick: () => handleToggleGlobal(activeMappingSheetItem.id),
                  },
                ]
              : []),
            ...(activeMappingSheetItem.anilistMediaId
              ? [
                  {
                    label: t('mappings.viewOnAniList'),
                    sublabel: `ID: #${activeMappingSheetItem.anilistMediaId}`,
                    icon: ExternalLink,
                    iconColor: 'text-[var(--brand-anilist)]',
                    onClick: () => {
                      window.open(`https://anilist.co/anime/${activeMappingSheetItem.anilistMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            {
              label: t('mappings.deleteMapping'),
              sublabel: t('mappings.unlinkAndDelete'),
              icon: Trash2,
              variant: 'danger' as const,
              onClick: () => handleUnlink(activeMappingSheetItem),
            },
          ]}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText="Desvincular"
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
