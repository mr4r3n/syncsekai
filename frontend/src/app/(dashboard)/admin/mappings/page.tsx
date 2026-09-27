'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useModalA11y } from '@/components/useModalA11y';
import { AdminMappingsPageHeader } from './_components/AdminMappingsPageHeader';
import { AdminMappingsKpis } from './_components/AdminMappingsKpis';
import { AdminMappingsFilterTabs } from './_components/AdminMappingsFilterTabs';
import { AdminMappingsListSection } from './_components/AdminMappingsListSection';
import { AdminMappingsPagination } from './_components/AdminMappingsPagination';
import { AdminMappingEditModal } from './_components/AdminMappingEditModal';
import { AdminMappingActionSheet } from './_components/AdminMappingActionSheet';
import { CommunityConsensusSection } from './_components/CommunityConsensusSection';

export default function AdminMappingsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t } = useI18n();
  const [mappings, setMappings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'GLOBAL' | 'USER' | 'PENDING'>('ALL');

  // Pagination States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [jumpPage, setJumpPage] = useState('');

  // Load initial pagination state from URL or localStorage
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

  // Confirmation Modal
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

  // AniList live search
  const [remoteSearchQuery, setRemoteSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedRemoteAnime, setSelectedRemoteAnime] = useState<any | null>(null);

  // Dialog semantics and focus management for modals in this view.
  const { dialogProps: mappingProps } = useModalA11y(Boolean(showModal), () => setShowModal(false));

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
          : t('mappings.globalRevokedToPersonal'),
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
      description: t('mappings.confirmDeletePermanentDesc', { title: item.plexTitle, season: item.plexSeason || 1 }),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setMappings((prev) => prev.filter((m) => m.id !== item.id));
        showUndoToast(t('common.deletingItem', { name: item.plexTitle }), {
          onUndo: () => loadAdminMappings(),
          onExpire: async () => {
            try {
              await api.mappings.unlink(item.id);
              showToast(t('admin.mappingDeleted'), 'info');
            } catch (e: any) {
              showToast(`${t('admin.deleteMappingError')} ` + e.message, 'error');
            }
            loadAdminMappings();
          },
        });
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
        // Without real idMal nothing is sent: falling back to AniList id saved a
        // nonexistent MAL ID and each scrobble failed with 404 on MyAnimeList.
        malMediaId: selectedRemoteAnime.idMal ? Number(selectedRemoteAnime.idMal) : undefined,
        malTitle: selectedRemoteAnime.idMal
          ? selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english
          : undefined,
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

      {/* TOP HEADER (STATIC ON MOBILE, STICKY ON DESKTOP) */}
      <AdminMappingsPageHeader
        handleOpenCreateModal={handleOpenCreateModal}
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {/* TARJETAS KPI DE ESTADO */}
        <AdminMappingsKpis
          totalCount={totalCount}
          globalCount={globalCount}
          userSpecificCount={userSpecificCount}
          pendingCount={pendingCount}
        />

        <CommunityConsensusSection onGlobalChanged={loadAdminMappings} />

        {/* TABLA PRINCIPAL DE MAPEOS ADMIN */}
        <div className="glass-card p-6 space-y-4">
          <AdminMappingsFilterTabs
            typeFilter={typeFilter}
            handleTypeFilterChange={handleTypeFilterChange}
            totalCount={totalCount}
            globalCount={globalCount}
            userSpecificCount={userSpecificCount}
            pendingCount={pendingCount}
            searchFilter={searchFilter}
            handleSearchFilterChange={handleSearchFilterChange}
            filteredMappings={filteredMappings}
          />

          {/* Responsive Mappings List */}
          <AdminMappingsListSection
            loading={loading}
            filteredMappings={filteredMappings}
            paginatedMappings={paginatedMappings}
            setActiveAdminMappingSheetItem={setActiveAdminMappingSheetItem}
            handleToggleGlobal={handleToggleGlobal}
            handleApprove={handleApprove}
            handleOpenEditModal={handleOpenEditModal}
            handleDelete={handleDelete}
          />

          {/* COMPLETE PAGINATION BAR */}
          {filteredMappings.length > 0 && (
            <AdminMappingsPagination
              page={page}
              limit={limit}
              filteredMappings={filteredMappings}
              handleLimitChange={handleLimitChange}
              totalPages={totalPages}
              changePage={changePage}
              loading={loading}
              jumpPage={jumpPage}
              setJumpPage={setJumpPage}
            />
          )}
        </div>

        {/* MODAL ADMIN */}
        {showModal && (
          <AdminMappingEditModal
            setShowModal={setShowModal}
            mappingProps={mappingProps}
            isNewMapping={isNewMapping}
            plexTitleInput={plexTitleInput}
            setPlexTitleInput={setPlexTitleInput}
            plexSeasonInput={plexSeasonInput}
            setPlexSeasonInput={setPlexSeasonInput}
            isGlobalInput={isGlobalInput}
            setIsGlobalInput={setIsGlobalInput}
            selectedRemoteAnime={selectedRemoteAnime}
            setSelectedRemoteAnime={setSelectedRemoteAnime}
            remoteSearchQuery={remoteSearchQuery}
            setRemoteSearchQuery={setRemoteSearchQuery}
            executeRemoteSearch={executeRemoteSearch}
            isSearchingRemote={isSearchingRemote}
            remoteResults={remoteResults}
            handleSaveMapping={handleSaveMapping}
          />
        )}
      </main>

      {/* NATIVE MOBILE BOTTOM SHEET FOR ADMIN MAPPINGS */}
      {activeAdminMappingSheetItem && (
        <AdminMappingActionSheet
          activeAdminMappingSheetItem={activeAdminMappingSheetItem}
          setActiveAdminMappingSheetItem={setActiveAdminMappingSheetItem}
          handleOpenEditModal={handleOpenEditModal}
          handleToggleGlobal={handleToggleGlobal}
          handleApprove={handleApprove}
          handleDelete={handleDelete}
        />
      )}

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
