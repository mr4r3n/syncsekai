'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api, getApiBase } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import type { LinkedTrackers } from '@/components/SyncStatus';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';
import type { HeatmapDay, HeatmapResponse } from './_components/types';
import { HistorySelectionBar } from './_components/HistorySelectionBar';
import { HistoryHeader } from './_components/HistoryHeader';
import { HistoryStats } from './_components/HistoryStats';
import { HistoryList } from './_components/HistoryList';
import { HistoryPace } from './_components/HistoryPace';
import { HistoryBottomSheet } from './_components/HistoryBottomSheet';

export default function HistoryPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t, locale } = useI18n();

  // Reactive detection of Light Mode / Dark Mode
  const [isLightMode, setIsLightMode] = useState(false);

  useEffect(() => {
    const checkTheme = () => {
      const themeAttr = document.documentElement.getAttribute('data-theme');
      setIsLightMode(themeAttr === 'light');
    };
    checkTheme();

    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });

    window.addEventListener('plexsync_theme_changed', checkTheme);
    return () => {
      observer.disconnect();
      window.removeEventListener('plexsync_theme_changed', checkTheme);
    };
  }, []);

  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Status Filter: All, Successes, Errors
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'SUCCESS' | 'ERROR'>('ALL');

  // Glassmorphism Confirmation Modal
  const [confirmModal, setConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmText?: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    description: '',
    onConfirm: () => {},
  });

  // Pagination & Search States
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(30);
  const [total, setTotal] = useState(0);
  /*
   * Numbers for cards above, counted in database.
   */
  const [summary, setSummary] = useState<any>(null);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [jumpPage, setJumpPage] = useState('');

  // States for batch selection (Batch Selection)
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [activeHistorySheetItem, setActiveHistorySheetItem] = useState<any | null>(null);

  // Which trackers are linked. Account data, not scrobble data:
  // without it, "not configured" and "configured and failed" look identical, and
  // counter reports 1/3 when 1/1 is correct.
  const [linked, setLinked] = useState<LinkedTrackers>({
    anilist: true,
    mal: true,
    kitsu: true,
  });

  useEffect(() => {
    api.auth
      .me()
      .then((res) => {
        const connections = (res?.user || res)?.animeConnections || [];
        const isLinked = (p: string) =>
          connections.some((c: any) => c.provider === p && c.isConnected);
        setLinked({
          anilist: isLinked('ANILIST'),
          mal: isLinked('MAL'),
          kitsu: isLinked('KITSU'),
        });
      })
      // If it fails, all three are assumed: better to overreport than
      // esconder un fallo real de sincronizacion.
      .catch(() => {});
  }, []);

  // Pace & Date Filter States (100% Real)
  const [heatmapData, setHeatmapData] = useState<HeatmapResponse | null>(null);
  const [dateFilterMode, setDateFilterMode] = useState<'month' | 'range'>('month');
  const [selectedMonthIndex, setSelectedMonthIndex] = useState(0);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [openPicker, setOpenPicker] = useState<'start' | 'end' | null>(null);
  const [activePreset, setActivePreset] = useState<'month' | 'last30' | 'all' | 'custom'>('month');
  const [hoveredDay, setHoveredDay] = useState<HeatmapDay | null>(null);

  const loadHeatmap = useCallback(async () => {
    try {
      const res = await api.history.getHeatmap();
      if (res && Array.isArray(res.months) && res.months.length > 0) {
        setHeatmapData(res);
        setSelectedMonthIndex(res.months.length - 1);
        setStartDate(res.earliestRecordDate);
        setEndDate(res.latestRecordDate);
      }
    } catch (e: any) {
      console.warn('Could not load the heatmap:', e.message);
    }
  }, []);


  useEffect(() => {
    api.history
      .getSummary()
      .then(setSummary)
      .catch(() => setSummary(null));
  }, []);

  useEffect(() => {
    loadHeatmap();
  }, [loadHeatmap]);

  // Close date picker on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.dark-datepicker-container')) {
        setOpenPicker(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // The page lives in the URL (?page=), so a reload or a shared link keeps it. It used to be
  // read back from the URL or localStorage but never written, so it was always lost.
  useEffect(() => {
    const p = parseInt(new URLSearchParams(window.location.search).get('page') || '', 10);
    if (p > 0) setPage(p);
  }, []);

  const changePage = (newPage: number) => {
    setPage(newPage);
    const url = new URL(window.location.href);
    url.searchParams.set('page', String(newPage));
    window.history.replaceState({}, '', url.toString());
  };

  // Only the latest request may apply its answer: on load, the page-1 request and the one for
  // ?page= race, and a late page-1 answer used to set the page back to 1.
  const latestRequest = useRef(0);
  const loadHistory = useCallback(async (targetPage = page, targetLimit = limit, targetSearch = search) => {
    const request = ++latestRequest.current;
    try {
      setLoading(true);
      const res = await api.history.get({
        page: targetPage,
        limit: targetLimit,
        search: targetSearch,
      });
      if (request !== latestRequest.current) return;

      if (Array.isArray(res)) {
        setHistory(res);
        setTotal(res.length);
        setTotalPages(1);
      } else if (res && typeof res === 'object') {
        setHistory(res.items || []);
        setTotal(res.total || 0);
        setPage(res.page || targetPage);
        setTotalPages(res.totalPages || 1);
        setLimit(res.limit || targetLimit);
      }
      setSelectedIds([]);
    } catch (e: any) {
      if (request === latestRequest.current) showToast(`${t('history.loadHistoryError')} ` + e.message, 'error');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  }, [page, limit, search, showToast]);

  useEffect(() => {
    loadHistory(page, limit, search);
  }, [page, limit, search, loadHistory]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadHistory(page, limit, search), loadHeatmap()]);
    setIsRefreshing(false);
    showToast(t('history.historyRefreshed'), 'success');
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    changePage(1);
    setSearch(searchInput.trim());
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearch('');
    changePage(1);
  };

  const handlePageChange = (newPage: number) => {
    if (newPage < 1 || newPage > totalPages || newPage === page) return;
    changePage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLimitChange = (newLimit: number) => {
    setLimit(newLimit);
    changePage(1);
  };

  const handleJumpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(jumpPage, 10);
    if (!isNaN(p) && p >= 1 && p <= totalPages) {
      setPage(p);
      setJumpPage('');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Checkbox Selection Handling
  const handleToggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleSelectAll = () => {
    if (selectedIds.length === history.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(history.map((h) => h.id));
    }
  };

  // Individual rollback
  const handleDeleteAndRevert = (item: any) => {
    setConfirmModal({
      isOpen: true,
      title: t('history.confirmRevertScrobble'),
      description: t('history.revertOneDesc', { title: `${item.showTitle} Ep. ${item.episodeNumber}` }),
      confirmText: t('history.revertScrobble'),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        setHistory((prev) => prev.filter((h) => h.id !== item.id));
        setTotal((prev) => Math.max(0, prev - 1));
        showUndoToast(t('common.deletingItem', { name: `${item.showTitle} Ep. ${item.episodeNumber}` }), {
          onUndo: () => loadHistory(page, limit, search),
          onExpire: async () => {
            try {
              await api.history.deleteAndRevert(item.id);
              showToast(t('history.scrobbleReverted'), 'success');
            } catch (e: any) {
              showToast(e.message || t('history.revertError'), 'error');
            }
            loadHistory(page, limit, search);
          },
        });
      },
    });
  };

  // Batch Rollback
  const handleBatchDeleteAndRevert = () => {
    if (selectedIds.length === 0) return;
    const count = selectedIds.length;

    setConfirmModal({
      isOpen: true,
      title: t('history.revertSelectedTitle', { n: count }),
      description: t('history.revertBatchDesc'),
      confirmText: t('history.revertSelected', { n: count }),
      onConfirm: () => {
        setConfirmModal((prev) => ({ ...prev, isOpen: false }));
        const idsToProcess = [...selectedIds];
        setHistory((prev) => prev.filter((h) => !idsToProcess.includes(h.id)));
        setSelectedIds([]);
        showUndoToast(t('history.revertingN', { n: count }), {
          onUndo: () => loadHistory(page, limit, search),
          onExpire: () => batchRevert(idsToProcess),
        });
      },
    });
  };

  // Staggered requests to respect AniList / MAL rate limits.
  const batchRevert = async (idsToProcess: string[]) => {
        const count = idsToProcess.length;
        setIsBatchProcessing(true);
        setBatchProgress({ current: 0, total: count });
        let successfulCount = 0;

        for (let i = 0; i < idsToProcess.length; i++) {
          const id = idsToProcess[i];
          setBatchProgress({ current: i + 1, total: count });

          try {
            await api.history.deleteAndRevert(id);
            successfulCount++;
            setHistory((prev) => prev.filter((h) => h.id !== id));
          } catch (err: any) {
            console.warn(`Could not revert ${id}:`, err.message);
          }

          if (i < idsToProcess.length - 1) {
            await new Promise((resolve) => setTimeout(resolve, 600));
          }
        }

        setIsBatchProcessing(false);
        setBatchProgress(null);
        showToast(t('history.batchDone', { ok: successfulCount, total: count }), 'success');
        loadHistory(page, limit, search);
  };

  const isAllSelected = history.length > 0 && selectedIds.length === history.length;
  const isPartiallySelected = selectedIds.length > 0 && selectedIds.length < history.length;

  const startRecord = total === 0 ? 0 : (page - 1) * limit + 1;
  const endRecord = Math.min(page * limit, total);

  // Helper to build absolute cover URL if relative (/api/covers/...)
  const resolveCoverUrl = (cover: string | null) => {
    if (!cover) return null;
    if (cover.startsWith('http://') || cover.startsWith('https://')) return cover;
    return `${getApiBase()}${cover}`;
  };

  // Filter items according to statusFilter
  const filteredHistory = useMemo(() => {
    if (statusFilter === 'SUCCESS') {
      return history.filter(
        (item) =>
          item.anilistStatus === 'SUCCESS' ||
          item.malStatus === 'SUCCESS' ||
          item.kitsuStatus === 'SUCCESS',
      );
    }
    if (statusFilter === 'ERROR') {
      return history.filter(
        (item) =>
          item.anilistStatus === 'FAILED' ||
          item.malStatus === 'FAILED' ||
          item.anilistStatus === 'SKIPPED',
      );
    }
    return history;
  }, [history, statusFilter]);

  const monthsList = heatmapData?.months || [];
  const currentMonthData = monthsList[selectedMonthIndex] || monthsList[monthsList.length - 1];
  const earliestDate = heatmapData?.earliestRecordDate || '2026-01-01';
  const latestDate = heatmapData?.latestRecordDate || new Date().toISOString().slice(0, 10);

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          rootLabel={t('navigation.userLibrary')}
          currentLabel={t('history.title')}
          onRefresh={handleRefresh}
          isRefreshing={loading || isRefreshing}
        />

        <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
          <HistorySelectionBar
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            isBatchProcessing={isBatchProcessing}
            batchProgress={batchProgress}
            handleBatchDeleteAndRevert={handleBatchDeleteAndRevert}
            t={t}
          />

          <HistoryHeader
            t={t}
            handleSearchSubmit={handleSearchSubmit}
            searchInput={searchInput}
            setSearchInput={setSearchInput}
            handleClearSearch={handleClearSearch}
            limit={limit}
            handleLimitChange={handleLimitChange}
            handleRefresh={handleRefresh}
            loading={loading}
            isBatchProcessing={isBatchProcessing}
          />

          <HistoryStats
            total={total}
            summary={summary}
            t={t}
          />

          {/* MAIN GRID: 8 COLS SCROBBLES / 4 COLS WATCHING PACE */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
            <HistoryList
              history={history}
              loading={loading}
              isBatchProcessing={isBatchProcessing}
              selectedIds={selectedIds}
              handleSelectAll={handleSelectAll}
              isAllSelected={isAllSelected}
              isPartiallySelected={isPartiallySelected}
              startRecord={startRecord}
              endRecord={endRecord}
              total={total}
              statusFilter={statusFilter}
              setStatusFilter={setStatusFilter}
              filteredHistory={filteredHistory}
              search={search}
              handleClearSearch={handleClearSearch}
              handleToggleSelect={handleToggleSelect}
              setActiveHistorySheetItem={setActiveHistorySheetItem}
              resolveCoverUrl={resolveCoverUrl}
              linked={linked}
              handleDeleteAndRevert={handleDeleteAndRevert}
              totalPages={totalPages}
              page={page}
              handlePageChange={handlePageChange}
              handleJumpSubmit={handleJumpSubmit}
              jumpPage={jumpPage}
              setJumpPage={setJumpPage}
              t={t}
            />

            <HistoryPace
              t={t}
              locale={locale}
              dateFilterMode={dateFilterMode}
              setDateFilterMode={setDateFilterMode}
              setOpenPicker={setOpenPicker}
              openPicker={openPicker}
              currentMonthData={currentMonthData}
              selectedMonthIndex={selectedMonthIndex}
              setSelectedMonthIndex={setSelectedMonthIndex}
              monthsList={monthsList}
              isLightMode={isLightMode}
              startDate={startDate}
              setStartDate={setStartDate}
              endDate={endDate}
              setEndDate={setEndDate}
              earliestDate={earliestDate}
              latestDate={latestDate}
              setActivePreset={setActivePreset}
              activePreset={activePreset}
              hoveredDay={hoveredDay}
              setHoveredDay={setHoveredDay}
              heatmapData={heatmapData}
              summary={summary}
            />
          </div>
        </main>
      </div>

      <HistoryBottomSheet
        activeHistorySheetItem={activeHistorySheetItem}
        setActiveHistorySheetItem={setActiveHistorySheetItem}
        resolveCoverUrl={resolveCoverUrl}
        linked={linked}
        handleDeleteAndRevert={handleDeleteAndRevert}
        router={router}
        showToast={showToast}
        t={t}
      />

      <ConfirmModal
        isOpen={confirmModal.isOpen}
        title={confirmModal.title}
        description={confirmModal.description}
        confirmText={confirmModal.confirmText || t('common.confirm')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={confirmModal.onConfirm}
        onClose={() => setConfirmModal((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
}
