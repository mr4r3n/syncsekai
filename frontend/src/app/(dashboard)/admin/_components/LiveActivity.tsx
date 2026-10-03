'use client';

import { Radio, RefreshCw, Monitor, UserRound } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { useNow } from '@/lib/useNow';

interface OnlineUser {
  username: string;
  avatarUrl: string | null;
  device: string;
  lastActiveAt: string;
}

interface SyncingUser {
  username: string;
  avatarUrl: string | null;
  title: string;
  season: number;
  episode: number;
  at: string;
}

export interface LiveActivityData {
  online: OnlineUser[];
  anonymousOnline: number;
  syncing: SyncingUser[];
}

/**
 * Who is here right now: accounts using the panel (session active in the last
 * 5 minutes, plus anonymous visitors) and accounts syncing (an episode in the
 * last hour). Comes with the dashboard metrics, refreshed with them.
 */
export function LiveActivity({ activity, loading }: { activity?: LiveActivityData; loading: boolean }) {
  const { t } = useI18n();
  const now = useNow();

  const ago = (iso: string) => {
    const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
    return mins < 1 ? t('topbar.momentAgo') : t('topbar.minutesAgo', { mins });
  };

  const avatar = (username: string, avatarUrl: string | null) =>
    avatarUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover shrink-0" />
    ) : (
      <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center text-[11px] font-bold bg-[var(--accent-primary)]/15 text-[var(--accent-text)]">
        {username.slice(0, 2).toUpperCase()}
      </span>
    );

  const online = activity?.online ?? [];
  const syncing = activity?.syncing ?? [];
  const anonymous = activity?.anonymousOnline ?? 0;

  // One panel per list, styled like the stat cards above: icon, label and figure,
  // then compact rows that stay inside the panel however wide the screen is.
  const panel = (
    icon: React.ReactNode,
    tone: string,
    label: string,
    count: number,
    empty: string,
    rows: React.ReactNode,
    hasRows: boolean,
  ) => (
    <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 space-y-3 min-w-0">
      <div className="flex items-center gap-3">
        <div className={`w-9 h-9 rounded-[6px] flex items-center justify-center shrink-0 ${tone}`}>{icon}</div>
        <div className="min-w-0">
          <div className="text-[10.5px] font-bold font-mono tracking-wider text-[var(--text-secondary)] uppercase">{label}</div>
          <div className="text-xl font-bold text-[var(--text-primary)] font-heading leading-tight">{loading ? '-' : count}</div>
        </div>
      </div>
      {!loading && !hasRows ? (
        <p className="text-xs text-[var(--text-muted)] rounded-[6px] border border-dashed border-[var(--border-subtle)] px-3 py-4 text-center">{empty}</p>
      ) : (
        <ul className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-2">{rows}</ul>
      )}
    </div>
  );

  const row = (key: string, pic: React.ReactNode, name: string, detail: React.ReactNode, time?: string) => (
    <li key={key} className="flex items-center gap-3 rounded-[6px] px-3 py-2.5 bg-[var(--bg-app)]/40 text-xs min-w-0">
      {pic}
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-baseline justify-between gap-2 leading-tight">
          <span className="font-semibold text-[var(--text-primary)] truncate">{name}</span>
          {time && <span className="font-mono text-[10px] text-[var(--text-muted)] shrink-0">{time}</span>}
        </div>
        <div className="text-[11px] leading-tight text-[var(--text-muted)] truncate">{detail}</div>
      </div>
    </li>
  );

  return (
    <section className="glass-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="relative flex w-2.5 h-2.5" aria-hidden="true">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </span>
        <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.liveTitle')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {panel(
          <Radio className="w-4 h-4" aria-hidden="true" />,
          'bg-emerald-500/10 text-emerald-400',
          t('admin.liveOnlineNow'),
          online.length + anonymous,
          t('admin.liveNobodyOnline'),
          <>
            {online.map((u) =>
              row(
                u.username,
                avatar(u.username, u.avatarUrl),
                `@${u.username}`,
                <span className="inline-flex items-center gap-1">
                  <Monitor className="w-3 h-3 shrink-0" aria-hidden="true" />
                  {u.device}
                </span>,
                ago(u.lastActiveAt),
              ),
            )}
            {anonymous > 0 &&
              row(
                'anonymous',
                <span className="w-7 h-7 rounded-full shrink-0 flex items-center justify-center border border-dashed border-[var(--border-subtle)] text-[var(--text-muted)]">
                  <UserRound className="w-3.5 h-3.5" aria-hidden="true" />
                </span>,
                t('admin.liveAnonymous', { n: anonymous }),
                t('admin.liveAnonymousHint'),
              )}
          </>,
          online.length + anonymous > 0,
        )}
        {panel(
          <RefreshCw className="w-4 h-4" aria-hidden="true" />,
          'bg-sky-500/10 text-sky-400',
          t('admin.liveSyncingNow'),
          syncing.length,
          t('admin.liveNothingSyncing'),
          <>
            {syncing.map((s) =>
              row(
                s.username,
                avatar(s.username, s.avatarUrl),
                `@${s.username}`,
                <>
                  {s.title} · {t('admin.liveEpisode', { season: s.season, episode: s.episode })}
                </>,
                ago(s.at),
              ),
            )}
          </>,
          syncing.length > 0,
        )}
      </div>
    </section>
  );
}
