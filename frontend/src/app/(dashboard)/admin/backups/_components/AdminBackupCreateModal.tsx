import React from 'react';
import { Plus, Database, Archive, Loader2, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupCreateModalProps {
  propsCrear: Record<string, any>;
  setShowCreateModal: (val: boolean) => void;
  creatingType: 'DATABASE' | 'FULL_SYSTEM';
  setCreatingType: (val: 'DATABASE' | 'FULL_SYSTEM') => void;
  creating: boolean;
  handleCreateBackup: () => Promise<void>;
}

export function AdminBackupCreateModal({
  propsCrear,
  setShowCreateModal,
  creatingType,
  setCreatingType,
  creating,
  handleCreateBackup,
}: AdminBackupCreateModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        {...propsCrear}
        className="w-full max-w-md p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="w-9 h-9 rounded-[6px] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/20 flex items-center justify-center text-[var(--accent-text)]">
            <Plus className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">{t('backups.createManualBackup')}</h3>
            <p className="text-xs text-[var(--text-muted)]">{t('backups.selectScope')}</p>
          </div>
        </div>

        <div className="space-y-3">
          {/* Opción 1: Base de Datos */}
          <div
            onClick={() => setCreatingType('DATABASE')}
            className={`p-4 rounded-[6px] border transition-all cursor-pointer flex items-start gap-3 ${
              creatingType === 'DATABASE'
                ? 'border-sky-500 bg-sky-500/10 shadow-sm'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <div className="w-9 h-9 rounded-[6px] bg-sky-500/20 text-sky-400 flex items-center justify-center shrink-0 mt-0.5">
              <Database className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] font-heading">{t('backups.postgresOnly')}</span>
                <span className="text-[10px] font-mono font-bold text-sky-400 bg-sky-500/10 border border-sky-500/20 px-1.5 py-0.5 rounded">{t('backups.fastSize')}</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('backups.postgresOnlyDesc')}</p>
              <ul className="text-[10.5px] text-[var(--text-muted)] space-y-0.5 font-mono">
                <li>{t('backups.bulletUsersTokens')}</li>
                <li>{t('backups.bulletScrobblesMappings')}</li>
                <li>{t('backups.bulletSystemConfig')}</li>
              </ul>
            </div>
          </div>

          {/* Opción 2: Completo (Migración) */}
          <div
            onClick={() => setCreatingType('FULL_SYSTEM')}
            className={`p-4 rounded-[6px] border transition-all cursor-pointer flex items-start gap-3 ${
              creatingType === 'FULL_SYSTEM'
                ? 'border-purple-500 bg-purple-500/10 shadow-sm'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)]'
            }`}
          >
            <div className="w-9 h-9 rounded-[6px] bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
              <Archive className="w-5 h-5" />
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[var(--text-primary)] font-heading">
                  Sistema Completo &amp; Archivos Multimedia
                </span>
                <span className="text-[10px] font-mono font-bold text-purple-400 bg-purple-500/10 border border-purple-500/20 px-1.5 py-0.5 rounded">{t('backups.fullMigration')}</span>
              </div>
              <p className="text-[11px] text-[var(--text-secondary)] leading-relaxed">{t('backups.fullMigrationDesc')}</p>
              <ul className="text-[10.5px] text-[var(--text-muted)] space-y-0.5 font-mono">
                <li>{t('backups.bulletFullPostgres')}</li>
                <li>• Biblioteca multimedia `/uploads` (portadas WebP, avatares)</li>
                <li>{t('backups.bulletFullRestore')}</li>
              </ul>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setShowCreateModal(false)}
            disabled={creating}
            className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >{t('common.cancel')}</button>
          <button
            type="button"
            onClick={handleCreateBackup}
            disabled={creating}
            className="px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {creating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{t('backups.generateBackup')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
