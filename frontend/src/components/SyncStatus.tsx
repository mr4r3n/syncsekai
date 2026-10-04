'use client';

import React from 'react';
import { Check, X, Loader2 } from 'lucide-react';

/**
 * Sync status of a scrobble across the three trackers.
 *
 * ## Why it exists
 *
 * A single component for tracker status across all screens.
 * A failure and an unconfigured tracker must be distinguishable at a glance,
 * so there are three states, not two:
 *
 * | Status           | Appearance                               |
 * |------------------|------------------------------------------|
 * | Synced           | brand-colored icon, with a ✓ checkmark   |
 * | Failed           | system red icon, with an ✕ cross         |
 * | Unconfigured     | dimmed icon, without checkmark           |
 * | Syncing          | amber icon, with a spinning mark         |
 *
 * Brand color identifies **which tracker it is**; the symbol says **what
 * happened**. This way status does not rely solely on color, allowing
 * those who cannot distinguish red from green to understand it.
 */

export type SyncState = 'SUCCESS' | 'FAILED' | string | null | undefined;

const TRACKERS = {
  anilist: { name: 'AniList', color: 'var(--brand-anilist)' },
  mal: { name: 'MyAnimeList', color: 'var(--brand-mal)' },
  kitsu: { name: 'Kitsu', color: 'var(--brand-kitsu)' },
} as const;

export type Tracker = keyof typeof TRACKERS;

/**
 * Which trackers the user has linked. Account data, not scrobble
 * data: an unlinked tracker didn't fail, it was never
 * attempted. Without this distinction, "not set up" and "set up and
 * failed" looked identical.
 */
export interface LinkedTrackers {
  anilist: boolean;
  mal: boolean;
  kitsu: boolean;
}

const ALL_LINKED: LinkedTrackers = { anilist: true, mal: true, kitsu: true };

function Glyph({ tracker }: { tracker: Tracker }) {
  if (tracker === 'anilist') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
        <path d="M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96-1.69-5.014-1.541 5.015h3.23z" />
      </svg>
    );
  }
  if (tracker === 'mal') {
    return (
      <span className="text-[9px] font-bold tracking-tighter leading-none" aria-hidden="true">
        MAL
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold tracking-tighter leading-none" aria-hidden="true">
      KIT
    </span>
  );
}

function Mark({ status }: { status: SyncState }) {
  if (status === 'SUCCESS') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--status-success)] text-white flex items-center justify-center ring-2 ring-[var(--bg-surface)]">
        <Check className="w-2 h-2" strokeWidth={4} aria-hidden="true" />
      </span>
    );
  }
  if (status === 'SYNCING') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--status-warning)] text-white flex items-center justify-center ring-2 ring-[var(--bg-surface)]">
        <Loader2 className="w-2 h-2 animate-spin" strokeWidth={4} aria-hidden="true" />
      </span>
    );
  }
  if (status === 'FAILED') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--status-danger)] text-white flex items-center justify-center ring-2 ring-[var(--bg-surface)]">
        <X className="w-2 h-2" strokeWidth={4} aria-hidden="true" />
      </span>
    );
  }
  return null;
}

function Icon({
  tracker,
  status,
  label,
  linked = true,
}: {
  tracker: Tracker;
  status: SyncState;
  label: string;
  linked?: boolean;
}) {
  // Unlinked overrides any scrobble status: if you don't have it
  // set up, there is nothing to report beyond that.
  const ok = linked && status === 'SUCCESS';
  const failed = linked && status === 'FAILED';
  // Waiting its turn in the trackers' queue: never shown as synced until the tracker answers.
  const syncing = linked && status === 'SYNCING';

  return (
    <span
      title={label}
      // Accessible text carries status; color and mark provide reinforcement.
      role="img"
      aria-label={label}
      className={`relative w-7 h-7 rounded-[var(--radius-sm)] border flex items-center justify-center shrink-0 ${
        ok
          ? 'border-current/30 bg-current/10'
          : failed
          ? 'border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
          : syncing
          ? 'border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-40'
      }`}
      style={ok ? { color: TRACKERS[tracker].color } : undefined}
    >
      <Glyph tracker={tracker} />
      {linked && <Mark status={status} />}
    </span>
  );
}

/**
 * `etiquetas` receives pre-translated text for each status, because this
 * component should not know about the translation system.
 */
export function SyncStatus({
  anilist,
  mal,
  kitsu,
  labels,
  linked = ALL_LINKED,
  className = '',
}: {
  anilist: SyncState;
  mal: SyncState;
  kitsu: SyncState;
  labels: { anilist: string; mal: string; kitsu: string };
  linked?: LinkedTrackers;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Icon tracker="anilist" status={anilist} label={labels.anilist} linked={linked.anilist} />
      <Icon tracker="mal" status={mal} label={labels.mal} linked={linked.mal} />
      <Icon tracker="kitsu" status={kitsu} label={labels.kitsu} linked={linked.kitsu} />
    </div>
  );
}

/**
 * Single-piece version for narrow screens: reports how many trackers
 * succeeded without spending three controls, and details remain one tap away.
 *
 * `resumen` is pre-translated text, like "2 of 3 synced".
 */
export function SyncSummary({
  anilist,
  mal,
  kitsu,
  summary,
  linked = ALL_LINKED,
  className = '',
}: {
  anilist: SyncState;
  mal: SyncState;
  kitsu: SyncState;
  summary: string;
  linked?: LinkedTrackers;
  className?: string;
}) {
  // Denominator is trackers configured by user, not always
  // three: with only AniList linked, 1/1 is correct, not 1/3 which
  // makes it seem two failed.
  const statuses = ([
    ['anilist', anilist],
    ['mal', mal],
    ['kitsu', kitsu],
  ] as [Tracker, SyncState][])
    .filter(([id]) => linked[id])
    .map(([, status]) => status);

  const total = statuses.length;
  const ok = statuses.filter((e) => e === 'SUCCESS').length;
  const hasFailed = statuses.some((e) => e === 'FAILED');
  // Something still waiting for a tracker: the final count is not known yet.
  const isSyncing = statuses.some((e) => e === 'SYNCING');

  // Without any linked tracker there is nothing to report.
  if (total === 0) {
    return (
      <span
        title={summary}
        aria-label={summary}
        className={`inline-flex items-center px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-mono text-[var(--text-muted)] ${className}`}
      >
        —
      </span>
    );
  }

  return (
    <span
      title={summary}
      aria-label={summary}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] font-mono font-semibold ${
        isSyncing
          ? 'border-[var(--status-warning)]/35 bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
          : hasFailed
          ? 'border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
          : ok === total
          ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
      } ${className}`}
    >
      {isSyncing ? (
        <Loader2 className="w-3 h-3 animate-spin" strokeWidth={3} aria-hidden="true" />
      ) : hasFailed ? (
        <X className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
      )}
      {ok}/{total}
    </span>
  );
}
