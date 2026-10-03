import React from 'react';
import { Upload, FileText, Loader2, RotateCcw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminBackupUploadModalProps {
  uploadProps: Record<string, any>;
  setShowUploadModal: (val: boolean) => void;
  setUploadFile: (file: File | null) => void;
  uploadFile: File | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  uploading: boolean;
  handleUploadAndRestore: () => Promise<void>;
  /** Password input: restoring overwrites every account, so it is asked again. */
  passwordField: React.ReactNode;
  passwordReady: boolean;
}

export function AdminBackupUploadModal({
  uploadProps,
  setShowUploadModal,
  setUploadFile,
  uploadFile,
  fileInputRef,
  uploading,
  handleUploadAndRestore,
  passwordField,
  passwordReady,
}: AdminBackupUploadModalProps) {
  const { t } = useI18n();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      <div
        {...uploadProps}
        className="w-full max-w-md p-6 rounded-[6px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl space-y-5">
        <div className="flex items-center gap-3 pb-3 border-b border-[var(--border-subtle)]">
          <div className="w-9 h-9 rounded-[6px] bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
            <Upload className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold font-heading text-[var(--text-primary)]">
              {t('backups.uploadRestoreExternal')}
            </h3>
            <p className="text-xs text-[var(--text-muted)]">{t('backups.uploadBackupFile')}</p>
          </div>
        </div>

        <div className="space-y-3">
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-[var(--border-subtle)] hover:border-[var(--accent-primary)] rounded-[6px] p-6 text-center space-y-2 cursor-pointer transition-colors bg-[var(--bg-surface)]"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".psbackup,.json,.gz"
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  setUploadFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />

            <div className="w-10 h-10 rounded-full bg-[var(--bg-surface-hover)] flex items-center justify-center mx-auto text-[var(--text-secondary)]">
              <FileText className="w-5 h-5" />
            </div>

            <div className="text-xs font-bold text-[var(--text-primary)]">
              {uploadFile ? uploadFile.name : t('backups.clickToSelectFile')}
            </div>

            <p className="text-[11px] text-[var(--text-muted)]">{t('backups.supportedFormats')}</p>
          </div>
        </div>

        {passwordField}

        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => {
              setShowUploadModal(false);
              setUploadFile(null);
            }}
            disabled={uploading}
            className="px-4 py-2 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
          >{t('common.cancel')}</button>
          <button
            type="button"
            onClick={handleUploadAndRestore}
            disabled={uploading || !uploadFile || !passwordReady}
            className="px-4 py-2 rounded-[6px] text-xs font-bold bg-blue-500 text-white hover:bg-blue-600 shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RotateCcw className="w-3.5 h-3.5" />
            )}
            <span>{t('backups.uploadAndRestore')}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
