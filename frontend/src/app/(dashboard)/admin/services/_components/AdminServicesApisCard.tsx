import React from 'react';
import { Activity } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminServicesApisCardProps {
  loading: boolean;
  systemHealth: any;
}

export function AdminServicesApisCard({
  loading,
  systemHealth,
}: AdminServicesApisCardProps) {
  const { t } = useI18n();

  return (
    <div className="glass-card p-6 sm:p-7 space-y-6">
      <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('admin.liveStatusLatency')}</h2>
            <p className="text-xs text-[var(--text-secondary)]">{t('admin.liveStatusDesc')}</p>
          </div>
        </div>

        <span className="badge-status-success hidden sm:flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{t('admin.allApisVerified')}</span>
      </div>

      {/* Una fila por servicio: las latencias quedan alineadas y se pueden
          comparar. La latencia va en texto normal; el estado lo da la pastilla. */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8">
        {loading ? (
          [...Array(6)].map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)]"
            >
              <div className="skeleton h-3.5 w-36 rounded" />
              <div className="skeleton h-2.5 flex-1 rounded" />
              <div className="skeleton h-3 w-12 rounded" />
              <div className="skeleton h-5 w-16 rounded-[4px]" />
            </div>
          ))
        ) : (
          systemHealth?.apis &&
          Object.entries(systemHealth.apis).map(([key, apiInfo]: [string, any]) => {
            const isOnline = apiInfo.status === 'ONLINE' || apiInfo.status === 'LISTENING';
            const isDegraded = apiInfo.status === 'DEGRADED';
            return (
              <div
                key={key}
                className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0"
              >
                <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">
                  {apiInfo.name}
                </span>

                {/* La direccion sobrevive solo si sobra sitio: es el dato
                    menos urgente de los cuatro. */}
                <span className="hidden sm:block flex-1 min-w-0 text-[10.5px] font-mono text-[var(--text-muted)] truncate">
                  {apiInfo.endpoint || apiInfo.details}
                </span>

                <span
                  className="ml-auto sm:ml-0 shrink-0 text-[11px] font-mono font-bold text-[var(--text-primary)] tabular-nums"
                  title={t('admin.latencyLabel')}
                >
                  {apiInfo.latency}
                </span>

                <span
                  className={`shrink-0 ${
                    isOnline
                      ? 'badge-status-success'
                      : isDegraded
                      ? 'badge-status-warning'
                      : 'badge-status-danger'
                  }`}
                >
                  {apiInfo.status}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
