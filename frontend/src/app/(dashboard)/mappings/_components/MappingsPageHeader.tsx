import React from 'react';
import { Plus, Upload, Download, RefreshCw } from 'lucide-react';

interface MappingsPageHeaderProps {
  handleOpenCreateModal: () => void;
  handleImportFile: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleExportMappings: () => void;
  handleRefresh: () => Promise<void>;
  isRefreshing: boolean;
  t: (key: string, params?: any) => string;
}

export function MappingsPageHeader({
  handleOpenCreateModal,
  handleImportFile,
  handleExportMappings,
  handleRefresh,
  isRefreshing,
  t,
}: MappingsPageHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
      {/* HEADER MINIMALISTA */}
      <div className="space-y-1">
        <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
          {t('mappings.title')}
        </h1>
        <p className="text-xs text-[var(--text-secondary)]">
          {t('mappings.subtitle')}
        </p>
      </div>

      <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
        <button
          onClick={() => handleOpenCreateModal()}
          className="btn-primary flex-1 sm:flex-initial"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>{t('mappings.newMapping')}</span>
        </button>

        <label className="btn-secondary cursor-pointer" title={t('mappings.import')}>
          <Upload className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden sm:inline">{t('mappings.import')}</span>
          <input
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportFile}
          />
        </label>

        <button
          type="button"
          onClick={handleExportMappings}
          className="btn-secondary"
          title={t('mappings.export')}
        >
          <Download className="w-3.5 h-3.5 text-sky-400" />
          <span className="hidden sm:inline">{t('mappings.export')}</span>
        </button>

        <button
          onClick={handleRefresh}
          disabled={isRefreshing}
          className="btn-secondary"
          title={t('mappings.refreshMappings')}
        >
          <RefreshCw className={`w-3.5 h-3.5 text-[#02a9ff] ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="hidden sm:inline">{t('mappings.refresh')}</span>
        </button>
      </div>
    </div>
  );
}
