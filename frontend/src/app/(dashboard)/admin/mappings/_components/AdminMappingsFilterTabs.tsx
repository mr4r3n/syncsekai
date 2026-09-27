import React from 'react';
import { GitMerge, Search } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingsFilterTabsProps {
  typeFilter: 'ALL' | 'GLOBAL' | 'USER' | 'PENDING';
  handleTypeFilterChange: (val: 'ALL' | 'GLOBAL' | 'USER' | 'PENDING') => void;
  totalCount: number;
  globalCount: number;
  userSpecificCount: number;
  pendingCount: number;
  searchFilter: string;
  handleSearchFilterChange: (val: string) => void;
  filteredMappings: any[];
}

export function AdminMappingsFilterTabs({
  typeFilter,
  handleTypeFilterChange,
  totalCount,
  globalCount,
  userSpecificCount,
  pendingCount,
  searchFilter,
  handleSearchFilterChange,
  filteredMappings,
}: AdminMappingsFilterTabsProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-[var(--glass-border)] gap-3">
      <div className="flex items-center gap-2.5">
        <GitMerge className="w-4 h-4 text-[var(--accent-text)]" />
        <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.generalMappingCatalogue')}</h2>
        <span className="text-xs text-[var(--text-muted)] font-mono">
          {t('admin.shownCount', { count: filteredMappings.length })}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2.5">
        {/* Filter Tabs (Swipeable on mobile) */}
        <div className="w-full sm:w-auto flex items-center gap-1.5 overflow-x-auto scrollbar-none flex-nowrap shrink-0 pb-1 sm:pb-0">
          <button
            onClick={() => handleTypeFilterChange('ALL')}
            className={`${typeFilter === 'ALL' ? 'filter-tab-active' : 'filter-tab'} shrink-0`}
          >
            {t('admin.tabAllCount', { count: totalCount })}
          </button>
          <button
            onClick={() => handleTypeFilterChange('GLOBAL')}
            className={`${typeFilter === 'GLOBAL' ? 'filter-tab-active text-amber-400 border-amber-500/30' : 'filter-tab'} shrink-0`}
          >
            {t('admin.tabGlobalCount', { count: globalCount })}
          </button>
          <button
            onClick={() => handleTypeFilterChange('USER')}
            className={`${typeFilter === 'USER' ? 'filter-tab-active text-sky-400 border-sky-500/30' : 'filter-tab'} shrink-0`}
          >
            {t('admin.tabUserCount', { count: userSpecificCount })}
          </button>
          <button
            onClick={() => handleTypeFilterChange('PENDING')}
            className={`${typeFilter === 'PENDING' ? 'filter-tab-active text-rose-400 border-rose-500/30' : 'filter-tab'} shrink-0`}
          >
            {t('admin.tabPendingCount', { count: pendingCount })}
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
  );
}
