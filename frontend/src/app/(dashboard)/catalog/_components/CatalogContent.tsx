'use client';

import React from 'react';
import Link from 'next/link';
import { Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { CatalogGridView } from './CatalogGridView';
import { CatalogListView } from './CatalogListView';
import { CatalogPagination } from './CatalogPagination';

interface CatalogContentProps {
  loading: boolean;
  catalogResponse: any;
  catalog: any[];
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  catalogView: 'grid' | 'list';
  setSelectedAnime: (anime: any | null) => void;
  getStatusBadge: (status: string) => any;
  getStatusIcon: (status: string) => any;
  getSeasonNumber: (anime: any) => number;
  handleToggleFavorite: (anime: any, e?: React.MouseEvent) => void;
  favoritesList: string[];
  pagination: any;
  currentPage: number;
  itemsPerPage: number;
  handlePageChange: (newPage: number) => void;
}

export function CatalogContent({
  loading,
  catalogResponse,
  catalog,
  searchQuery,
  setSearchQuery,
  catalogView,
  setSelectedAnime,
  getStatusBadge,
  getStatusIcon,
  getSeasonNumber,
  handleToggleFavorite,
  favoritesList,
  pagination,
  currentPage,
  itemsPerPage,
  handlePageChange,
}: CatalogContentProps) {
  const { t } = useI18n();

  const getGridClass = () =>
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-3.5';

  return (
    <>
      {/* Loading State with Skeleton Cards */}
      {loading ? (
        <div className={`${getGridClass()} animate-in fade-in`}>
          {[...Array(16)].map((_, i) => (
            <div
              key={i}
              className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden flex flex-col justify-between p-1.5 space-y-1.5"
            >
              <div className="skeleton aspect-[2/3] w-full rounded-md" />
              <div className="space-y-1 px-1 pb-1">
                <div className="skeleton h-3 w-4/5 rounded" />
                <div className="skeleton h-2 w-1/2 rounded" />
                <div className="skeleton h-1 w-full rounded-full mt-1" />
              </div>
            </div>
          ))}
        </div>
      ) : !catalogResponse?.connected ? (
        <div className="p-10 sm:p-14 rounded-[8px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-5 max-w-xl mx-auto">
          <div className="flex items-center justify-center gap-3">
            <div
              className="w-12 h-12 rounded-[8px] flex items-center justify-center text-base font-bold shadow-sm"
              style={{ backgroundColor: 'var(--brand-anilist)', color: '#fff' }}
            >
              AL
            </div>
            <div
              className="w-12 h-12 rounded-[8px] flex items-center justify-center text-base font-bold shadow-sm"
              style={{ backgroundColor: '#2e51a2', color: '#fff' }}
            >
              MAL
            </div>
          </div>
          <div className="space-y-1.5">
            <h3 className="font-bold text-base text-[var(--text-primary)] font-heading">{t('catalog.connectTracker')}</h3>
            <p className="text-xs text-[var(--text-secondary)] max-w-md mx-auto leading-relaxed">{t('catalog.connectTrackerDesc')}</p>
          </div>
          <Link
            href="/connections"
            className="btn-primary inline-flex items-center gap-2 mx-auto"
          >
            <Sparkles className="w-4 h-4" />
            <span>{t('catalog.goToConnectionsHub')}</span>
          </Link>
        </div>
      ) : catalog.length === 0 ? (
        <div className="p-16 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-3 max-w-lg mx-auto">
          <p className="text-xs font-medium text-[var(--text-secondary)]">{t('catalog.noAnimeForFilters')}</p>
          {searchQuery && (
            <button onClick={() => setSearchQuery('')} className="text-xs text-[var(--accent-text)] hover:underline cursor-pointer">{t('catalog.clearSearch')}</button>
          )}
        </div>
      ) : (
        /* COMPACT AND ELEGANT FLUID GRID WITH RESPONSIVE DENSITY */
        <div className="space-y-8">
          {catalogView === 'list' ? (
            <CatalogListView
              catalog={catalog}
              setSelectedAnime={setSelectedAnime}
              getStatusBadge={getStatusBadge}
              getStatusIcon={getStatusIcon}
              getSeasonNumber={getSeasonNumber}
            />
          ) : (
            <CatalogGridView
              catalog={catalog}
              setSelectedAnime={setSelectedAnime}
              getStatusBadge={getStatusBadge}
              getSeasonNumber={getSeasonNumber}
              handleToggleFavorite={handleToggleFavorite}
              favoritesList={favoritesList}
            />
          )}

          {/* MINIMALIST AND ROBUST PAGINATION BAR */}
          {pagination.totalPages > 1 && (
            <CatalogPagination
              pagination={pagination}
              currentPage={currentPage}
              itemsPerPage={itemsPerPage}
              loading={loading}
              handlePageChange={handlePageChange}
            />
          )}
        </div>
      )}
    </>
  );
}
