'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * List row. The same skeleton for history, mappings, media, backups, and
 * any other list of this style.
 *
 * Exists because each was drawn by hand and ended up as different variants
 * of the same concept: custom indents, custom heights, the same information
 * arranged differently on each screen. Fixing them one by one only guarantees
 * that in a few months there will be six variants again.
 *
 * ## Hierarchy is the idea, not decoration
 *
 * A row answers three questions, in this order: **what it is**, **what its
 * data are**, and **what state it is in**. That is why there are exactly two lines
 * of text: the title, and a single gray line with the rest separated by dots.
 *
 * ## Mobile is not this shrunk down
 *
 * On narrow screens the row reorders: the cover is reduced, secondary
 * data are trimmed to what fits, and the status block moves down to its
 * own second row rather than being compressed until illegible.
 *
 * ## No nested interactives
 *
 * The whole row is NOT a button. If it were, the checkbox and menu would sit
 * inside another control and neither keyboard nor screen reader would know what
 * is being activated. The clickable element is the title; other controls are its siblings.
 */

/*
 * Column geometry lives here and not in each place: header and
 * rows must measure exactly the same or the table ceases to be one.
 */
const META_GRID = 'gap-x-3 items-center';
const META_SIDE = 'lg:w-[52%]';
/* Space occupied by cover and its gap, so title label starts
 * where the title starts. */
const TITLE_INDENT = 'pl-[48px]';

export interface ListRowProps {
  /** Left-hand visual: cover, logo, or icon. */
  media?: React.ReactNode;
  /** Texto principal. */
  title: React.ReactNode;
  /** Badge attached to title (episode, season, type). */
  badge?: React.ReactNode;
  /**
   * Secondary data. Rendered on a single line separated by dots, and items
   * that do not fit are trimmed. Order matters: the first item survives
   * on mobile.
   */
  meta?: React.ReactNode[];
  /**
   * Distribution of right-hand columns, in `grid-template-columns` format.
   *
   * With all equal, a 20 px "TV" was stuck in a 150 px cell and the
   * gap between short columns was huge. Each list knows which of its data
   * is long and which is short, so the distribution is decided by whoever writes it;
   * what it CANNOT do is depend on row content, because then each row
   * would measure differently and cease to be a table.
   *
   * By default, all equal.
   */
  metaTemplate?: string;
  /**
   * Renders data to the right, next to status, instead of under the title.
   *
   * Used for single-line rows with a short title and plenty of space: in
   * the catalog at 2560 px the title occupied 400 px and data hung below
   * while 1500 px of whitespace remained to the right. On mobile it doesn't fit,
   * so there it moves below regardless.
   */
  metaOnRight?: boolean;
  /** Right-hand status block (sync icons, pills). */
  status?: React.ReactNode;
  /** Actions. If `onOpen` is not passed, they are visible; if passed, behind the menu. */
  actions?: React.ReactNode;

  /** Multiple selection. If `onSelect` is omitted, no checkbox is rendered. */
  selected?: boolean;
  onSelect?: () => void;
  selectDisabled?: boolean;

  /** Opens details: turns title into button and, on mobile only, adds right-hand menu. */
  onOpen?: () => void;
  /** Accessible label for the menu, already translated. */
  openLabel?: string;

  /** `compact` for long lists; `normal` by default. */
  density?: 'compact' | 'normal';
  /** Error marker: tints the border without relying solely on color. */
  tone?: 'default' | 'danger';
  className?: string;
}

export function ListRow({
  media,
  title,
  badge,
  meta,
  metaOnRight = false,
  metaTemplate,
  status,
  actions,
  selected = false,
  onSelect,
  selectDisabled = false,
  onOpen,
  openLabel,
  density = 'normal',
  tone = 'default',
  className = '',
}: ListRowProps) {
  const compact = density === 'compact';
  const visibles = (meta || []).filter(Boolean);

  // On the right, data goes into columns, and a column only aligns with
  // the one in the row below if all rows share the same ones. That is why here
  // gaps are preserved as empty cells rather than discarded: under the title
  // they are filtered out, because there a null would only leave a stray "· ·".
  const inColumns = (meta || []).map((item) => item ?? '');

  return (
    <li
      className={`group relative flex items-center gap-2.5 md:gap-3 rounded-[var(--radius-md)] border px-2.5 transition-colors ${
        compact ? 'py-1.5' : 'py-2'
      } ${
        selected
          ? 'border-[var(--accent-primary)]/40 bg-[var(--nav-active-bg)]'
          : tone === 'danger'
          ? 'border-[var(--status-danger)]/25 hover:bg-[var(--bg-surface-hover)]'
          : 'border-transparent hover:bg-[var(--bg-surface-hover)]'
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            disabled={selectDisabled}
            onChange={onSelect}
            // Native checkbox: focus, keyboard, and semantics for screen readers.
            className="shrink-0 w-4 h-4 accent-[var(--accent-primary)] cursor-pointer disabled:cursor-default"
          />
        )}

        {media && <div className="shrink-0">{media}</div>}

        {/* Mandatory min-w-0: without it a long title pushes status out
            of the row instead of truncating. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {onOpen ? (
              <button
                type="button"
                onClick={onOpen}
                className={`min-w-0 text-left font-semibold text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer rounded-[var(--radius-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] line-clamp-2 md:line-clamp-none md:truncate ${
                  compact ? 'text-[13px]' : 'text-sm'
                }`}
              >
                {title}
              </button>
            ) : (
              <span
                className={`min-w-0 font-semibold text-[var(--text-primary)] line-clamp-2 md:line-clamp-none md:truncate ${
                  compact ? 'text-[13px]' : 'text-sm'
                }`}
              >
                {title}
              </span>
            )}
            {badge && <span className="hidden md:inline shrink-0">{badge}</span>}
          </div>

          {visibles.length > 0 && (
            <MetaLine
              items={visibles}
              className={`mt-0.5 ${metaOnRight ? 'lg:hidden' : ''}`}
            />
          )}
        </div>
      </div>

      {/* Status goes to the right on the same line, also on mobile: giving it
          its own row cost 45 px per item and added no information.
          What does not fit is hidden by caller, who knows if that
          action is repeated in detail sheet. */}
      {(status || actions || onOpen || (metaOnRight && visibles.length > 0)) && (
        <div
          className={`flex items-center justify-end gap-2.5 shrink-0 ${
            metaOnRight ? META_SIDE : ''
          }`}
        >
          {metaOnRight && visibles.length > 0 && (
            /* Equal-column grid, not a data line stuck to the
               edge: row measures 2230 px and between title and status
               1400 were blank. Distributed in columns the gap is filled
               and values align vertically, allowing them to be
               compared at a glance when scanning the list. */
            <div
              style={{ gridTemplateColumns: metaTemplate || `repeat(${inColumns.length}, minmax(0, 1fr))` }}
              className={`hidden lg:grid flex-1 min-w-0 ${META_GRID} text-[11px] font-mono text-[var(--text-muted)] tabular-nums`}
            >
              {inColumns.map((item, i) => (
                <span key={i} className="truncate text-center">
                  {item}
                </span>
              ))}
            </div>
          )}
          {status}
          {actions}
          {/* Menu is mobile-only: there the row hides
              actions and this is the only way to reach them. On desktop it
              hides nothing—actions are already visible and title opens
              details—so it was a third button leading nowhere new. */}
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              aria-label={openLabel}
              title={openLabel}
              className="md:hidden shrink-0 p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            >
              <MoreVertical className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Secondary data, on a single line and separated by dots.
 *
 * Kept separate because it is rendered in two places—under title or to the right—and
 * duplicating responsive truncation guaranteed one would fall behind
 * as soon as someone touched it.
 */
function MetaLine({ items, className = '' }: { items: React.ReactNode[]; className?: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 text-[11px] font-mono text-[var(--text-muted)] ${className}`}
    >
      {items.map((item, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            // On mobile the first two fit; from the third onwards they only
            // appear when there is extra width. The order passed
            // determines what survives.
            <span aria-hidden="true" className={i > 1 ? 'hidden lg:inline' : ''}>
              ·
            </span>
          )}
          {/* The first is the identifier—episode, season—and is usually
              short: it does not shrink, because equal distribution reduced it to
              "T…" while the adjacent, much longer one, lost almost nothing. */}
          <span
            className={`${i === 0 ? 'shrink-0' : 'truncate min-w-0'} ${
              i > 1 ? 'hidden lg:inline' : ''
            }`}
          >
            {item}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Column header for lists that render data on the right.
 *
 * With values already aligned, the only missing piece to read this like
 * a table was identifying each column. Only appears where there is room for the
 * columns—`md` and up—just like them.
 *
 * Texts arrive translated, as in the rest of these components.
 */
export function ListRowsHeader({
  title,
  columns,
  status,
  template,
}: {
  title: string;
  /** A label for each `meta` item, in the same order and with the same gaps. */
  columns: string[];
  status?: string;
  /** The same `metaPlantilla` passed to rows. */
  template?: string;
}) {
  return (
    <div className="hidden lg:flex items-center gap-2.5 px-2.5 pb-2 mb-1 border-x border-transparent border-b-[var(--glass-border)] border-b text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
      <div className={`flex-1 min-w-0 ${TITLE_INDENT}`}>{title}</div>

      <div className={`flex items-center gap-2.5 ${META_SIDE}`}>
        <div
          style={{ gridTemplateColumns: template || `repeat(${columns.length}, minmax(0, 1fr))` }}
          className={`grid flex-1 min-w-0 ${META_GRID}`}
        >
          {columns.map((col, i) => (
            <span key={i} className="truncate text-center">
              {col}
            </span>
          ))}
        </div>

        {status && <span className="w-[104px] shrink-0 text-center">{status}</span>}
      </div>
    </div>
  );
}

/**
 * List container. Provides semantics and vertical rhythm, so each
 * screen does not reinvent it.
 */
export function ListRows({
  children,
  label,
  className = '',
}: {
  children: React.ReactNode;
  /** List name for screen readers, already translated. */
  label?: string;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={`flex flex-col gap-0.5 ${className}`}>
      {children}
    </ul>
  );
}
