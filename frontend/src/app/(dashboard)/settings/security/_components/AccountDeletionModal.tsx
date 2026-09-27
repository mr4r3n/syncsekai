'use client';

import React from 'react';
import {
  AlertTriangle,
  X,
  Lock,
  Smartphone,
  Loader2,
  Mail,
} from 'lucide-react';

interface AccountDeletionModalProps {
  showDeletionModal: boolean;
  deleteProps: any;
  setShowDeletionModal: (show: boolean) => void;
  userProfile: any;
  handleRequestDeletion: (e: React.FormEvent) => void;
  deletePasswordInput: string;
  setDeletePasswordInput: (val: string) => void;
  delete2FaInput: string;
  setDelete2FaInput: (val: string) => void;
  requestingDeletion: boolean;
  t: (key: string, values?: any) => string;
}

export function AccountDeletionModal({
  showDeletionModal,
  deleteProps,
  setShowDeletionModal,
  userProfile,
  handleRequestDeletion,
  deletePasswordInput,
  setDeletePasswordInput,
  delete2FaInput,
  setDelete2FaInput,
  requestingDeletion,
  t,
}: AccountDeletionModalProps) {
  if (!showDeletionModal) return null;

  return (
    <>
      {/* 2-PHASE DELETION REQUEST MODAL */}
      {showDeletionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-150">
          <div
            {...deleteProps}
            className="w-full max-w-md rounded-[8px] border border-rose-500/30 bg-[var(--bg-surface-elevated)] backdrop-blur-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-start justify-between gap-3 border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.requestAccountDeletion')}</h3>
                  <p className="text-xs text-rose-400 font-mono">{t('security.identityVerificationRequired')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowDeletionModal(false)}
                className="text-[var(--text-muted)] hover:text-white transition-colors p-1 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('security.enterCredentialsToReceive')}{' '}<strong className="text-[var(--text-primary)]">{userProfile?.email}</strong>{' '}{t('security.finalAuthLink')}</p>

            <form onSubmit={handleRequestDeletion} className="space-y-4">
              {userProfile?.hasPassword && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('security.currentPasswordLabel')}</label>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500 transition-all">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <input
                      type="password"
                      autoFocus
                      required
                      value={deletePasswordInput}
                      onChange={(e) => setDeletePasswordInput(e.target.value)}
                      placeholder={t('security.yourPassword')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>
              )}

              {userProfile?.twoFactorEnabled && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>{t('security.twoFactorCodeLabel')}</span>
                    <span className="text-[10.5px] text-amber-400 font-mono">{t('security.requiredTwoFactorActive')}</span>
                  </label>
                  <div className="flex items-center gap-2.5 px-3.5 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] focus-within:border-rose-500 focus-within:ring-1 focus-within:ring-rose-500 transition-all">
                    <Smartphone className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                    <input
                      type="text"
                      required
                      maxLength={8}
                      value={delete2FaInput}
                      onChange={(e) => setDelete2FaInput(e.target.value.trim())}
                      placeholder={t('security.sixDigitCode')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none font-mono tracking-widest"
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeletionModal(false)}
                  disabled={requestingDeletion}
                  className="btn-secondary text-xs px-4 py-2 cursor-pointer"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={requestingDeletion}
                  className="px-4 py-2 rounded-[6px] text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-600/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                >
                  {requestingDeletion ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  <span>{t('security.sendConfirmationEmail')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
