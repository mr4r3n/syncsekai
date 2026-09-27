'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Compact pagination bar for lists living inside a card.
 *
 * It is the single-line version, not the full screen bar: five page numbers
 * and a direct jump do not fit here without stealing space from the list
 * itself. It indicates where you are, how many items exist, and lets you move.
 *
 * Texts arrive already translated, just like in `ListRow` and `SyncStatus`: this
 * component should not know about the translation system.
 */
export function Pagination({
  page,
  totalPages,
  onChange,
  summary,
  prevLabel,
  nextLabel,
  className = '',
}: {
  /** Current page, starting at 1. */
  page: number;
  totalPages: number;
  onChange: (pagina: number) => void;
  /** Left-hand text, already translated: "28 countries" or "Page 2 of 4". */
  summary: string;
  prevLabel: string;
  nextLabel: string;
  className?: string;
}) {
  // With a single page there is nothing to paginate, and a bar leading
  // nowhere is noise.
  if (totalPages <= 1) return null;

  const buttonClass =
    'p-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]';

  return (
    <div
      className={`pt-3 mt-1 border-t border-[var(--glass-border)] flex items-center justify-between gap-3 ${className}`}
    >
      <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">{summary}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onChange(page - 1)}
          disabled={page <= 1}
          aria-label={prevLabel}
          title={prevLabel}
          className={buttonClass}
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] tabular-nums px-1">
          {page}/{totalPages}
        </span>

        <button
          type="button"
          onClick={() => onChange(page + 1)}
          disabled={page >= totalPages}
          aria-label={nextLabel}
          title={nextLabel}
          className={buttonClass}
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
