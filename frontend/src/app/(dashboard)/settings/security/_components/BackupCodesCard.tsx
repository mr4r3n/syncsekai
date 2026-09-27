'use client';

import {
  FileText,
  Key,
  Loader2,
  ShieldAlert,
} from 'lucide-react';

interface BackupCodesCardProps {
  backupStatus: { hasBackupCodes: boolean; remainingCount: number; generatedAt: string | null } | null;
  handleStartGenerateBackup: () => void;
  generatingBackup: boolean;
  loadingBackupStatus: boolean;
  t: (key: string, values?: any) => string;
}

export function BackupCodesCard({
  backupStatus,
  handleStartGenerateBackup,
  generatingBackup,
  loadingBackupStatus,
  t,
}: BackupCodesCardProps) {
  return (
    <>
              {/* CARD 3: CÓDIGOS DE RECUPERACIÓN DE EMERGENCIA */}
              <div className="glass-card p-6 sm:p-7 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                      <FileText className="w-5 h-5 text-amber-400" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.emergencyCodes')}</h2>
                        {backupStatus?.hasBackupCodes ? (
                          <span className="badge-status-success font-mono text-[10.5px]">
                            {backupStatus.remainingCount} {backupStatus.remainingCount === 1 ? 'CÓDIGO' : 'CÓDIGOS'}
                          </span>
                        ) : (
                          <span className="badge-status-neutral font-mono text-[10.5px]">{t('security.notGenerated')}</span>
                        )}
                      </div>
                      <p className="text-xs text-[var(--text-secondary)]">{t('security.emergencyCodesDesc')}</p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleStartGenerateBackup}
                    disabled={generatingBackup || loadingBackupStatus}
                    className="btn-primary text-xs self-start sm:self-auto shrink-0"
                  >
                    {generatingBackup ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Key className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {backupStatus?.hasBackupCodes ? t('security.regenerateCodes') : t('security.generateEmergencyCodes')}
                    </span>
                  </button>
                </div>

                <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
                  <div className="flex items-start gap-2.5">
                    <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-[var(--text-secondary)] leading-relaxed">
                      {backupStatus?.hasBackupCodes ? (
                        <p>{t('security.youHave')}{' '}<strong>{backupStatus.remainingCount} códigos de recuperación válidos</strong>{' '}{t('security.codesOnceOnly')}</p>
                      ) : (
                        <p>{t('security.noCodesYet')}</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
    </>
  );
}
