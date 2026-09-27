'use client';

import {
  Search,
  X,
  Rows2,
  Rows3,
  Rows4,
  Layers,
  RefreshCw,
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';

interface HistoryHeaderProps {
  t: (key: string, values?: any) => string;
  handleSearchSubmit: (e: React.FormEvent) => void;
  searchInput: string;
  setSearchInput: (value: string) => void;
  handleClearSearch: () => void;
  limit: number;
  handleLimitChange: (newLimit: number) => void;
  handleRefresh: () => void;
  loading: boolean;
  isBatchProcessing: boolean;
}

export function HistoryHeader({
  t,
  handleSearchSubmit,
  searchInput,
  setSearchInput,
  handleClearSearch,
  limit,
  handleLimitChange,
  handleRefresh,
  loading,
  isBatchProcessing,
}: HistoryHeaderProps) {
  return (
    <>
      {/* CABECERA CON BÚSQUEDA Y CONTROLES (ANCHO COMPLETO) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
            {t('history.title')}
          </h1>
          <p className="text-xs text-[var(--text-secondary)]">
            {t('history.subtitle')}
          </p>
        </div>

        {/* BÚSQUEDA Y CONTROLES */}
        <div className="flex items-center gap-2 sm:gap-2.5 flex-wrap sm:flex-nowrap w-full sm:w-auto">
          <form
            onSubmit={handleSearchSubmit}
            className="flex items-center gap-2.5 px-3.5 py-2 rounded-[var(--radius-md,6px)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md text-xs flex-1 sm:flex-initial focus-within:border-[var(--border-focus)] focus-within:ring-1 focus-within:ring-[var(--border-focus)] transition-all"
          >
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
            <input
              type="text"
              placeholder={t('history.searchPlaceholder')}
              autoComplete="off"
              suppressHydrationWarning
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="bg-transparent outline-none text-xs w-full sm:w-56 text-[var(--text-primary)]"
            />
            {searchInput && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </form>

          {/* Selector de Elementos por Página */}
          <div className="w-28 sm:w-32 shrink-0">
            <CustomSelect
              value={String(limit)}
              onChange={(val) => handleLimitChange(Number(val))}
              options={[
                { value: '15', label: t('history.perPage', { n: 15 }), icon: <Rows2 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                { value: '30', label: t('history.perPage', { n: 30 }), icon: <Rows3 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                { value: '50', label: t('history.perPage', { n: 50 }), icon: <Rows4 className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
                { value: '100', label: t('mappings.hundredPerPage'), icon: <Layers className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" /> },
              ]}
              accentColor="cinnabar"
            />
          </div>

          <button
            onClick={handleRefresh}
            disabled={loading || isBatchProcessing}
            className="btn-secondary px-3 py-2 text-xs flex items-center gap-1.5 cursor-pointer"
            title={t('history.refreshHistory')}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[var(--color-brand-primary,#FF634A)] ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{t('history.refresh')}</span>
          </button>
        </div>
      </div>
    </>
  );
}
