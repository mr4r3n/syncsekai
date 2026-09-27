'use client';

import React from 'react';
import {
  ShieldCheck,
  AlertTriangle,
  Loader2,
  QrCode,
  Mail,
  Send,
  Check,
  Copy,
  CheckCircle2,
} from 'lucide-react';

interface TwoFactorCardProps {
  twoFactorEnabled: boolean;
  twoFactorType: 'APP_TOTP' | 'EMAIL_OTP' | 'NONE';
  handleDisable2Fa: () => void;
  loading2FA: boolean;
  handleStartTotpSetup: () => void;
  handleRequestEmailOtp: () => void;
  totpSetupData: { secret: string; qrCodeDataUrl: string } | null;
  setTotpSetupData: (data: { secret: string; qrCodeDataUrl: string } | null) => void;
  copySecret: () => void;
  copiedSecret: boolean;
  handleEnableTotp: (e: React.FormEvent) => void;
  totpCode: string;
  setTotpCode: (code: string) => void;
  emailOtpRequested: boolean;
  setEmailOtpRequested: (requested: boolean) => void;
  handleEnableEmailOtp: (e: React.FormEvent) => void;
  emailOtpCode: string;
  setEmailOtpCode: (code: string) => void;
  userProfile: any;
  t: (key: string, values?: any) => string;
}

export function TwoFactorCard({
  twoFactorEnabled,
  twoFactorType,
  handleDisable2Fa,
  loading2FA,
  handleStartTotpSetup,
  handleRequestEmailOtp,
  totpSetupData,
  setTotpSetupData,
  copySecret,
  copiedSecret,
  handleEnableTotp,
  totpCode,
  setTotpCode,
  emailOtpRequested,
  setEmailOtpRequested,
  handleEnableEmailOtp,
  emailOtpCode,
  setEmailOtpCode,
  userProfile,
  t,
}: TwoFactorCardProps) {
  return (
    <>
      {/* CARD 2: TWO-FACTOR AUTHENTICATION (2FA) */}
      <div className="glass-card p-6 sm:p-7 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.twoFactorSection')}</h2>
                <span className={twoFactorEnabled ? 'badge-status-success' : 'badge-status-neutral'}>
                  {twoFactorEnabled ? t('security.enabledBadge') : t('security.disabledBadge')}
                </span>
              </div>
              <p className="text-xs text-[var(--text-secondary)]">{t('security.twoFactorDesc')}</p>
            </div>
          </div>

          {twoFactorEnabled && (
            <button
              type="button"
              onClick={handleDisable2Fa}
              disabled={loading2FA}
              className="btn-danger text-xs self-start sm:self-auto"
            >
              {loading2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
              <span>{t('security.disable2fa')}</span>
            </button>
          )}
        </div>

        {!twoFactorEnabled ? (
          /* 2FA ACTIVATION OPTIONS */
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Option A: Authenticator App */}
              <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <QrCode className="w-4 h-4 text-sky-400" />
                    <span>{t('security.authenticatorApp')}</span>
                  </div>
                  <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">{t('security.authenticatorApps')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleStartTotpSetup}
                  disabled={loading2FA}
                  className="btn-primary w-full text-xs py-2"
                >
                  {loading2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <QrCode className="w-3.5 h-3.5" />}
                  <span>{t('security.setUpWithQr')}</span>
                </button>
              </div>

              {/* Option B: Email Code */}
              <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-3 flex flex-col justify-between">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                    <Mail className="w-4 h-4 text-purple-400" />
                    <span>{t('security.emailOtp')}</span>
                  </div>
                  <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed">{t('security.emailOtpDesc')}</p>
                </div>
                <button
                  type="button"
                  onClick={handleRequestEmailOtp}
                  disabled={loading2FA}
                  className="btn-secondary w-full text-xs py-2"
                >
                  {loading2FA ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{t('security.enableByEmail')}</span>
                </button>
              </div>
            </div>

            {/* MODAL / SUB-SECTION: TOTP SETUP WITH QR */}
            {totpSetupData && (
              <div className="p-5 rounded-[6px] border border-sky-500/30 bg-sky-500/5 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-sky-500/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-sky-400 font-heading">
                    <QrCode className="w-4 h-4" />
                    <span>{t('security.step1ScanQr')}</span>
                  </div>
                  <button
                    onClick={() => setTotpSetupData(null)}
                    className="text-xs text-[var(--text-muted)] hover:text-white"
                  >{t('common.cancel')}</button>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <div className="w-36 h-36 bg-white p-2 rounded-[6px] shrink-0 shadow-lg">
                    <img
                      src={totpSetupData.qrCodeDataUrl}
                      alt="QR 2FA TOTP"
                      className="w-full h-full object-contain"
                    />
                  </div>

                  <div className="space-y-3 w-full text-xs">
                    <p className="text-[var(--text-secondary)] leading-relaxed">{t('security.scanQrDesc')}</p>

                    <div className="flex items-center gap-2 p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono text-[11px]">
                      <span className="truncate text-sky-300 font-bold">{totpSetupData.secret}</span>
                      <button
                        type="button"
                        onClick={copySecret}
                        className="ml-auto text-[var(--text-muted)] hover:text-white p-1"
                        title={t('security.copySecretKey')}
                      >
                        {copiedSecret ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleEnableTotp} className="pt-2 flex flex-col sm:flex-row items-center gap-3">
                  <div className="w-full sm:flex-1">
                    <input
                      type="text"
                      maxLength={6}
                      autoFocus
                      value={totpCode}
                      onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder={t('security.enterSixDigitCode')}
                      className="glass-input text-center font-mono tracking-widest text-sm font-bold"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading2FA || totpCode.length !== 6}
                    className="btn-primary w-full sm:w-auto px-6 py-2.5"
                  >
                    {loading2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{t('security.confirmAndEnable')}</span>
                  </button>
                </form>
              </div>
            )}

            {/* SUB-SECTION: EMAIL OTP CONFIRMATION */}
            {emailOtpRequested && (
              <form onSubmit={handleEnableEmailOtp} className="p-5 rounded-[6px] border border-purple-500/30 bg-purple-500/5 space-y-4 animate-in fade-in">
                <div className="flex items-center justify-between border-b border-purple-500/20 pb-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-purple-400 font-heading">
                    <Mail className="w-4 h-4" />
                    <span>{t('security.step2EnterEmailCode')}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEmailOtpRequested(false)}
                    className="text-xs text-[var(--text-muted)] hover:text-white"
                  >{t('common.cancel')}</button>
                </div>

                <p className="text-xs text-[var(--text-secondary)]">
                  {t('security.tempCodeSentToEmail', { email: userProfile?.email || '' })}
                </p>

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <input
                    type="text"
                    maxLength={6}
                    autoFocus
                    value={emailOtpCode}
                    onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ''))}
                    placeholder={t('security.sixDigitCode')}
                    className="glass-input text-center font-mono tracking-widest text-sm font-bold flex-1"
                  />
                  <button
                    type="submit"
                    disabled={loading2FA || emailOtpCode.length !== 6}
                    className="btn-primary w-full sm:w-auto px-6 py-2.5"
                  >
                    {loading2FA ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    <span>{t('security.verifyCode')}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* 2FA ACTIVADO: DETALLES */
          <div className="p-4 rounded-[6px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <Check className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-bold text-[var(--text-primary)]">
                  {twoFactorType === 'EMAIL_OTP' ? t('security.twoFactorEmailActive') : t('security.twoFactorAppActive')}
                </div>
                <p className="text-[11px] text-[var(--text-muted)]">{t('security.willAskEachLogin')}</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
