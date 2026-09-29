'use client';

import { Radio, RefreshCw, Monitor } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

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

  const ago = (iso: string) => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
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

  return (
    <section className="glass-card p-5 sm:p-6 space-y-4">
      <div className="flex items-center gap-2.5">
        <span className="relative flex w-2.5 h-2.5" aria-hidden="true">
          <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex w-2.5 h-2.5 rounded-full bg-emerald-400" />
        </span>
        <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.liveTitle')}</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Online now */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
              <Radio className="w-3.5 h-3.5 text-emerald-400" aria-hidden="true" />
              {t('admin.liveOnlineNow')}
            </span>
            <span className="font-mono font-bold text-[var(--text-primary)]">{loading ? '-' : online.length + anonymous}</span>
          </div>
          {!loading && online.length === 0 && anonymous === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">{t('admin.liveNobodyOnline')}</p>
          ) : (
            <ul className="space-y-2">
              {online.map((u) => (
                <li key={u.username} className="flex items-center gap-3 text-xs">
                  {avatar(u.username, u.avatarUrl)}
                  <span className="font-semibold text-[var(--text-primary)] truncate">@{u.username}</span>
                  <span className="flex items-center gap-1 text-[var(--text-muted)] truncate">
                    <Monitor className="w-3 h-3 shrink-0" aria-hidden="true" />
                    {u.device}
                  </span>
                  <span className="ml-auto font-mono text-[var(--text-muted)] shrink-0">{ago(u.lastActiveAt)}</span>
                </li>
              ))}
              {anonymous > 0 && (
                <li className="text-xs text-[var(--text-muted)] pl-10">{t('admin.liveAnonymous', { n: anonymous })}</li>
              )}
            </ul>
          )}
        </div>

        {/* Syncing now */}
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-2 font-semibold text-[var(--text-secondary)]">
              <RefreshCw className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              {t('admin.liveSyncingNow')}
            </span>
            <span className="font-mono font-bold text-[var(--text-primary)]">{loading ? '-' : syncing.length}</span>
          </div>
          {!loading && syncing.length === 0 ? (
            <p className="text-xs text-[var(--text-muted)] py-2">{t('admin.liveNothingSyncing')}</p>
          ) : (
            <ul className="space-y-2">
              {syncing.map((s) => (
                <li key={s.username} className="flex items-center gap-3 text-xs">
                  {avatar(s.username, s.avatarUrl)}
                  <span className="min-w-0">
                    <span className="block font-semibold text-[var(--text-primary)] truncate">@{s.username}</span>
                    <span className="block text-[var(--text-muted)] truncate">
                      {s.title} · {t('admin.liveEpisode', { season: s.season, episode: s.episode })}
                    </span>
                  </span>
                  <span className="ml-auto font-mono text-[var(--text-muted)] shrink-0">{ago(s.at)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
