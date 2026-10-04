'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import type { MediaItem } from './_components/types';
import { sortOptions } from './_components/constants';
import { MediaPageHeader } from './_components/MediaPageHeader';
import { MediaKpiCards } from './_components/MediaKpiCards';
import { PresetAvatarsSection } from './_components/PresetAvatarsSection';
import { MediaToolbar } from './_components/MediaToolbar';
import { MediaGridSection } from './_components/MediaGridSection';
import { MediaInspectorDrawer } from './_components/MediaInspectorDrawer';
import { MediaModals } from './_components/MediaModals';

export default function AdminMediaPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t } = useI18n();

  const [loading, setLoading] = useState(true);
  /*
   * If load fails, list remains empty and screen showed "no matching
   * media": deceptive regarding files that actually exist. Must
   * distinguish "loaded and empty" from "failed to load".
   */
  const [loadError, setLoadError] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // One page from the server; `total` counts what matches the filters, the totals below the whole library.
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [total, setTotal] = useState(0);
  const latestRequest = useRef(0);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSizeFormatted, setTotalSizeFormatted] = useState('0 KB');
  const [totalLinked, setTotalLinked] = useState(0);
  const [totalOrphans, setTotalOrphans] = useState(0);

  // Filters, Search, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'LINKED' | 'ORPHAN'>('ALL');
  const [sortBy, setSortBy] = useState<string>('RECENT');
  const [selectedItem, setSelectedItem] = useState<MediaItem | null>(null);
  const [page, setPage] = useState(1);
  const itemsPerPage = 32;

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

  // Load saved page and category state (URL or localStorage)
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
    api.auth
      .me()
      .catch(() => null)
      .then((meRes) => {
        const meUser = meRes?.user || meRes;
        if (!meUser || meUser.role !== 'ADMIN') {
          showToast(t('admin.adminRequired'), 'error');
          router.push('/catalog');
        }
      });
    api.admin
      .presetAvatars()
      .then((res) => setPresetAvatars(res.avatars || []))
      .catch(() => setPresetAvatars([]));
  }, []);

  // The search reaches the server a moment after the last keystroke, not on every one.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    loadMedia();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, categoryFilter, statusFilter, sortBy, debouncedSearch]);

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

  /** The page on screen, filtered and sorted by the server. An older answer arriving late is ignored. */
  const loadMedia = async () => {
    const request = ++latestRequest.current;
    try {
      setLoadError(false);
      const res = await api.admin.getMedia({
        page,
        limit: itemsPerPage,
        search: debouncedSearch,
        category: categoryFilter,
        status: statusFilter,
        sort: sortBy,
      });
      if (request !== latestRequest.current) return;
      // Past the last page (files deleted, a narrower filter): go to the last one that has rows.
      if (res.media.length === 0 && page > 1 && res.total > 0) {
        changePage(Math.ceil(res.total / itemsPerPage));
        return;
      }
      setMediaList(res.media || []);
      setTotal(res.total || 0);
      setTotalFiles(res.totalFiles || 0);
      setTotalSizeFormatted(res.totalSizeFormatted || '0 KB');
      setTotalLinked(res.totalLinked || 0);
      setTotalOrphans(res.totalOrphans || 0);

      if (selectedItem && res.media) {
        const found = res.media.find((m: MediaItem) => m.filename === selectedItem.filename);
        if (found) setSelectedItem(found);
      }
    } catch (err: any) {
      if (request !== latestRequest.current) return;
      setLoadError(true);
      showToast(`${t('admin.loadMediaError')} ` + err.message, 'error');
    } finally {
      if (request === latestRequest.current) setLoading(false);
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
    // Input is always cleared: without this, reselecting same file
    // after failure would not trigger event and button would appear non-responsive.
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
      onUndo: () => setPresetAvatars((prev) => [...prev, preset]),
      onExpire: async () => {
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
    const file = itemToDelete;
    setDeleteModalOpen(false);
    setItemToDelete(null);
    if (selectedItem?.filename === file.filename) setSelectedItem(null);
    setMediaList((prev) => prev.filter((m) => m.filename !== file.filename));
    setTotal((n) => Math.max(0, n - 1));
    showUndoToast(t('common.deletingItem', { name: file.filename }), {
      onUndo: () => loadMedia(),
      onExpire: async () => {
        try {
          await api.admin.deleteMedia(file.filename);
          showToast(t('admin.fileDeleted', { name: file.filename }), 'success');
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
      onUndo: () => {},
      onExpire: async () => {
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
      onUndo: () => {},
      onExpire: async () => {
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


  // Filters, sort and pages are applied by the server (admin-media.service.ts, getMediaPage).
  const totalPages = Math.max(1, Math.ceil(total / itemsPerPage));
  const paginatedMedia = mediaList;

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.mediaTitle')} />

      <MediaPageHeader
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        loading={loading}
        totalOrphans={totalOrphans}
        setPurgeOrphansModalOpen={setPurgeOrphansModalOpen}
        setPurgeModalOpen={setPurgeModalOpen}
        totalFiles={totalFiles}
        t={t}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        <MediaKpiCards
          loading={loading}
          totalFiles={totalFiles}
          totalSizeFormatted={totalSizeFormatted}
          totalLinked={totalLinked}
          totalOrphans={totalOrphans}
          t={t}
        />

        <PresetAvatarsSection
          presetAvatars={presetAvatars}
          uploadingPreset={uploadingPreset}
          presetInputRef={presetInputRef}
          handlePresetFileChange={handlePresetFileChange}
          handleRemovePreset={handleRemovePreset}
          t={t}
        />

        {/* CONTENEDOR PRINCIPAL: TOOLBAR + GRID + INSPECTOR */}
        <div className="glass-card p-5 space-y-4">
          <MediaToolbar
            searchQuery={searchQuery}
            handleSearchChange={handleSearchChange}
            categoryFilter={categoryFilter}
            handleCategoryChange={handleCategoryChange}
            statusFilter={statusFilter}
            setStatusFilter={setStatusFilter}
            changePage={changePage}
            totalLinked={totalLinked}
            totalOrphans={totalOrphans}
            sortBy={sortBy}
            setSortBy={setSortBy}
            sortOptions={sortOptions}
            total={total}
            t={t}
          />

          <MediaGridSection
            loading={loading}
            loadError={loadError}
            loadMedia={loadMedia}
            total={total}
            paginatedMedia={paginatedMedia}
            selectedItem={selectedItem}
            setSelectedItem={setSelectedItem}
            totalPages={totalPages}
            page={page}
            changePage={changePage}
            itemsPerPage={itemsPerPage}
            t={t}
          />
        </div>
      </main>

      <MediaInspectorDrawer
        selectedItem={selectedItem}
        setSelectedItem={setSelectedItem}
        loadMedia={loadMedia}
        showToast={showToast}
        handleDeleteClick={handleDeleteClick}
        t={t}
      />

      <MediaModals
        deleteModalOpen={deleteModalOpen}
        setDeleteModalOpen={setDeleteModalOpen}
        itemToDelete={itemToDelete}
        handleConfirmDelete={handleConfirmDelete}
        purgeModalOpen={purgeModalOpen}
        setPurgeModalOpen={setPurgeModalOpen}
        isPurging={isPurging}
        handleConfirmPurge={handleConfirmPurge}
        purgeOrphansModalOpen={purgeOrphansModalOpen}
        setPurgeOrphansModalOpen={setPurgeOrphansModalOpen}
        totalOrphans={totalOrphans}
        isPurgingOrphans={isPurgingOrphans}
        handleConfirmPurgeOrphans={handleConfirmPurgeOrphans}
        t={t}
      />
    </div>
  );
}
