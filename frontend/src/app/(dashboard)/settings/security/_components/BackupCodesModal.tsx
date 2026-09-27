'use client';

import React from 'react';
import {
  FileText,
  X,
  AlertTriangle,
  Check,
  Copy,
  Download,
  ShieldCheck,
  Loader2,
  CheckCircle2,
} from 'lucide-react';

interface BackupCodesModalProps {
  backupModalOpen: boolean;
  backupProps: any;
  backupStep: 'VIEW' | 'VERIFY' | 'SUCCESS';
  setBackupModalOpen: (open: boolean) => void;
  generatedCodes: string[];
  handleCopyAllCodes: () => void;
  copiedAllCodes: boolean;
  handleDownloadCodes: () => void;
  setBackupStep: (step: 'VIEW' | 'VERIFY' | 'SUCCESS') => void;
  handleVerifyAndSaveBackup: (e: React.FormEvent) => void;
  challengeNumber: number;
  verifyCodeInput: string;
  setVerifyCodeInput: (val: string) => void;
  verifyingBackup: boolean;
  t: (key: string, values?: any) => string;
}

export function BackupCodesModal({
  backupModalOpen,
  backupProps,
  backupStep,
  setBackupModalOpen,
  generatedCodes,
  handleCopyAllCodes,
  copiedAllCodes,
  handleDownloadCodes,
  setBackupStep,
  handleVerifyAndSaveBackup,
  challengeNumber,
  verifyCodeInput,
  setVerifyCodeInput,
  verifyingBackup,
  t,
}: BackupCodesModalProps) {
  if (!backupModalOpen) return null;

  return (
    <>
      {/* MODAL WIZARD: GENERATION AND VERIFICATION OF EMERGENCY CODES */}
      {backupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
          <div
            {...backupProps}
            className="w-full max-w-lg rounded-[8px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl p-6 sm:p-7 space-y-6 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-start justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center font-bold shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                    {backupStep === 'VIEW' && t('security.wizardStep1')}
                    {backupStep === 'VERIFY' && t('security.wizardStep2')}
                    {backupStep === 'SUCCESS' && t('security.wizardDone')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)]">
                    {backupStep === 'VIEW' && t('security.shownOnlyOnce')}
                    {backupStep === 'VERIFY' && t('security.checkYouSaved')}
                    {backupStep === 'SUCCESS' && t('security.accountProtected')}
                  </p>
                </div>
              </div>

              {backupStep !== 'VERIFY' && (
                <button
                  onClick={() => setBackupModalOpen(false)}
                  className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-white transition-colors cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* STEP 1: DISPLAY CODES */}
            {backupStep === 'VIEW' && (
              <div className="space-y-5">
                <div className="p-3.5 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
                  <p className="leading-relaxed">
                    <strong>Importante:</strong>{' '}{t('security.saveCodesNow')}<u>{t('security.wontSeeAgain')}</u>.
                  </p>
                </div>

                {/* Codes Grid */}
                <div className="grid grid-cols-2 gap-2.5 p-4 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)] font-mono text-xs">
                  {generatedCodes.map((code, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between"
                    >
                      <span className="text-[var(--text-muted)] text-[10.5px]">#{idx + 1}</span>
                      <span className="font-bold text-[var(--text-primary)] tracking-wider select-all">
                        {code}
                      </span>
                    </div>
                  ))}
                </div>

                {/* Botones de Guardado */}
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={handleCopyAllCodes}
                    className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-2"
                  >
                    {copiedAllCodes ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedAllCodes ? 'Copiados' : t('security.copyAll')}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleDownloadCodes}
                    className="btn-secondary flex-1 py-2 text-xs flex items-center justify-center gap-2"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('security.downloadTxt')}</span>
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setBackupStep('VERIFY')}
                  className="btn-primary w-full py-2.5 text-xs font-bold"
                >
                  <span>{t('security.savedMyCodes')}</span>
                </button>
              </div>
            )}

            {/* STEP 2: RANDOM VERIFICATION */}
            {backupStep === 'VERIFY' && (
              <form onSubmit={handleVerifyAndSaveBackup} className="space-y-5">
                <div className="p-3.5 rounded-[6px] bg-sky-500/10 border border-sky-500/20 text-xs text-sky-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-sky-400" />
                  <p className="leading-relaxed">{t('security.toEnableEnter')}{' '}<strong>{t('security.codeChallengeNumber', { number: challengeNumber })}</strong>{' '}{t('security.fromListJustSaved')}</p>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>{t('security.enterCodeChallenge', { number: challengeNumber })}</span>
                    <span className="font-mono text-[10.5px] text-[var(--text-muted)]">{t('security.formatHint')}</span>
                  </label>
                  <input
                    type="text"
                    value={verifyCodeInput}
                    onChange={(e) => setVerifyCodeInput(e.target.value.toUpperCase())}
                    placeholder="Ej. ABCD-1234"
                    autoFocus
                    required
                    maxLength={12}
                    className="glass-input font-mono text-center tracking-widest text-sm uppercase font-bold"
                  />
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setBackupStep('VIEW')}
                    disabled={verifyingBackup}
                    className="btn-secondary flex-1 py-2.5 text-xs"
                  >
                    <span>{t('security.backToView')}</span>
                  </button>

                  <button
                    type="submit"
                    disabled={verifyingBackup || !verifyCodeInput.trim()}
                    className="btn-primary flex-1 py-2.5 text-xs font-bold"
                  >
                    {verifyingBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{t('security.verifyAndEnable')}</span>
                  </button>
                </div>
              </form>
            )}

            {/* STEP 3: SUCCESS */}
            {backupStep === 'SUCCESS' && (
              <div className="space-y-6 text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 mx-auto animate-in zoom-in-95 duration-200">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-bold text-[var(--text-primary)]">{t('security.emergencyCodesEnabled')}</h4>
                  <p className="text-xs text-[var(--text-secondary)] max-w-sm mx-auto leading-relaxed">{t('security.emergencyCodesEnabledDesc')}</p>
                </div>

                <button
                  type="button"
                  onClick={() => setBackupModalOpen(false)}
                  className="btn-primary w-full py-2.5 text-xs font-bold"
                >
                  <span>{t('security.understoodAndClose')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
