'use client';

import { Loader2, Trash2 } from 'lucide-react';

interface HistorySelectionBarProps {
  selectedIds: string[];
  setSelectedIds: (ids: string[]) => void;
  isBatchProcessing: boolean;
  batchProgress: { current: number; total: number } | null;
  handleBatchDeleteAndRevert: () => void;
  t: (key: string, values?: any) => string;
}

export function HistorySelectionBar({
  selectedIds,
  setSelectedIds,
  isBatchProcessing,
  batchProgress,
  handleBatchDeleteAndRevert,
  t,
}: HistorySelectionBarProps) {
  return (
    <>
      {/* MULTI-SELECTION BAR
          Anchored at bottom and out of flow, avoiding list shifts when
          appearing. Also remains
          visible while selecting more, positioned within thumb reach
          on mobile. */}
      {selectedIds.length > 0 && (
        <div
          role="region"
          aria-label={t('history.selectionBar')}
          className="fixed inset-x-4 bottom-4 z-40 mx-auto max-w-2xl p-3 rounded-[var(--radius-lg)] border border-[var(--status-danger)]/30 bg-[var(--bg-surface-elevated)]/95 backdrop-blur-xl flex flex-col sm:flex-row items-center justify-between gap-3 shadow-[var(--glass-shadow-lg)] animate-in fade-in slide-in-from-bottom-4 duration-200"
        >
          <div className="flex items-center gap-2.5">
            <span className="text-xs font-mono font-bold text-[var(--status-danger)]">
              {t('history.selectedCount', { n: selectedIds.length })}
            </span>
            {batchProgress && (
              <span className="text-xs font-mono text-[var(--text-muted)]">
                {t('history.batchProgress', {
                  current: batchProgress.current,
                  total: batchProgress.total,
                })}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setSelectedIds([])}
              disabled={isBatchProcessing}
              className="btn-secondary text-xs"
            >
              {t('history.cancelSelection')}
            </button>
            <button
              onClick={handleBatchDeleteAndRevert}
              disabled={isBatchProcessing}
              className="btn-danger text-xs"
            >
              {isBatchProcessing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{t('history.reverting')}</span>
                </>
              ) : (
                <>
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('history.revertSelected')}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
