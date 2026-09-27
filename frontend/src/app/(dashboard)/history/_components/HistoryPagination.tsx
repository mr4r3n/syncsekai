'use client';

import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';

interface HistoryPaginationProps {
  totalPages: number;
  page: number;
  loading: boolean;
  handlePageChange: (newPage: number) => void;
  handleJumpSubmit: (e: React.FormEvent) => void;
  jumpPage: string;
  setJumpPage: (value: string) => void;
  t: (key: string, values?: any) => string;
}

export function HistoryPagination({
  totalPages,
  page,
  loading,
  handlePageChange,
  handleJumpSubmit,
  jumpPage,
  setJumpPage,
  t,
}: HistoryPaginationProps) {
  return (
    <>
      {/* COMPLETE PAGINATION BAR */}
      {totalPages > 1 && (
        <div className="pt-4 px-3 sm:px-0 border-t border-[var(--glass-border)] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-xs font-mono text-[var(--text-muted)]">{t('history.page')}{' '}<strong className="text-[var(--text-primary)]">{page}</strong> {t('history.of')} <strong className="text-[var(--text-primary)]">{totalPages}</strong>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Go to First Page */}
            <button
              onClick={() => handlePageChange(1)}
              disabled={page === 1 || loading}
              className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={t('mappings.firstPage')}
            >
              <ChevronsLeft className="w-3.5 h-3.5" />
            </button>

            {/* Previous Page */}
            <button
              onClick={() => handlePageChange(page - 1)}
              disabled={page === 1 || loading}
              className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
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
                  onClick={() => handlePageChange(pageNum)}
                  disabled={loading}
                  className={`w-8 h-8 rounded-[6px] text-xs font-semibold transition-all cursor-pointer ${
                    page === pageNum
                      ? 'bg-[var(--color-brand-primary,#FF634A)] text-white shadow-xs'
                      : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)]'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}

            {/* Next Page */}
            <button
              onClick={() => handlePageChange(page + 1)}
              disabled={page === totalPages || loading}
              className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={t('mappings.nextPage')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>

            {/* Go to Last Page */}
            <button
              onClick={() => handlePageChange(totalPages)}
              disabled={page === totalPages || loading}
              className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors"
              title={t('mappings.lastPage')}
            >
              <ChevronsRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Direct Jump to Page */}
          <form onSubmit={handleJumpSubmit} className="flex items-center gap-2">
            <span className="text-xs font-mono text-[var(--text-muted)] hidden sm:inline">{t('mappings.goToPage')}</span>
            <input
              type="number"
              min={1}
              max={totalPages}
              placeholder={String(page)}
              value={jumpPage}
              onChange={(e) => setJumpPage(e.target.value)}
              autoComplete="off"
              suppressHydrationWarning
              className="glass-input text-xs font-mono w-14 py-1 text-center"
            />
            <button
              type="submit"
              disabled={!jumpPage || loading}
              className="btn-secondary text-xs py-1 px-2.5"
            >
              {t('history.goPage')}
            </button>
          </form>
        </div>
      )}
    </>
  );
}
