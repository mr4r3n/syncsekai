'use client';

import { useI18n } from '@/i18n/I18nProvider';
import {
  ChevronsLeft,
  ChevronLeft,
  ChevronRight,
  ChevronsRight,
} from 'lucide-react';

interface CatalogPaginationProps {
  pagination: any;
  currentPage: number;
  itemsPerPage: number;
  loading: boolean;
  handlePageChange: (newPage: number) => void;
}

export function CatalogPagination({
  pagination,
  currentPage,
  itemsPerPage,
  loading,
  handlePageChange,
}: CatalogPaginationProps) {
  const { t } = useI18n();

  // Smart page number renderer
  const renderPaginationButtons = () => {
    const totalPages = pagination.totalPages || 1;
    const current = currentPage;
    const pages: (number | string)[] = [];

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (current > 3) pages.push('...');
      
      const start = Math.max(2, current - 1);
      const end = Math.min(totalPages - 1, current + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) pages.push(i);
      }
      
      if (current < totalPages - 2) pages.push('...');
      if (!pages.includes(totalPages)) pages.push(totalPages);
    }

    return (
      <div className="flex items-center gap-2">
        <button
          onClick={() => handlePageChange(1)}
          disabled={current <= 1 || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.firstPage')}
        >
          <ChevronsLeft className="w-4 h-4" />
        </button>

        <button
          onClick={() => handlePageChange(current - 1)}
          disabled={current <= 1 || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.previousPage')}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        {pages.map((p, idx) => {
          if (p === '...') {
            return (
              <span key={`dots-${idx}`} className="px-2 text-[var(--text-muted)] font-mono text-sm select-none">
                ...
              </span>
            );
          }
          const pageNum = p as number;
          const isActive = pageNum === current;
          return (
            <button
              key={pageNum}
              onClick={() => handlePageChange(pageNum)}
              disabled={loading}
              // This paginator was hardcoded with fixed colors: blue
              // for active page and translucent white for remainder.
              // Neither matched site palette—other paginators use brand
              // orange—nor functioned in light theme, where `text-zinc-300`
              // against white background is unreadable.
              className={`min-w-[36px] h-9 px-2.5 rounded-[var(--radius-md)] text-sm font-mono font-semibold transition-colors border cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent-primary)] text-white border-transparent shadow-sm'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              {pageNum}
            </button>
          );
        })}

        <button
          onClick={() => handlePageChange(current + 1)}
          disabled={current >= totalPages || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.nextPage')}
        >
          <ChevronRight className="w-4 h-4" />
        </button>

        <button
          onClick={() => handlePageChange(totalPages)}
          disabled={current >= totalPages || loading}
          className="p-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 disabled:pointer-events-none transition-colors cursor-pointer"
          title={t('mappings.lastPage')}
        >
          <ChevronsRight className="w-4 h-4" />
        </button>
      </div>
    );
  };

  if (!pagination.totalPages || pagination.totalPages <= 1) return null;

  return (
    <div className="pt-6 pb-12 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-white/10">
      <div className="text-sm font-mono text-zinc-400">
        Mostrando{' '}
        <span className="text-white font-bold">
          {(currentPage - 1) * itemsPerPage + 1}
        </span>{' '}
        a{' '}
        <span className="text-white font-bold">
          {Math.min(currentPage * itemsPerPage, pagination.filteredItems)}
        </span>{' '}
        de <span className="text-sky-400 font-bold">{pagination.filteredItems}</span> animes
      </div>

      {renderPaginationButtons()}
    </div>
  );
}
