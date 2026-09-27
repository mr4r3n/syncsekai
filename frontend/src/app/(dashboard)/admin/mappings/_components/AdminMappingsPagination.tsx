import React from 'react';
import { ChevronsLeft, ChevronLeft, ChevronRight, ChevronsRight } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingsPaginationProps {
  page: number;
  limit: number;
  filteredMappings: any[];
  handleLimitChange: (newLimit: number) => void;
  totalPages: number;
  changePage: (newPage: number, newLimit?: number) => void;
  loading: boolean;
  jumpPage: string;
  setJumpPage: (val: string) => void;
}

export function AdminMappingsPagination({
  page,
  limit,
  filteredMappings,
  handleLimitChange,
  totalPages,
  changePage,
  loading,
  jumpPage,
  setJumpPage,
}: AdminMappingsPaginationProps) {
  const { t } = useI18n();

  return (
    <div className="pt-4 border-t border-[var(--glass-border)] flex flex-col md:flex-row items-center justify-between gap-4">
      {/* Limit Selector & Count */}
      <div className="flex items-center gap-3 text-xs font-mono text-[var(--text-muted)] flex-wrap">
        <span>
          {t('mappings.showingRange', { from: (page - 1) * limit + 1, to: Math.min(page * limit, filteredMappings.length), total: filteredMappings.length })}
        </span>

        <div className="flex items-center gap-1.5 ml-0 md:ml-2">
          <span className="text-[11px]">{t('mappings.show')}</span>
          <div className="w-28">
            <CustomSelect
              value={String(limit)}
              onChange={(val) => handleLimitChange(Number(val))}
              options={[
                { value: '10', label: t('mappings.perPage', { n: 10 }) },
                { value: '25', label: t('mappings.perPage', { n: 25 }) },
                { value: '50', label: t('mappings.perPage', { n: 50 }) },
                { value: '100', label: t('mappings.perPage', { n: 100 }) },
              ]}
              accentColor="cinnabar"
            />
          </div>
        </div>
      </div>

      {/* Page Navigation Controls */}
      {totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          {/* Go to First Page */}
          <button
            onClick={() => changePage(1)}
            disabled={page === 1 || loading}
            className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title={t('mappings.firstPage')}
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>

          {/* Previous Page */}
          <button
            onClick={() => changePage(Math.max(1, page - 1))}
            disabled={page === 1 || loading}
            className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title={t('mappings.previousPage')}
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Page Numbers */}
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum = page;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (page <= 3) {
              pageNum = i + 1;
            } else if (page >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = page - 2 + i;
            }

            return (
              <button
                key={pageNum}
                onClick={() => changePage(pageNum)}
                disabled={loading}
                className={`w-8 h-8 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                  page === pageNum
                    ? 'bg-[var(--accent-primary)] text-white shadow-xs'
                    : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
                }`}
              >
                {pageNum}
              </button>
            );
          })}

          {/* Next Page */}
          <button
            onClick={() => changePage(Math.min(totalPages, page + 1))}
            disabled={page === totalPages || loading}
            className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title={t('mappings.nextPage')}
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Go to Last Page */}
          <button
            onClick={() => changePage(totalPages)}
            disabled={page === totalPages || loading}
            className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
            title={t('mappings.lastPage')}
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Direct Jump to Page */}
      {totalPages > 1 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const target = parseInt(jumpPage, 10);
            if (!isNaN(target) && target >= 1 && target <= totalPages) {
              changePage(target);
              setJumpPage('');
            }
          }}
          className="flex items-center gap-2"
        >
          <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">{t('mappings.goToPage')}</span>
          <input
            type="number"
            min={1}
            max={totalPages}
            placeholder={String(page)}
            value={jumpPage}
            onChange={(e) => setJumpPage(e.target.value)}
            className="glass-input text-xs font-mono w-14 py-1 text-center"
          />
          <button
            type="submit"
            disabled={!jumpPage || loading}
            className="btn-secondary text-xs py-1 px-2.5 cursor-pointer"
          >
            Ir
          </button>
        </form>
      )}
    </div>
  );
}
