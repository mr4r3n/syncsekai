'use client';

import React from 'react';
import {
  Image as ImageIcon,
  HardDrive,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';

interface MediaKpiCardsProps {
  loading: boolean;
  totalFiles: number;
  totalSizeFormatted: string;
  totalLinked: number;
  totalOrphans: number;
  t: (key: string, values?: any) => string;
}

export function MediaKpiCards({
  loading,
  totalFiles,
  totalSizeFormatted,
  totalLinked,
  totalOrphans,
  t,
}: MediaKpiCardsProps) {
  return (
    <>
        {/* KPI CARDS (4 COLUMNAS EN DESKTOP) */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.totalFiles')}</span>
              <ImageIcon className="w-4 h-4 text-sky-400" />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)] font-heading">
              {loading ? <div className="skeleton h-8 w-16 rounded" /> : totalFiles}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.cachedImagesOnDisk')}</p>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.diskSpace')}</span>
              <HardDrive className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)] font-heading">
              {loading ? <div className="skeleton h-8 w-24 rounded" /> : totalSizeFormatted}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.webpOptimisedUsage')}</p>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.inActiveUse')}</span>
              <LinkIcon className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-bold text-emerald-400 font-heading">
              {loading ? <div className="skeleton h-8 w-16 rounded" /> : totalLinked}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.linkedToMappings')}</p>
          </div>

          <div className="glass-card p-4 space-y-1">
            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span className="font-semibold uppercase tracking-wider font-mono">{t('admin.orphanedUnused')}</span>
              <Unlink className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl font-bold text-amber-400 font-heading">
              {loading ? <div className="skeleton h-8 w-16 rounded" /> : totalOrphans}
            </div>
            <p className="text-[11px] text-[var(--text-muted)]">{t('admin.residualFiles')}</p>
          </div>
        </div>
    </>
  );
}
