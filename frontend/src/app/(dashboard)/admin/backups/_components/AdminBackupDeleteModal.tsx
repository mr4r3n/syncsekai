import React from 'react';
import { Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupDeleteModalProps {
  deleteProps: Record<string, any>;
  setDeleteTarget: (val: any | null) => void;
  deleteTarget: any;
  handleDelete: () => void;
}

export function AdminBackupDeleteModal({
  deleteProps,
  setDeleteTarget,
  deleteTarget,
  handleDelete,
}: AdminBackupDeleteModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        {...deleteProps}
        className="w-full max-w-sm p-6 rounded-[6px] border border-red-500/30 bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="w-9 h-9 rounded-[6px] bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-400">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">{t('backups.confirmDeleteTitle')}</h3>
            <p className="text-xs text-[var(--text-muted)]">{t('backups.cannotBeUndone')}</p>
          </div>
        </div>

        <div className="text-xs font-mono text-[var(--text-secondary)] bg-[var(--bg-surface)] p-3 rounded-[6px] border border-[var(--border-subtle)] truncate">
          {deleteTarget.filename}
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setDeleteTarget(null)}
            className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >{t('common.cancel')}</button>
          <button
            type="button"
            onClick={handleDelete}
            className="px-4 py-2 rounded-[6px] text-xs font-bold bg-red-500 text-white hover:bg-red-600 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>{t('backups.deleteBackup')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
