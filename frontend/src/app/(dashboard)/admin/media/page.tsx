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
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [totalSizeFormatted, setTotalSizeFormatted] = useState('0 KB');
  const [totalLinked, setTotalLinked] = useState(0);
  const [totalOrphans, setTotalOrphans] = useState(0);

  // Filters, Search, Sorting & Pagination
  const [searchQuery, setSearchQuery] = useState('');
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
      setLoadError(false);
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
      setLoadError(true);
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


  // Universal Filtering and Multi-criteria Sorting
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

      <MediaPageHeader
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        loading={loading}
        totalOrphans={totalOrphans}
        setPurgeOrphansModalOpen={setPurgeOrphansModalOpen}
        setPurgeModalOpen={setPurgeModalOpen}
        mediaList={mediaList}
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
            filteredMedia={filteredMedia}
            t={t}
          />

          <MediaGridSection
            loading={loading}
            loadError={loadError}
            loadMedia={loadMedia}
            filteredMedia={filteredMedia}
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
