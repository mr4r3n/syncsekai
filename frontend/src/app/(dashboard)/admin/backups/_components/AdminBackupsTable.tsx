import React from 'react';
import {
  Archive,
  Database,
  Loader2,
  FolderArchive,
  Plus,
  Download,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupsTableProps {
  backupFilter: 'ALL' | 'DATABASE' | 'FULL_SYSTEM';
  setBackupFilter: (val: 'ALL' | 'DATABASE' | 'FULL_SYSTEM') => void;
  backups: any[];
  loading: boolean;
  setShowCreateModal: (val: boolean) => void;
  formatDateTime: (dateStr: string) => string;
  handleDownload: (filename: string) => void;
  descargando: string | null;
  setRestoreTarget: (item: any) => void;
  setDeleteTarget: (item: any) => void;
}

export function AdminBackupsTable({
  backupFilter,
  setBackupFilter,
  backups,
  loading,
  setShowCreateModal,
  formatDateTime,
  handleDownload,
  descargando,
  setRestoreTarget,
  setDeleteTarget,
}: AdminBackupsTableProps) {
  const { t } = useI18n();

  return (
    <div className="lg:col-span-2 p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setBackupFilter('ALL')}
            className={`px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-semibold transition-colors cursor-pointer border ${
              backupFilter === 'ALL'
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)]'
            }`}
          >
            {t('backups.filterAll', { n: backups.length })}
          </button>
          <button
            type="button"
            onClick={() => setBackupFilter('DATABASE')}
            className={`px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-semibold transition-colors cursor-pointer border ${
              backupFilter === 'DATABASE'
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)]'
            }`}
          >
            {t('backups.filterDatabase', { n: backups.filter((b) => b.type === 'DATABASE').length })}
          </button>
          <button
            type="button"
            onClick={() => setBackupFilter('FULL_SYSTEM')}
            className={`px-2.5 py-1 rounded-[var(--radius-md)] text-xs font-semibold transition-colors cursor-pointer border ${
              backupFilter === 'FULL_SYSTEM'
                ? 'bg-[var(--accent-primary)] text-white border-[var(--accent-primary)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] bg-[var(--bg-surface)] border-[var(--border-subtle)]'
            }`}
          >
            {t('backups.filterFullSystem', { n: backups.filter((b) => b.type === 'FULL_SYSTEM').length })}
          </button>
        </div>

        <span className="text-[11px] font-mono text-[var(--text-muted)]">
          {t('backups.formatNote')}
        </span>
      </div>

      {loading ? (
        <div className="py-16 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
          <Loader2 className="w-7 h-7 animate-spin text-[var(--accent-text)]" />
          <span className="text-xs font-mono">{t('backups.loadingBackups')}</span>
        </div>
      ) : backups.length === 0 ? (
        <div className="py-16 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 text-[var(--accent-text)] flex items-center justify-center mx-auto">
            <FolderArchive className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('backups.noBackupsYet')}</h3>
          <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto">{t('backups.noBackupsDesc')}</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t('backups.createFirst')}</span>
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-subtle)] text-[var(--text-muted)] font-mono text-[11px]">
                <th scope="col" className="pb-3 pl-3.5 pr-3 font-semibold">{t('backups.fileAndType')}</th>
                <th scope="col" className="pb-3 px-3 font-semibold">{t('backups.origin')}</th>
                <th scope="col" className="pb-3 px-3 font-semibold">{t('backups.size')}</th>
                <th scope="col" className="pb-3 px-3 font-semibold">{t('backups.creationDate')}</th>
                <th scope="col" className="pb-3 pl-3 pr-3.5 font-semibold text-right">{t('common.actions')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {backups
                .filter((b) => {
                  if (backupFilter === 'DATABASE') return b.type === 'DATABASE';
                  if (backupFilter === 'FULL_SYSTEM') return b.type === 'FULL_SYSTEM';
                  return true;
                })
                .map((item) => (
                <tr
                  key={item.filename}
                  className="hover:bg-[var(--bg-surface-hover)] transition-colors group"
                >
                  <td className="py-3 pl-3.5 pr-3 first:rounded-l-[6px]">
                    <div className="flex items-center gap-2.5">
                      <div
                        className={`w-8 h-8 rounded-[6px] flex items-center justify-center shrink-0 ${
                          item.type === 'FULL_SYSTEM'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                        }`}
                      >
                        {item.type === 'FULL_SYSTEM' ? (
                          <Archive className="w-4 h-4" />
                        ) : (
                          <Database className="w-4 h-4" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="font-mono text-xs font-bold text-[var(--text-primary)] truncate max-w-[220px] sm:max-w-xs">
                          {item.filename}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] flex items-center gap-2">
                          <span className={item.type === 'FULL_SYSTEM' ? 'text-purple-400 font-semibold' : 'text-sky-400 font-semibold'}>
                            {item.type === 'FULL_SYSTEM'
                              ? t('backups.fullSystemMigration')
                              : t('backups.databaseOnly')}
                          </span>
                          {item.totalRecords > 0 && (
                            <>
                              <span>&bull;</span>
                              <span>{t('backups.recordsCount', { n: item.totalRecords })}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-3 px-3">
                    <span
                      className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold uppercase ${
                        item.source === 'SCHEDULED'
                          ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          : item.source === 'IMPORTED'
                          ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                          : 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20'
                      }`}
                    >
                      {item.source === 'SCHEDULED'
                        ? t('backups.sourceScheduled')
                        : item.source === 'IMPORTED'
                        ? t('backups.sourceUploaded')
                        : t('backups.sourceManual')}
                    </span>
                  </td>

                  <td className="py-3 px-3 font-mono text-xs font-bold text-[var(--text-primary)]">
                    {item.sizeFormatted}
                  </td>

                  <td className="py-3 px-3 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">
                    {formatDateTime(item.createdAt)}
                  </td>

                  <td className="py-3 pl-3 pr-3.5 text-right last:rounded-r-[6px]">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Descargar */}
                      <button
                        onClick={() => handleDownload(item.filename)}
                        disabled={descargando === item.filename}
                        className="p-1.5 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:cursor-wait"
                        title={t('backups.downloadBackup')}
                      >
                        {descargando === item.filename ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                      </button>

                      {/* Restaurar */}
                      <button
                        onClick={() => setRestoreTarget(item)}
                        className="p-1.5 rounded-[4px] border border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 transition-colors cursor-pointer"
                        title={t('backups.restoreToThisPoint')}
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>

                      {/* Eliminar */}
                      <button
                        onClick={() => setDeleteTarget(item)}
                        className="p-1.5 rounded-[4px] border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors cursor-pointer"
                        title={t('backups.deleteBackupFile')}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
