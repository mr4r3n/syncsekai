'use client';

import React from 'react';
import Link from 'next/link';
import { Radio, Zap, ExternalLink } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminServicesDistributionSectionProps {
  serviceDist: any;
  stats: any;
}

export function AdminServicesDistributionSection({
  serviceDist,
  stats,
}: AdminServicesDistributionSectionProps) {
  const { t } = useI18n();

  return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Tracker Distribution */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-[var(--text-muted)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.trackerAdoption')}</h3>
            </div>

            <div className="space-y-4">
              {/* AniList */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-anilist)]" />
                    AniList (GraphQL API)
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.anilist?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.anilist?.percentage ?? 0}%` }} className="h-full bg-[var(--brand-anilist)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersSyncing', { n: serviceDist.anilist?.count ?? 0 })}
                </p>
              </div>

              {/* MyAnimeList */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-mal)]" />
                    MyAnimeList (REST v2)
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.mal?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.mal?.percentage ?? 0}%` }} className="h-full bg-[var(--brand-mal)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersSyncing', { n: serviceDist.mal?.count ?? 0 })}
                </p>
              </div>

              {/* Kitsu API */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-kitsu)]" />
                    Kitsu API
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.kitsu?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.kitsu?.percentage ?? 0}%` }} className="h-full bg-[var(--brand-kitsu)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersSyncing', { n: serviceDist.kitsu?.count ?? 0 })}
                </p>
              </div>

              {/* Dual Sync */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />{t('admin.dualSyncBoth')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.both?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.both?.percentage ?? 0}%` }} className="h-full bg-[var(--accent-primary)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersWithMultipleTrackers', { n: serviceDist.both?.count ?? 0 })}
                </p>
              </div>
            </div>
          </div>

          {/* Global Sync Pipeline & Performance */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-[var(--text-muted)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.pipelinePerformance')}</h3>
            </div>

            <div className="space-y-4">
              {/* 1. Global Success Rate */}
              <div className="p-4 rounded-[6px] border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />{t('admin.globalSuccessRate')}</span>
                  <span className="font-mono font-bold text-emerald-400">{stats.successRate || '100%'}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: stats.successRate || '100%' }}
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pt-0.5">
                  <span className="text-[var(--text-muted)]">
                    {t('admin.successOfTotal', { ok: stats.successfulScrobbles?.toLocaleString() || 0, total: stats.totalScrobbles?.toLocaleString() || 0 })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/admin/failed-scrobbles"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 transition-colors font-semibold"
                      title={t('admin.viewFailedSyncs')}
                    >
                      <span>{t('admin.failuresCount', { n: stats.failedScrobbles ?? 0 })}</span>
                      <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                    </Link>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold"
                      title={t('admin.expectedSkips')}
                    >
                      {t('admin.skippedCount', { n: stats.skippedScrobbles ?? 0 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Servidores Plex Vinculados */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-plex)]" />{t('admin.pmsServersOnNetwork')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.serversCount', { n: stats.plexServersConnected ?? serviceDist.plexServersConnected ?? 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, (stats.plexPercentage || 0))}%` }}
                    className="h-full bg-[var(--brand-plex)] rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.percentUsersWithServer', { p: stats.plexPercentage || 0, server: 'Plex' })}
                </p>
              </div>

              {/* 3. Servidores Jellyfin Vinculados */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-jellyfin)]" />{t('admin.jellyfinServersOnNetwork')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.serversCount', { n: stats.jellyfinServersConnected ?? serviceDist.jellyfinServersConnected ?? 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, (stats.jellyfinPercentage || 0))}%` }}
                    className="h-full bg-[var(--brand-jellyfin)] rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.percentUsersWithServer', { p: stats.jellyfinPercentage || 0, server: 'Jellyfin' })}
                </p>
              </div>

              {/* 4. Servidores Emby Vinculados */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-emby)]" />{t('admin.embyServersOnNetwork')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.serversCount', { n: stats.embyServersConnected ?? serviceDist.embyServersConnected ?? 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, (stats.embyPercentage || 0))}%` }}
                    className="h-full bg-[var(--brand-emby)] rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.percentUsersWithServer', { p: stats.embyPercentage || 0, server: 'Emby' })}
                </p>
              </div>

              {/* 5. Title Mappings in Database */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />{t('admin.mappingRulesInDb')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.rulesCount', { n: stats.totalMappings?.toLocaleString() || 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: '100%' }} className="h-full bg-[var(--text-muted)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">{t('admin.mappingRulesDesc')}</p>
              </div>
            </div>
          </div>
        </div>
  );
}
