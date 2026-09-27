import React from 'react';
import { Users, RefreshCw, Filter, ArrowUpDown, List, LayoutGrid, Search } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import type { SortField } from './types';

interface UsersPageHeaderProps {
  handleRefresh: () => void;
  isRefreshing: boolean;
  roleFilter: 'ALL' | 'ADMIN' | 'USER';
  setRoleFilter: (val: 'ALL' | 'ADMIN' | 'USER') => void;
  statusFilter: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW';
  setStatusFilter: (val: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW') => void;
  currentSort: string;
  setSort: React.Dispatch<React.SetStateAction<{ field: SortField; asc: boolean }>>;
  SORTS: Array<{ value: string; label: string; field: SortField; asc: boolean }>;
  vista: 'lista' | 'tarjetas';
  changeView: (v: 'lista' | 'tarjetas') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setPage: (p: number) => void;
  totalUsersCount: number;
  adminUsersCount: number;
  activeUsersCount: number;
  suspendedUsersCount: number;
  newUsersCount: number;
  t: (key: string, params?: any) => string;
}

export function UsersPageHeader({
  handleRefresh,
  isRefreshing,
  roleFilter,
  setRoleFilter,
  statusFilter,
  setStatusFilter,
  currentSort,
  setSort,
  SORTS,
  vista,
  changeView,
  searchQuery,
  setSearchQuery,
  setPage,
  totalUsersCount,
  adminUsersCount,
  activeUsersCount,
  suspendedUsersCount,
  newUsersCount,
  t,
}: UsersPageHeaderProps) {
  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
      {/* TOP HEADER (STATIC ON MOBILE, STICKY ON DESKTOP) */}
      <div className="w-full space-y-4">
        {/* Refresh belongs on title line, not its own row:
            on mobile it was a solitary button in 375 px width, and with search
            bar and filters below header devoured half the
            screen before first account. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('users.title')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('users.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary px-2.5 sm:px-3.5"
              title={t('users.refresh')}
              aria-label={t('users.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">{t('users.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Filter and sort dropdowns; search on right. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[var(--glass-border)]">
          {/* On mobile, two columns with full-width sort; on desktop, a ribbon. */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:flex-wrap">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)]">
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              {t('users.filtersLabel')}
            </span>
            <CustomSelect
              value={roleFilter}
              onChange={(v) => {
                setRoleFilter(v as typeof roleFilter);
                setPage(1);
              }}
              className="!w-full sm:!w-44 shrink-0" triggerClassName="!h-8 text-xs"
              options={[
                { value: 'ALL', label: `${t('users.allRoles')} (${totalUsersCount})` },
                { value: 'ADMIN', label: `${t('users.filterAdmins')} (${adminUsersCount})` },
                { value: 'USER', label: `${t('users.roleUsers')} (${totalUsersCount - adminUsersCount})` },
              ]}
            />
            <CustomSelect
              value={statusFilter}
              onChange={(v) => {
                setStatusFilter(v as typeof statusFilter);
                setPage(1);
              }}
              className="!w-full sm:!w-44 shrink-0" triggerClassName="!h-8 text-xs"
              options={[
                { value: 'ALL', label: t('users.allStatus') },
                { value: 'ACTIVE', label: `${t('users.filterActive')} (${activeUsersCount})` },
                { value: 'SUSPENDED', label: `${t('users.filterSuspended')} (${suspendedUsersCount})` },
                { value: 'NEW', label: `${t('users.filterNew')} (${newUsersCount})` },
              ]}
            />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] sm:ml-2">
              <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <CustomSelect
              value={currentSort}
              onChange={(v) => {
                const o = SORTS.find((x) => x.value === v);
                if (o) setSort({ field: o.field, asc: o.asc });
              }}
              placeholder={t('users.sortCustom')}
              className="!w-full sm:!w-44 shrink-0 col-span-2 sm:col-span-1" triggerClassName="!h-8 text-xs"
              options={SORTS.map(({ value, label }) => ({ value, label }))}
            />
            <div className="hidden lg:inline-flex items-center rounded-[6px] bg-[var(--bg-surface)] p-0.5 sm:ml-2" role="group" aria-label={t('users.viewLabel')}>
              {(
                [
                  ['lista', List, t('users.viewList')],
                  ['tarjetas', LayoutGrid, t('users.viewCards')],
                ] as Array<['lista' | 'tarjetas', typeof List, string]>
              ).map(([v, Icon, label]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => changeView(v)}
                  aria-pressed={vista === v}
                  title={label}
                  aria-label={label}
                  className={`p-1.5 rounded-[5px] cursor-pointer transition-colors ${
                    vista === v ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder={t('users.searchPlaceholder')}
              suppressHydrationWarning
              autoComplete="off"
              className="glass-input glass-input-icon text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
