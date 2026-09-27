'use client';

import React from 'react';
import {
  Image as ImageIcon,
  RefreshCw,
  Unlink,
  Trash2,
} from 'lucide-react';
import type { MediaItem } from './types';

interface MediaPageHeaderProps {
  handleRefresh: () => Promise<void>;
  isRefreshing: boolean;
  loading: boolean;
  totalOrphans: number;
  setPurgeOrphansModalOpen: (open: boolean) => void;
  setPurgeModalOpen: (open: boolean) => void;
  mediaList: MediaItem[];
  t: (key: string, values?: any) => string;
}

export function MediaPageHeader({
  handleRefresh,
  isRefreshing,
  loading,
  totalOrphans,
  setPurgeOrphansModalOpen,
  setPurgeModalOpen,
  mediaList,
  t,
}: MediaPageHeaderProps) {
  return (
    <>
      {/* TOP HEADER */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <ImageIcon className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.mediaLibraryTitle')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.mediaLibrarySubtitle')}</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="btn-secondary"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t('admin.refreshShort')}</span>
            </button>

            {totalOrphans > 0 && (
              <button
                onClick={() => setPurgeOrphansModalOpen(true)}
                disabled={loading}
                className="px-3.5 py-2 rounded-[6px] bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all"
              >
                <Unlink className="w-3.5 h-3.5" />
                <span>{t('admin.cleanOrphansCount', { count: totalOrphans })}</span>
              </button>
            )}

            <button
              onClick={() => setPurgeModalOpen(true)}
              disabled={loading || mediaList.length === 0}
              className="px-3.5 py-2 rounded-[6px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>{t('admin.purgeAll')}</span>
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
