'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { CustomSelect } from '@/components/CustomSelect';
import {
  Search,
  X,
  RefreshCw,
  List,
  LayoutGrid,
} from 'lucide-react';

interface CatalogHeaderProps {
  catalogResponse: any;
  selectedTracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL';
  setSelectedTracker: (tracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL') => void;
  pagination: any;
  catalogView: 'grid' | 'list';
  toggleView: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleRefresh: () => void;
  refreshing: boolean;
  loading: boolean;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  setCurrentPage: (page: number) => void;
  isAnilistActive: boolean;
  isMalActive: boolean;
  isKitsuActive: boolean;
}

export function CatalogHeader({
  catalogResponse,
  selectedTracker,
  setSelectedTracker,
  pagination,
  catalogView,
  toggleView,
  searchQuery,
  setSearchQuery,
  handleRefresh,
  refreshing,
  loading,
  statusFilter,
  setStatusFilter,
  setCurrentPage,
  isAnilistActive,
  isMalActive,
  isKitsuActive,
}: CatalogHeaderProps) {
  const { t } = useI18n();

  const handleTrackerChange = (tracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL') => {
    setSelectedTracker(tracker);
    if (typeof window !== 'undefined') {
      /*
       * "Local" is not remembered between visits, whereas trackers are.
       *
       * Local is not a destination; it is what remains without a linked
       * tracker, or a quick glance at database contents without going through
       * external services. Saved as preference, it remained permanently: clicking
       * it once—or having it before linking anything—opened catalog in Local
       * even with AniList connected, giving no hint that this was an active choice
       * rather than detection failure. By not saving it, next visit reverts to
       * tracker, as users expect.
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

  // Grid: 2 -> 3 -> 4 -> 5 -> 6 -> 8 columns depending on width.
  // Catalog account name, rendered in two locations depending on
  // width: single source for both.
  const catalogAccountName =
    catalogResponse?.username ||
    (selectedTracker === 'MAL'
      ? 'MyAnimeList'
      : selectedTracker === 'KITSU'
      ? 'Kitsu'
      : selectedTracker === 'LOCAL'
      ? t('catalog.localTracker')
      : 'AniList');

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

  const counts = catalogResponse?.counts || {
    all: 0,
    watching: 0,
    completed: 0,
    planning: 0,
    paused: 0,
    dropped: 0,
  };

  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-3 sm:space-y-4 transition-all">
      <div className="w-full space-y-3 sm:space-y-4">
        {/* Title, Profile & Search */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 w-full lg:flex-1 min-w-0">
            {/* Title on left and account at opposite end: two
                distinct things—location and account—and adjacent
                they looked like a single long label. */}
            <div className="flex items-center justify-between gap-3 w-full">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading min-w-0 truncate">
                {t('catalog.title')}
              </h1>

              {/* On lg header aligns in one row and this pill sits
                  just left of controls, but aligned with title:
                  elevated above adjacent items. There it renders inside
                  the control group to center with them; below lg it
                  stays on title line where needed. */}
              {catalogResponse?.connected && (
                <span className="lg:hidden badge-pill text-[var(--text-primary)] text-[11px] shrink-0">
                  ● @{catalogAccountName}
                </span>
              )}
            </div>

            {/*
              Hidden on mobile: at 375px controls took up 44% of screen
              before first anime. This copy duplicates visible data—total
              appears in "All (N)" tab and tracker in bottom pills—making
              it the easiest line to reclaim.
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
                ● @{catalogAccountName}
              </span>
            )}
            {/* Single button toggling grid and list.
                Shows destination view icon, not current one:
                button describes its click action. */}
            <button
              type="button"
              onClick={toggleView}
              title={catalogView === 'grid' ? t('catalog.viewAsList') : t('catalog.viewAsGrid')}
              aria-label={catalogView === 'grid' ? t('catalog.viewAsList') : t('catalog.viewAsGrid')}
              className="btn-secondary text-xs px-2.5 py-1.5 sm:py-2 shrink-0 order-last sm:order-none"
            >
              {catalogView === 'grid' ? (
                <List className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              )}
            </button>

            {/* Search and refresh on the same line. */}
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
                  aria-label={t('catalog.clearSearch')}
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </label>

            {/* Refresh Button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading || !catalogResponse?.connected}
              className="btn-secondary text-xs px-2.5 sm:px-3 py-1.5 sm:py-2"
              title={t('catalog.syncNowWith', {
                tracker: selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? t('catalog.localBase') : 'AniList',
              })}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-semibold">{refreshing ? t('catalog.refreshing') : t('catalog.refresh')}</span>
            </button>
          </div>
        </div>

        {/* ROW 2: status on left, tracker on right.

            On desktop these are pills, displaying all statuses and counts
            at a glance. On mobile they consumed two entire header rows—and
            status row overflowed mid-word—so there they become two dropdowns
            sharing a single row.

            Lists are declared once and shared across views: previously
            six buttons were duplicated with hardcoded Spanish copy alongside
            four extra tabs. */}
        {catalogResponse?.connected && (() => {
          const statuses = [
            { id: 'ALL', label: t('catalog.filterAll'), count: counts.all, active: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'CURRENT', label: t('catalog.filterWatching'), count: counts.watching, active: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'COMPLETED', label: t('catalog.filterCompleted'), count: counts.completed, active: 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]' },
            { id: 'PLANNING', label: t('catalog.filterPlanning'), count: counts.planning, active: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'PAUSED_DROPPED', label: t('catalog.filterPausedDropped'), count: (counts.paused || 0) + (counts.dropped || 0), active: 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]' },
            { id: 'FAVORITES', label: t('catalog.filterFavorites'), count: counts.favorites, active: 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]' },
          ];

          const trackers = [
            { id: 'LOCAL', name: t('catalog.localLibrary'), dot: 'bg-[var(--text-muted)]', active: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]', connected: true },
            { id: 'ANILIST', name: 'AniList', dot: 'bg-[var(--brand-anilist)]', active: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30', connected: isAnilistActive },
            { id: 'MAL', name: 'MAL', dot: 'bg-[var(--brand-mal)]', active: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30', connected: isMalActive },
            { id: 'KITSU', name: 'Kitsu', dot: 'bg-[var(--brand-kitsu)]', active: 'bg-[var(--brand-kitsu)]/15 text-[var(--brand-kitsu)] border-[var(--brand-kitsu)]/30', connected: isKitsuActive },
          ];

          const dot = (colorClass: string) => (
            <span className={`w-2 h-2 rounded-full shrink-0 ${colorClass}`} />
          );

          const statusDropdown = (
            <CustomSelect
              value={statusFilter}
              onChange={(v: string) => handleStatusChange(v)}
              options={statuses.map((e) => ({
                value: e.id,
                label: e.label,
                badge: String(e.count ?? 0),
              }))}
            />
          );

          const trackerPills = (
            <div
              role="tablist"
              aria-label={t('catalog.selectProvider')}
              className="inline-flex items-center p-1 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] gap-1 shrink-0"
            >
              {trackers.map((tr) => {
                const selected = selectedTracker === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    disabled={!tr.connected}
                    onClick={() => handleTrackerChange(tr.id as any)}
                    title={tr.connected ? tr.name : t('catalog.trackerNotLinked', { tracker: tr.name })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] text-xs font-semibold border transition-colors select-none ${
                      !tr.connected
                        ? 'border-transparent text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        : selected
                        ? `${tr.active} shadow-xs font-bold cursor-pointer`
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer'
                    }`}
                  >
                    {dot(tr.dot)}
                    <span>{tr.name}</span>
                  </button>
                );
              })}
            </div>
          );

          return (
            <>
              {/* MOBILE: two dropdowns in one row */}
              <div className="grid grid-cols-2 gap-2 sm:hidden pt-0.5">
                {statusDropdown}
                <CustomSelect
                  value={selectedTracker}
                  onChange={(v: string) => handleTrackerChange(v as any)}
                  options={trackers.map((tr) => ({
                    value: tr.id,
                    label: tr.name,
                    icon: dot(tr.dot),
                    disabled: !tr.connected,
                    disabledReason: t('catalog.trackerNotLinked', { tracker: tr.name }),
                  }))}
                />
              </div>

              {/* TABLET: six statuses do not fit in pills next to tracker
                  group—truncated mid-word—so status is a dropdown
                  while trackers remain as-is since they fit. */}
              <div className="hidden sm:flex lg:hidden items-center justify-between gap-2.5 pt-0.5">
                <div className="w-[220px] shrink-0">{statusDropdown}</div>
                {trackerPills}
              </div>

              {/* ESCRITORIO: todo en pildoras */}
              <div className="hidden lg:flex lg:items-center justify-between gap-2.5 pt-0.5">
                {/* Scrollable ribbon, not six wrapping pills. At 768 px
                    the six statuses broke across three lines with tracker
                    group squeezed between, leaving "Favorites" isolated on
                    row three. Without wrap, header height is uniform and
                    statuses scroll horizontally. */}
                <div
                  role="tablist"
                  aria-label={t('catalog.filterByStatus')}
                  className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar min-w-0 flex-1 text-xs -mx-1 px-1"
                >
                  {statuses.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === e.id}
                      onClick={() => handleStatusChange(e.id)}
                      className={`px-3 py-1.5 rounded-[var(--radius-md)] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        statusFilter === e.id
                          ? `${e.active} font-bold shadow-sm`
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {e.label} ({e.count ?? 0})
                    </button>
                  ))}
                </div>

                {trackerPills}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
