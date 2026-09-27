import React from 'react';
import { HardDrive, RefreshCw, Upload, Database, Archive } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupsPageHeaderProps {
  setIsRefreshing: (val: boolean) => void;
  loadBackupsData: () => Promise<void>;
  isRefreshing: boolean;
  loading: boolean;
  setShowUploadModal: (val: boolean) => void;
  setCreatingType: (val: 'DATABASE' | 'FULL_SYSTEM') => void;
  setShowCreateModal: (val: boolean) => void;
}

export function AdminBackupsPageHeader({
  setIsRefreshing,
  loadBackupsData,
  isRefreshing,
  loading,
  setShowUploadModal,
  setCreatingType,
  setShowCreateModal,
}: AdminBackupsPageHeaderProps) {
  const { t } = useI18n();

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-[6px] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-text)]">
            <HardDrive className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-heading">{t('backups.title')}</h1>
            <p className="text-xs text-[var(--text-secondary)]">{t('backups.subtitle')}</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <button
          onClick={() => {
            setIsRefreshing(true);
            loadBackupsData();
          }}
          disabled={isRefreshing || loading}
          className="p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-50"
          title={t('backups.refreshData')}
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-[var(--accent-text)]' : ''}`} />
        </button>

        <button
          onClick={() => setShowUploadModal(true)}
          className="px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Upload className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
          <span>{t('backups.uploadAndRestore')}</span>
        </button>

        <button
          onClick={() => {
            setCreatingType('DATABASE');
            setShowCreateModal(true);
          }}
          className="px-3.5 py-2 rounded-[var(--radius-md)] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Database className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
          <span>{t('backups.extractDatabase')}</span>
        </button>

        <button
          onClick={() => {
            setCreatingType('FULL_SYSTEM');
            setShowCreateModal(true);
          }}
          className="px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all flex items-center gap-1.5 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
        >
          <Archive className="w-4 h-4" />
          <span>{t('backups.fullMigrationCopy')}</span>
        </button>
      </div>
    </div>
  );
}
