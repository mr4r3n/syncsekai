'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useModalA11y } from '@/components/useModalA11y';

import { MappingsPageHeader } from './_components/MappingsPageHeader';
import { MappingsFilterTabs } from './_components/MappingsFilterTabs';
import { MappingsListSection } from './_components/MappingsListSection';
import { MappingsPagination } from './_components/MappingsPagination';
import { MappingEditModal } from './_components/MappingEditModal';
import { MappingActionSheet } from './_components/MappingActionSheet';

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
    // ?filter= only narrows the list (reviewing a community suggestion); ?search= opens the create modal
    const filterOnly = (params.get('filter') || '').trim();
    if (filterOnly) setSearchFilter(filterOnly);
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
          <MappingsPageHeader
            handleOpenCreateModal={handleOpenCreateModal}
            handleImportFile={handleImportFile}
            handleExportMappings={handleExportMappings}
            handleRefresh={handleRefresh}
            isRefreshing={isRefreshing}
            t={t}
          />

          <MappingsFilterTabs
            mappings={mappings}
            statusFilter={statusFilter}
            handleStatusFilterChange={handleStatusFilterChange}
            t={t}
          />

          {/* CONTENEDOR PRINCIPAL: ESTILO SHOWS MÁS VISTOS DE ADMIN */}
          <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-0 py-4 sm:p-6 space-y-4">
            <MappingsListSection
              filteredMappings={filteredMappings}
              paginatedMappings={paginatedMappings}
              searchFilter={searchFilter}
              handleSearchFilterChange={handleSearchFilterChange}
              loading={loading}
              currentUser={currentUser}
              setActiveMappingSheetItem={setActiveMappingSheetItem}
              handleApprove={handleApprove}
              handleOpenEditModal={handleOpenEditModal}
              handleToggleGlobal={handleToggleGlobal}
              handleUnlink={handleUnlink}
              t={t}
            />

            {/* BARRA DE PAGINACIÓN COMPLETA */}
            {filteredMappings.length > 0 && (
              <MappingsPagination
                filteredMappings={filteredMappings}
                page={page}
                limit={limit}
                totalPages={totalPages}
                loading={loading}
                jumpPage={jumpPage}
                setJumpPage={setJumpPage}
                changePage={changePage}
                handleLimitChange={handleLimitChange}
                t={t}
              />
            )}
          </div>

          {/* Modal de Búsqueda y Edición de Mapeo */}
          {showModal && (
            <MappingEditModal
              propsMapeo={propsMapeo}
              setShowModal={setShowModal}
              isNewMapping={isNewMapping}
              handleSaveMapping={handleSaveMapping}
              plexTitleInput={plexTitleInput}
              setPlexTitleInput={setPlexTitleInput}
              plexSeasonInput={plexSeasonInput}
              setPlexSeasonInput={setPlexSeasonInput}
              remoteSearchQuery={remoteSearchQuery}
              setRemoteSearchQuery={setRemoteSearchQuery}
              executeRemoteSearch={executeRemoteSearch}
              isSearchingRemote={isSearchingRemote}
              selectedRemoteAnime={selectedRemoteAnime}
              setSelectedRemoteAnime={setSelectedRemoteAnime}
              remoteResults={remoteResults}
              isSavingModal={isSavingModal}
              t={t}
            />
          )}
        </main>
      </div>

      {/* BOTTOM SHEET NATIVO MÓVIL PARA MAPEOS */}
      {activeMappingSheetItem && (
        <MappingActionSheet
          activeMappingSheetItem={activeMappingSheetItem}
          setActiveMappingSheetItem={setActiveMappingSheetItem}
          currentUser={currentUser}
          handleOpenEditModal={handleOpenEditModal}
          handleApprove={handleApprove}
          handleToggleGlobal={handleToggleGlobal}
          handleUnlink={handleUnlink}
          t={t}
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
