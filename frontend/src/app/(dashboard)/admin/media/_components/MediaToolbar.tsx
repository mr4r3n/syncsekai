'use client';

import React from 'react';
import {
  Search,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import type { MediaItem } from './types';

interface MediaToolbarProps {
  searchQuery: string;
  handleSearchChange: (val: string) => void;
  categoryFilter: string;
  handleCategoryChange: (cat: string) => void;
  statusFilter: 'ALL' | 'LINKED' | 'ORPHAN';
  setStatusFilter: (status: 'ALL' | 'LINKED' | 'ORPHAN') => void;
  changePage: (newPage: number) => void;
  totalLinked: number;
  totalOrphans: number;
  sortBy: string;
  setSortBy: (val: string) => void;
  sortOptions: { value: string; label: string }[];
  filteredMedia: MediaItem[];
  t: (key: string, values?: any) => string;
}

export function MediaToolbar({
  searchQuery,
  handleSearchChange,
  categoryFilter,
  handleCategoryChange,
  statusFilter,
  setStatusFilter,
  changePage,
  totalLinked,
  totalOrphans,
  sortBy,
  setSortBy,
  sortOptions,
  filteredMedia,
  t,
}: MediaToolbarProps) {
  return (
    <>
          {/* BARRA DE HERRAMIENTAS, FILTROS Y ORDENAMIENTO */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pb-3 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3 flex-wrap flex-1">
              {/* Buscador Universal */}
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs flex-1 min-w-[240px] max-w-[380px]">
                <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
                <input
                  type="text"
                  placeholder={t('admin.searchMediaPlaceholder')}
                  value={searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="bg-transparent outline-none text-xs w-full text-[var(--text-primary)]"
                />
                {searchQuery && (
                  <button onClick={() => handleSearchChange('')} className="text-[var(--text-muted)] hover:text-[var(--text-primary)] cursor-pointer">
                    ×
                  </button>
                )}
              </div>

              {/* Filtro por Categoría */}
              <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
                <button
                  type="button"
                  onClick={() => handleCategoryChange('ALL')}
                  className={`px-2.5 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    categoryFilter === 'ALL'
                      ? 'bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >{t('common.all')}</button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange(t('admin.animeCovers'))}
                  className={`px-2.5 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    categoryFilter === t('admin.animeCovers')
                      ? 'bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >
                  Portadas
                </button>
                <button
                  type="button"
                  onClick={() => handleCategoryChange('General')}
                  className={`px-2.5 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    categoryFilter === 'General'
                      ? 'bg-[#FF634A]/10 text-[#FF634A] border border-[#FF634A]/30 dark:bg-[#FF634A]/20 dark:text-[#ff7d69] dark:border-[#FF634A]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >
                  General
                </button>
              </div>

              {/* Filtro por Estado (Vinculadas vs Huérfanas) */}
              <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
                <button
                  type="button"
                  onClick={() => { setStatusFilter('ALL'); changePage(1); }}
                  className={`px-2 py-1 rounded-[4px] font-bold transition-all cursor-pointer ${
                    statusFilter === 'ALL'
                      ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/30'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-transparent'
                  }`}
                >{t('admin.statusAll')}</button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('LINKED'); changePage(1); }}
                  className={`px-2 py-1 rounded-[4px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'LINKED'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                      : 'text-[var(--text-secondary)] hover:text-emerald-400 border border-transparent'
                  }`}
                >
                  <LinkIcon className="w-3 h-3" />
                  <span>En Uso ({totalLinked})</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setStatusFilter('ORPHAN'); changePage(1); }}
                  className={`px-2 py-1 rounded-[4px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    statusFilter === 'ORPHAN'
                      ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30'
                      : 'text-[var(--text-secondary)] hover:text-amber-400 border border-transparent'
                  }`}
                >
                  <Unlink className="w-3 h-3" />
                  <span>Huérfanas ({totalOrphans})</span>
                </button>
              </div>
            </div>

            {/* Ordenamiento y Contador */}
            <div className="flex items-center gap-3 shrink-0">
              <div className="w-48 sm:w-52">
                <CustomSelect
                  options={sortOptions.map((o) => ({ ...o, label: t(o.label) }))}
                  value={sortBy}
                  onChange={(val) => setSortBy(val)}
                  placeholder={t('admin.sortBy')}
                />
              </div>

              <div className="text-xs font-mono text-[var(--text-muted)] whitespace-nowrap">
                <span>{filteredMedia.length} elementos</span>
              </div>
            </div>
          </div>
    </>
  );
}
