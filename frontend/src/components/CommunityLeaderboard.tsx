'use client';

import { useEffect, useState } from 'react';
import { Users } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

type Entry = { username: string; avatarUrl: string | null; helpedUsers: number };

const avatarSrc = (url: string | null) =>
  !url ? null : url.startsWith('http') || url.startsWith('/') ? url : `/api/auth/avatar/${url}`;

/**
 * Users whose mapping corrections helped others. Only people who opted in
 * appear; with nobody on it (or the API down) the section is not rendered.
 */
export function CommunityLeaderboard() {
  const { t } = useI18n();
  const [entries, setEntries] = useState<Entry[]>([]);

  useEffect(() => {
    api.communityMappings
      .leaderboard()
      .then((data) => setEntries(Array.isArray(data) ? data : []))
      .catch(() => setEntries([]));
  }, []);

  if (entries.length === 0) return null;

  return (
    <section className="p-5 sm:p-6 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
      <div className="space-y-1 border-b border-[var(--border-subtle)] pb-3">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-emerald-400" aria-hidden="true" />
          <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--text-primary)]">
            {t('landing.leaderboardTitle')}
          </h2>
        </div>
        <p className="text-[11px] text-[var(--text-secondary)]">{t('landing.leaderboardSubtitle')}</p>
      </div>

      <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {entries.map((e, i) => {
          const src = avatarSrc(e.avatarUrl);
          return (
            <li
              key={e.username}
              className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center gap-3 min-w-0"
            >
              <span className="font-mono text-xs font-bold text-[var(--text-muted)] w-5 shrink-0">{i + 1}</span>
              {src ? (
                <img src={src} alt="" width={32} height={32} className="w-8 h-8 rounded-full object-cover shrink-0" />
              ) : (
                <span
                  aria-hidden="true"
                  className="w-8 h-8 rounded-full shrink-0 bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] flex items-center justify-center text-xs font-bold uppercase"
                >
                  {e.username.charAt(0)}
                </span>
              )}
              <div className="min-w-0">
                <div className="text-xs font-semibold text-[var(--text-primary)] truncate">{e.username}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">
                  {t('landing.leaderboardHelped', { n: e.helpedUsers })}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
