import React from 'react';
import { CustomSelect } from '@/components/CustomSelect';

interface MappingsFilterTabsProps {
  /** Counts of the whole list (not only the page on screen). */
  counts: { all: number; approved: number; pending: number; global: number };
  statusFilter: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL';
  handleStatusFilterChange: (val: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL') => void;
  t: (key: string, params?: any) => string;
}

export function MappingsFilterTabs({
  counts,
  statusFilter,
  handleStatusFilterChange,
  t,
}: MappingsFilterTabsProps) {
  {/* FILTERS, OUTSIDE THE CONTAINER
      Previously inside the card, squeezed against its header and
      competing with search bar for the same row. Filtering decides WHICH
      list is viewed, so it belongs before the list, not within. Also
      aligns with catalog behavior, which shared the same issue.

      Pills on desktop and dropdown on mobile, for same reason:
      four tabs cannot fit on 375 px without clipping. */}
  return (
    <>
      {(() => {
        const filters: { id: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL'; label: string; count: number; active: string }[] = [
          { id: 'ALL', label: t('mappings.filterAll'), count: counts.all, active: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]' },
          { id: 'APPROVED', label: t('mappings.filterLinked'), count: counts.approved, active: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/30' },
          { id: 'PENDING', label: t('mappings.filterPending'), count: counts.pending, active: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30' },
          { id: 'GLOBAL', label: t('mappings.filterGlobal'), count: counts.global, active: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]' },
        ];

        return (
          <>
            <div className="sm:hidden">
              <CustomSelect
                value={statusFilter}
                onChange={(v: string) => handleStatusFilterChange(v as any)}
                options={filters.map((f) => ({
                  value: f.id,
                  label: f.label,
                  badge: String(f.count),
                }))}
              />
            </div>

            <div
              role="tablist"
              aria-label={t('mappings.filterByStatus')}
              className="hidden sm:flex items-center gap-1.5 flex-wrap text-xs"
            >
              {filters.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f.id}
                  onClick={() => handleStatusFilterChange(f.id)}
                  className={`px-3 py-1.5 rounded-[var(--radius-md)] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    statusFilter === f.id
                      ? `${f.active} font-bold shadow-sm`
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  {f.label} ({f.count})
                </button>
              ))}
            </div>
          </>
        );
      })()}
    </>
  );
}
