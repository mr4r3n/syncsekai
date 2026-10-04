'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import type { MappingsPage as MappingsResult } from '@/lib/api';
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
  // History and notifications link here with anime to map:
  // /mappings?search=Titulo&season=2.
  // One page from the server; `total` (after filters) and `counts` (tabs) describe the whole list.
  const [mappings, setMappings] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<MappingsResult['counts']>({ all: 0, approved: 0, pending: 0, global: 0, user: 0 });
  const latestRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL'>('ALL');

  // Pagination States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [jumpPage, setJumpPage] = useState('');

  // Load initial pagination state from URL or localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    // ?filter= only narrows the list (reviewing a community suggestion); ?search= opens the create modal
    const filterOnly = (params.get('filter') || '').trim();
    if (filterOnly) setSearchFilter(filterOnly);
    const title = (params.get('search') || '').trim();
    if (!title) return;

    const season = Math.max(1, parseInt(params.get('season') || '1', 10) || 1);
    setSearchFilter(title);
    handleOpenCreateModal(title, season);

    // Intent is consumed upon use: reloading page afterwards should not
    // reopen the modal.
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

  // Manual Search and Edit Modal
  const [showModal, setShowModal] = useState(false);
  const [isNewMapping, setIsNewMapping] = useState(false);
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);
  const [activeMappingSheetItem, setActiveMappingSheetItem] = useState<any | null>(null);
  const [plexTitleInput, setPlexTitleInput] = useState('');
  const [plexSeasonInput, setPlexSeasonInput] = useState(1);
  const [isSavingModal, setIsSavingModal] = useState(false);

  // Live AniList search within modal
  const [remoteSearchQuery, setRemoteSearchQuery] = useState('');
  const [remoteResults, setRemoteResults] = useState<any[]>([]);
  const [isSearchingRemote, setIsSearchingRemote] = useState(false);
  const [selectedRemoteAnime, setSelectedRemoteAnime] = useState<any | null>(null);

  // Dialog semantics and focus management for modals in this view.
  const { dialogProps: mappingProps } = useModalA11y(Boolean(showModal), () => setShowModal(false));

  useEffect(() => {
    api.auth.me().then((res) => setCurrentUser(res?.user || res)).catch(() => {});
  }, []);

  // The search reaches the server a moment after the last keystroke, not on every one.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchFilter.trim()), 300);
    return () => clearTimeout(id);
  }, [searchFilter]);

  useEffect(() => {
    loadMappings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, statusFilter, debouncedSearch]);

  /** The page on screen, filtered by the server. An older answer arriving late is ignored. */
  const loadMappings = async () => {
    const request = ++latestRequest.current;
    try {
      const res = await api.mappings.getPage({ page, limit, search: debouncedSearch, status: statusFilter });
      if (request !== latestRequest.current) return;
      // The page emptied (its last mapping was deleted): go to the last one that has rows.
      if (res.items.length === 0 && page > 1 && res.total > 0) {
        changePage(Math.ceil(res.total / limit));
        return;
      }
      setMappings(res.items || []);
      setTotal(res.total || 0);
      setCounts(res.counts);
    } catch (e: any) {
      if (request === latestRequest.current) showToast(`${t('mappings.loadMappingsError')} ` + e.message, 'error');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadMappings();
    setIsRefreshing(false);
    showToast(t('mappings.updatedToast'), 'success');
  };

  const handleApprove = async (id: string) => {
    try {
      await api.mappings.approve(id);
      showToast(t('mappings.mappingApproved'), 'success');
      loadMappings();
    } catch {
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
      loadMappings();
    } catch (e: any) {
      showToast(`${t('mappings.globalMappingError')} ` + e.message, 'error');
    }
  };

  const handleUnlink = (item: any) => {
    setConfirmModal({
      isOpen: true,
      title: t('mappings.unlinkConfirm'),
      description: t('mappings.unlinkConfirmDesc', { title: item.plexTitle, season: item.plexSeason || 1 }),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setMappings((prev) => prev.filter((m) => m.id !== item.id));
        setTotal((n) => Math.max(0, n - 1));
        showUndoToast(t('common.deletingItem', { name: item.plexTitle }), {
          onUndo: () => loadMappings(),
          onExpire: async () => {
            try {
              await api.mappings.unlink(item.id);
              showToast(t('mappings.mappingUnlinked'), 'info');
            } catch (e: any) {
              showToast(e.message || t('mappings.deletedToast'), 'error');
            }
            loadMappings();
          },
        });
      },
    });
  };

  // Open Modal for New Mapping
  const handleOpenCreateModal = (title = '', season = 1) => {
    setIsNewMapping(true);
    setEditingMappingId(null);
    setPlexTitleInput(title);
    setPlexSeasonInput(season);
    // With title, tracker search starts with it: only known piece of anime
    // info and first thing needed to type manually.
    setRemoteSearchQuery(title);
    setRemoteResults([]);
    setSelectedRemoteAnime(null);
    setShowModal(true);
  };

  // Open Modal to Edit Existing Mapping
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

  // AniList Live Search
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
        // Previously fell back to selectedRemoteAnime.id when real idMal was missing: when
        // result came from Kitsu fallback (no match on MAL), it saved Kitsu ID
        // as if it were MyAnimeList -- same kind of bug as the one
        // kitsuMediaId de arriba, confirmado en vivo (malMediaId=48915 siendo en
        // actually a Kitsu ID). Without real idMal, nothing is sent.
        malMediaId: selectedRemoteAnime.idMal ? Number(selectedRemoteAnime.idMal) : undefined,
        malTitle: selectedRemoteAnime.idMal
          ? (selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english)
          : undefined,
        // kitsuMediaId is Int? in database: only sent when result
        // actually comes from Kitsu (selectedRemoteAnime.kitsuId), never AniList id
        // disguised as Kitsu id (would store wrong tracker) and never as string
        // (Prisma rejects with 500 error because column is numeric).
        kitsuMediaId: selectedRemoteAnime.kitsuId ? Number(selectedRemoteAnime.kitsuId) : undefined,
        kitsuTitle: selectedRemoteAnime.kitsuId
          ? (selectedRemoteAnime.title?.romaji || selectedRemoteAnime.title?.english || plexTitleInput)
          : undefined,
      });

      showToast(t('mappings.mappingSaved'), 'success');
      setShowModal(false);
      loadMappings();
    } catch (err: any) {
      showToast(`${t('mappings.saveMappingError')} ` + err.message, 'error');
    } finally {
      setIsSavingModal(false);
    }
  };


  // Exportar Mapeos en Formato JSON
  const handleExportMappings = async () => {
    let everything: any[] = [];
    try {
      everything = await api.mappings.get();
    } catch (e: any) {
      showToast(`${t('mappings.loadMappingsError')} ` + e.message, 'error');
      return;
    }
    if (everything.length === 0) {
      showToast(t('mappings.noMappingsToExport'), 'info');
      return;
    }
    const exportData = everything.map((m) => ({
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
    showToast(t('mappings.exportedJsonCount', { n: everything.length }), 'success');
  };

  // Import Mappings from JSON File
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
      await loadMappings();
    } catch (err: any) {
      showToast(`${t('mappings.importJsonError')} ` + err.message, 'error');
    } finally {
      e.target.value = '';
    }
  };

  const totalPages = Math.max(1, Math.ceil(total / limit));

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
            counts={counts}
            statusFilter={statusFilter}
            handleStatusFilterChange={handleStatusFilterChange}
            t={t}
          />

          {/* MAIN CONTAINER: ADMIN TOP SHOWS STYLE */}
          <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-0 py-4 sm:p-6 space-y-4">
            <MappingsListSection
              total={total}
              paginatedMappings={mappings}
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

            {/* COMPLETE PAGINATION BAR */}
            {total > 0 && (
              <MappingsPagination
                total={total}
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

          {/* Mapping Search and Edit Modal */}
          {showModal && (
            <MappingEditModal
              mappingProps={mappingProps}
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

      {/* NATIVE MOBILE BOTTOM SHEET FOR MAPPINGS */}
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
        confirmText={t('mappings.unlink')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
