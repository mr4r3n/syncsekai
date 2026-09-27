'use client';

import React from 'react';
import {
  Image as ImageIcon,
  AlertTriangle,
  RotateCw,
} from 'lucide-react';
import type { MediaItem } from './types';
import { LazyMediaThumbnail } from './LazyMediaThumbnail';

interface MediaGridSectionProps {
  loading: boolean;
  errorCarga: boolean;
  loadMedia: () => Promise<void>;
  filteredMedia: MediaItem[];
  paginatedMedia: MediaItem[];
  selectedItem: MediaItem | null;
  setSelectedItem: (item: MediaItem | null) => void;
  totalPages: number;
  page: number;
  changePage: (newPage: number) => void;
  itemsPerPage: number;
  t: (key: string, values?: any) => string;
}

export function MediaGridSection({
  loading,
  errorCarga,
  loadMedia,
  filteredMedia,
  paginatedMedia,
  selectedItem,
  setSelectedItem,
  totalPages,
  page,
  changePage,
  itemsPerPage,
  t,
}: MediaGridSectionProps) {
  return (
    <>
          {/* GRID DE MINIATURAS CON LAZY LOADING */}
          <div className="w-full space-y-4">
            {loading ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                {[...Array(itemsPerPage)].map((_, i) => (
                  <div key={i} className="skeleton aspect-square w-full rounded-[8px]" />
                ))}
              </div>
            ) : errorCarga ? (
              <div className="py-20 text-center space-y-3">
                <AlertTriangle className="w-12 h-12 text-[var(--status-danger)] mx-auto opacity-70" aria-hidden="true" />
                <p className="text-sm font-semibold text-[var(--text-primary)]">{t('admin.mediaLoadFailed')}</p>
                <button type="button" onClick={() => loadMedia()} className="btn-secondary mx-auto">
                  <RotateCw className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{t('admin.retry')}</span>
                </button>
              </div>
            ) : filteredMedia.length === 0 ? (
              <div className="py-20 text-center space-y-3">
                <ImageIcon className="w-12 h-12 text-[var(--text-muted)] mx-auto opacity-30" />
                <p className="text-sm font-semibold text-[var(--text-secondary)]">{t('admin.noMediaForFilters')}</p>
                <p className="text-xs text-[var(--text-muted)]">{t('admin.tryChangingSearch')}</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-7 xl:grid-cols-8 gap-2.5">
                {paginatedMedia.map((item) => (
                  <LazyMediaThumbnail
                    key={item.filename}
                    item={item}
                    isSelected={selectedItem?.filename === item.filename}
                    onClick={() => setSelectedItem(item)}
                  />
                ))}
              </div>
            )}

            {/* BARRA DE PAGINACIÓN */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-[var(--glass-border)] text-xs font-mono text-[var(--text-secondary)]">
                <div>
                  Mostrando{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {(page - 1) * itemsPerPage + 1}
                  </span>{' '}
                  a{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {Math.min(page * itemsPerPage, filteredMedia.length)}
                  </span>{' '}
                  de{' '}
                  <span className="font-bold text-[var(--text-primary)]">
                    {filteredMedia.length}
                  </span>{' '}
                  archivos
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => changePage(Math.max(1, page - 1))}
                    className="px-3 py-1.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >{t('common.previous')}</button>

                  <div className="flex items-center gap-1">
                    {[...Array(totalPages)].map((_, i) => {
                      const pageNum = i + 1;
                      if (
                        pageNum === 1 ||
                        pageNum === totalPages ||
                        (pageNum >= page - 2 && pageNum <= page + 2)
                      ) {
                        return (
                          <button
                            key={pageNum}
                            type="button"
                            onClick={() => changePage(pageNum)}
                            className={`w-8 h-8 rounded-[6px] text-xs font-bold transition-all cursor-pointer ${
                              page === pageNum
                                ? 'bg-[var(--accent-primary)] text-white shadow-sm'
                                : 'border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)]'
                            }`}
                          >
                            {pageNum}
                          </button>
                        );
                      } else if (
                        pageNum === page - 3 ||
                        pageNum === page + 3
                      ) {
                        return (
                          <span key={pageNum} className="px-1 text-[var(--text-muted)]">
                            ...
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>

                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                    className="px-3 py-1.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                  >{t('common.next')}</button>
                </div>
              </div>
            )}
          </div>
    </>
  );
}
