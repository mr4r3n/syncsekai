'use client';

import React from 'react';
import { GitMerge, Plus, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingsPageHeaderProps {
  handleOpenCreateModal: () => void;
  handleRefresh: () => void;
  isRefreshing: boolean;
}

export function AdminMappingsPageHeader({
  handleOpenCreateModal,
  handleRefresh,
  isRefreshing,
}: AdminMappingsPageHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
      <div className="w-full space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <GitMerge className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.globalMappingsTitle')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.globalMappingsSubtitle')}</p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleOpenCreateModal}
              className="btn-primary"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear Mapeo Global</span>
            </button>

            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary"
              title={t('admin.refreshMappings')}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t('admin.refreshShort')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
