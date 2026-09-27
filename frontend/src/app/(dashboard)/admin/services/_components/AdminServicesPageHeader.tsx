import React from 'react';
import { Server, Wrench, RefreshCw, Clock } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminServicesPageHeaderProps {
  autoRefreshInterval: number;
  setAutoRefreshInterval: (val: number) => void;
  showToast: (msg: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  maintenance: { enabled: boolean; message: string; estimatedEnd: string | null };
  setMEnabled: (val: boolean) => void;
  setMMessage: (val: string) => void;
  setShowMaintenanceModal: (val: boolean) => void;
  handleRefresh: () => void;
  isRefreshing: boolean;
  loading: boolean;
  lastUpdated: Date | null;
}

export function AdminServicesPageHeader({
  autoRefreshInterval,
  setAutoRefreshInterval,
  showToast,
  maintenance,
  setMEnabled,
  setMMessage,
  setShowMaintenanceModal,
  handleRefresh,
  isRefreshing,
  loading,
  lastUpdated,
}: AdminServicesPageHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <Server className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.servicesTitle')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.servicesSubtitle')}</p>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Selector de Auto-Sondeo */}
            <div className="flex items-center gap-1.5 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
              <span className="text-[11px] font-mono text-[var(--text-muted)] px-2 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    autoRefreshInterval > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                  }`}
                />
                Sondeo:
              </span>
              {[
                { label: 'Off', val: 0 },
                { label: '5s', val: 5 },
                { label: '10s', val: 10 },
                { label: '30s', val: 30 },
              ].map((opt) => (
                <button
                  key={opt.val}
                  type="button"
                  onClick={() => {
                    setAutoRefreshInterval(opt.val);
                    if (opt.val > 0) {
                      showToast(`Sondeo automático configurado cada ${opt.label}`, 'info');
                    } else {
                      showToast(t('admin.autoPollingPaused'), 'info');
                    }
                  }}
                  className={`px-2 py-1 rounded-[4px] font-mono text-[11px] font-bold transition-all cursor-pointer ${
                    autoRefreshInterval === opt.val
                      ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/30 dark:bg-[var(--accent-primary)]/20 dark:border-[var(--accent-primary)]/40 shadow-xs'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Botón de Modo Mantenimiento */}
            <button
              type="button"
              onClick={() => {
                setMEnabled(maintenance.enabled);
                setMMessage(maintenance.message);
                setShowMaintenanceModal(true);
              }}
              className={`btn-secondary transition-all ${
                maintenance.enabled
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-500/60 shadow-sm'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
              title="Configurar modo mantenimiento"
            >
              <Wrench className={`w-3.5 h-3.5 ${maintenance.enabled ? 'text-amber-400 animate-spin [animation-duration:8s]' : 'text-[var(--text-muted)]'}`} />
              <span>{maintenance.enabled ? t('admin.maintenanceActive') : 'Mantenimiento'}</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing || loading}
              className="btn-secondary"
              title={t('admin.testConnectionsNow')}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t('admin.testNow')}</span>
            </button>
          </div>
        </div>

        {lastUpdated && (
          <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] border-t border-[var(--glass-border)] pt-2">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" />
              Última comprobación: {lastUpdated.toLocaleTimeString()}
            </span>
            <span className="text-[var(--accent-text)]">
              {autoRefreshInterval > 0 ? `Refresco activo (cada ${autoRefreshInterval}s)` : 'Modo manual'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
