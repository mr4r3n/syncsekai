'use client';

import React from 'react';
import { Cpu } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminServicesSystemCardProps {
  loading: boolean;
  systemHealth: any;
}

export function AdminServicesSystemCard({
  loading,
  systemHealth,
}: AdminServicesSystemCardProps) {
  const { t } = useI18n();

  return (
        <div className="glass-card p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3 border-b border-[var(--glass-border)] pb-4">
            <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('admin.nodeResources')}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{t('admin.nodeResourcesDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono text-xs">
            {loading || !systemHealth?.system ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
                  <div className="skeleton h-2.5 w-16 rounded" />
                  <div className="skeleton h-4 w-20 rounded" />
                </div>
              ))
            ) : (
              <>
                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.uptimeLabel')}</div>
                  <div className="font-bold text-[var(--text-primary)] truncate">{systemHealth.system.uptime}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.memoryRss')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.memoryRss}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.heapUsed')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.memoryHeapUsed}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.cpuCores')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.cpuCores} cores</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.nodeEnv')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.nodeVersion}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.osPlatform')}</div>
                  <div className="font-bold text-[var(--text-primary)] truncate">{systemHealth.system.platform}</div>
                </div>
              </>
            )}
          </div>
        </div>
  );
}
