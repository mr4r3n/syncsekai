import React from 'react';
import { Server, Database, Zap, Tv } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminServicesStatusCardsProps {
  loading: boolean;
  stats: any;
  serviceDist: any;
}

export function AdminServicesStatusCards({
  loading,
  stats,
  serviceDist,
}: AdminServicesStatusCardsProps) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
      {loading ? (
        [...Array(6)].map((_, i) => (
          <div key={i} className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="skeleton h-4 w-32 rounded" />
              <div className="skeleton w-2.5 h-2.5 rounded-full" />
            </div>
            <div className="skeleton h-7 w-28 rounded" />
            <div className="skeleton h-3 w-full rounded" />
          </div>
        ))
      ) : (
        <>
          {/* 1. Backend NestJS */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Server className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Backend Core (NestJS)</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.stateOperational')}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
              <span>{t('admin.port4000')}</span>
              <span className="text-[var(--accent-text)] font-semibold">{t('admin.latency', { latency: stats.apiLatency || '4ms' })}</span>
            </div>
          </div>

          {/* 2. PostgreSQL */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[var(--text-muted)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">PostgreSQL Pool</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.stateConnected')}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
              <span>Prisma ORM</span>
              <span className="text-[var(--text-secondary)] font-semibold">{t('admin.activePool')}</span>
            </div>
          </div>

          {/* 3. Redis / BullMQ */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-rose-400" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Redis Queue</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.stateSynced')}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
              <span>{t('admin.scrobbleQueue')}</span>
              <span className="text-rose-400 font-semibold">{t('admin.zeroPending')}</span>
            </div>
          </div>

          {/* 4. Plex Live Watcher */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-amber-400" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Plex Watcher</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.onlineUpper')}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
              <span>Webhooks &amp; Polling</span>
              <span className="text-amber-400 font-semibold">{t('admin.serversCount', { n: serviceDist.plexServersConnected ?? 0 })}</span>
            </div>
          </div>

          {/* 5. Jellyfin Live Watcher */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-[var(--brand-jellyfin)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Jellyfin Watcher</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.onlineUpper')}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
              <span>Webhooks &amp; API</span>
              <span className="text-[var(--brand-jellyfin)] font-semibold">{t('admin.serversCount', { n: serviceDist.jellyfinServersConnected ?? 0 })}</span>
            </div>
          </div>

          {/* 6. Emby Live Watcher */}
          <div className="glass-card p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Tv className="w-4 h-4 text-[var(--brand-emby)]" />
                <span className="text-xs font-bold text-[var(--text-primary)]">Emby Watcher</span>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            </div>
            <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.onlineUpper')}</div>
            <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
              <span>Polling /Sessions (5s)</span>
              <span className="text-[var(--brand-emby)] font-semibold">{t('admin.serversCount', { n: serviceDist.embyServersConnected ?? 0 })}</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
