'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { Play, RefreshCw } from 'lucide-react';

interface ConnectionsHeaderProps {
  activeServicesCount: number;
  setShowTesterModal: (show: boolean) => void;
  handleHealthCheck: () => void;
  isRefreshing: boolean;
  loading: boolean;
}

export function ConnectionsHeader({
  activeServicesCount,
  setShowTesterModal,
  handleHealthCheck,
  isRefreshing,
  loading,
}: ConnectionsHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-2">
      <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
              {t('connections.title')}
            </h1>
            <span className="badge-status-success">
              ● {activeServicesCount} {t('connections.activeServices')}
            </span>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {t('connections.subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setShowTesterModal(true)}
            className="btn-secondary text-xs"
          >
            <Play className="w-3.5 h-3.5 fill-current text-[var(--accent-text)]" />
            <span>{t('connections.scrobbleSimulator')}</span>
          </button>

          <button
            onClick={handleHealthCheck}
            disabled={isRefreshing || loading}
            className="btn-secondary text-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#02a9ff] ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{t('connections.apiDiagnostics')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
