import React from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupRestoreModalProps {
  propsRestaurar: Record<string, any>;
  setRestoreTarget: (val: any | null) => void;
  restoreTarget: any;
  restoring: boolean;
  handleRestore: () => Promise<void>;
}

export function AdminBackupRestoreModal({
  propsRestaurar,
  setRestoreTarget,
  restoreTarget,
  restoring,
  handleRestore,
}: AdminBackupRestoreModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in">
      <div
        {...propsRestaurar}
        className="w-full max-w-md p-6 rounded-[6px] border border-amber-500/40 bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="w-10 h-10 rounded-[6px] bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">{t('backups.confirmRestoreTitle')}</h3>
            <p className="text-xs text-[var(--text-muted)]">{t('backups.confirmRestoreDesc')}</p>
          </div>
        </div>

        <div className="p-3.5 rounded-[6px] border border-amber-500/20 bg-amber-500/5 space-y-2">
          <div className="text-xs font-mono font-bold text-amber-300">
            Archivo: {restoreTarget.filename}
          </div>
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('backups.confirmRestoreDetail')}</p>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setRestoreTarget(null)}
            disabled={restoring}
            className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >{t('common.cancel')}</button>
          <button
            type="button"
            onClick={handleRestore}
            disabled={restoring}
            className="px-4 py-2 rounded-[6px] text-xs font-bold bg-amber-500 text-black hover:bg-amber-400 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {restoring ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>{t('backups.confirmRestore')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
