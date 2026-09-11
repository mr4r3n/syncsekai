'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { LanguageToggle } from '@/components/LanguageToggle';
import { ThemeToggle } from '@/components/ThemeToggle';
import {
  Mail,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  Key,
  Lock,
  User,
  ShieldAlert,
  AlertCircle,
} from 'lucide-react';

export default function ForgotPasswordPage() {
  const { showToast } = useToast();
  const { t } = useI18n();

  const [mode, setMode] = useState<'EMAIL' | 'BACKUP_CODE'>('EMAIL');

  // Modo Correo
  const [email, setEmail] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Modo Código de Emergencia
  const [identifier, setIdentifier] = useState('');
  const [backupCode, setBackupCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loadingBackup, setLoadingBackup] = useState(false);
  const [backupSuccess, setBackupSuccess] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError(null);
    if (!email.trim()) {
      const msg = t('auth.enterYourEmail');
      setEmailError(msg);
      showToast(msg, 'error');
      return;
    }

    setLoadingEmail(true);
    try {
      const res = await api.auth.forgotPassword({ email: email.trim().toLowerCase() });
      setEmailSent(true);
      showToast(res.message || t('auth.instructionsSent'), 'success');
    } catch (err: any) {
      const msg = err.message || t('auth.requestFailed');
      setEmailError(msg);
      showToast(msg, 'error');
    } finally {
      setLoadingEmail(false);
    }
  };

  const handleBackupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBackupError(null);
    if (!identifier.trim() || !backupCode.trim()) {
      const msg = t('auth.enterUserAndCode');
      setBackupError(msg);
      showToast(msg, 'error');
      return;
    }
    if (newPassword.length < 12) {
      const msg = t('auth.newPasswordMinLength');
      setBackupError(msg);
      showToast(msg, 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      const msg = t('auth.passwordsDoNotMatch');
      setBackupError(msg);
      showToast(msg, 'error');
      return;
    }

    setLoadingBackup(true);
    try {
      const res = await api.auth.recoverWithBackupCode({
        identifier: identifier.trim(),
        backupCode: backupCode.trim().toUpperCase(),
        newPassword,
      });
      setBackupSuccess(
        res.message ||
          t('auth.passwordResetSuccess'),
      );
      showToast(t('auth.passwordResetWithCode'), 'success');
    } catch (err: any) {
      const msg = err.message || t('auth.invalidEmergencyCode');
      setBackupError(msg);
      showToast(msg, 'error');
    } finally {
      setLoadingBackup(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-4 selection:bg-[#FF634A]/30 relative overflow-hidden">
      {/* Luces ambientales de fondo */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FF634A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#00D26A]/10 rounded-full blur-3xl pointer-events-none" />

      {/* TARJETA PRINCIPAL */}
      <div className="w-full max-w-md p-7 sm:p-8 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-2xl space-y-6 relative z-10">
        {/* Barra superior de controles */}
        <div className="flex items-center justify-between w-full">
          <Link
            href="/login"
            className="flex items-center gap-1.5 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('common.back')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* CABECERA */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md mb-2 shadow-inner">
            <KeyRound className="w-6 h-6 text-[#FF634A]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('auth.recoverTitle')}</h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">{t('auth.recoverSubtitle')}</p>
        </div>

        {/* SELECTOR DE PESTAÑAS / MÉTODO */}
        {!emailSent && !backupSuccess && (
          <div className="grid grid-cols-2 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs font-semibold">
            <button
              type="button"
              onClick={() => setMode('EMAIL')}
              className={`py-2 px-3 rounded-[4px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'EMAIL'
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Mail className="w-3.5 h-3.5" />
              <span>{t('auth.recoverByEmail')}</span>
            </button>

            <button
              type="button"
              onClick={() => setMode('BACKUP_CODE')}
              className={`py-2 px-3 rounded-[4px] transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                mode === 'BACKUP_CODE'
                  ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] shadow-sm font-bold border border-[var(--border-subtle)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>{t('auth.recoverByCode')}</span>
            </button>
          </div>
        )}

        {/* CONTENIDO 1: RECUPERACIÓN POR CORREO */}
        {mode === 'EMAIL' && (
          <>
            {emailSent ? (
              <div className="space-y-6 text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto animate-in zoom-in-95 duration-300">
                  <CheckCircle2 className="w-7 h-7" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('auth.emailSentTitle')}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('auth.ifEmail')}{' '}<span className="font-semibold text-[var(--text-primary)]">{email}</span>{' '}{t('auth.ifEmailRest')}</p>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)]">
                  <Link
                    href="/login"
                    className="w-full py-2.5 px-4 rounded-[6px] text-xs font-bold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-primary)] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    <span>{t('auth.backToLoginLong')}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleEmailSubmit} className="space-y-4">
                {emailError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3 rounded-[6px] text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{emailError}</span>
                  </div>
                )}
                <div className="space-y-1.5">
                  <label htmlFor="forgot-email" className="text-xs font-semibold text-[var(--text-secondary)]">{t('auth.emailLabel')}</label>
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-[var(--accent-primary,#FF634A)] focus-within:ring-1 focus-within:ring-[var(--accent-primary,#FF634A)] transition-colors">
                    <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      id="forgot-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (emailError) setEmailError(null);
                      }}
                      required
                      autoFocus
                      autoComplete="email"
                      spellCheck={false}
                      placeholder={t('auth.emailPlaceholder')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loadingEmail || !email.trim()}
                  className="w-full py-3 px-4 rounded-[6px] text-xs font-bold bg-[var(--accent-primary,#FF634A)] text-white hover:bg-[var(--accent-primary-hover,#ff4d30)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-primary,#FF634A)]/20 disabled:opacity-40 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  {loadingEmail ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <ShieldCheck className="w-4 h-4" aria-hidden="true" />}
                  <span>{t('auth.sendRecoveryLink')}</span>
                </button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{t('auth.backToLogin')}</span>
                  </Link>
                </div>
              </form>
            )}
          </>
        )}

        {/* CONTENIDO 2: RECUPERACIÓN CON CÓDIGO DE EMERGENCIA */}
        {mode === 'BACKUP_CODE' && (
          <>
            {backupSuccess ? (
              <div className="space-y-6 text-center py-4">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto animate-in zoom-in-95 duration-300">
                  <CheckCircle2 className="w-7 h-7" aria-hidden="true" />
                </div>

                <div className="space-y-2">
                  <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('auth.passwordUpdatedTitle')}</h3>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {backupSuccess}
                  </p>
                  <p className="text-[11px] text-[var(--text-muted)] pt-1">{t('auth.emergencyCodeConsumed')}</p>
                </div>

                <div className="pt-4 border-t border-[var(--border-subtle)]">
                  <Link
                    href="/login"
                    className="w-full py-2.5 px-4 rounded-[6px] text-xs font-bold bg-[var(--accent-primary,#FF634A)] text-white hover:bg-[var(--accent-primary-hover,#ff4d30)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-primary,#FF634A)]/20 cursor-pointer"
                  >
                    <span>{t('auth.signInNow')}</span>
                  </Link>
                </div>
              </div>
            ) : (
              <form onSubmit={handleBackupSubmit} className="space-y-4">
                {backupError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3 rounded-[6px] text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{backupError}</span>
                  </div>
                )}
                <div className="p-3 rounded-[6px] bg-amber-500/10 border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" aria-hidden="true" />
                  <p className="leading-relaxed text-[11.5px]">{t('auth.enterOneOf')}{' '}<strong>{t('auth.savedRecoveryCodes')}</strong>{' '}{t('auth.toResetImmediately')}</p>
                </div>

                {/* Identificador: Usuario o Correo */}
                <div className="space-y-1.5">
                  <label htmlFor="backup-identifier" className="text-xs font-semibold text-[var(--text-secondary)]">{t('auth.userOrEmail')}</label>
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-colors">
                    <User className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      id="backup-identifier"
                      name="identifier"
                      type="text"
                      value={identifier}
                      onChange={(e) => {
                        setIdentifier(e.target.value);
                        if (backupError) setBackupError(null);
                      }}
                      required
                      autoFocus
                      autoComplete="username"
                      spellCheck={false}
                      placeholder={t('auth.userOrEmailPlaceholder')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                {/* Código de Emergencia */}
                <div className="space-y-1.5">
                  <label htmlFor="backup-code" className="text-xs font-semibold text-[var(--text-secondary)] flex items-center justify-between">
                    <span>{t('auth.recoveryCode')}</span>
                    <span className="font-mono text-[10px] text-[var(--text-muted)]">XXXX-XXXX</span>
                  </label>
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-colors">
                    <Key className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
                    <input
                      id="backup-code"
                      name="backupCode"
                      type="text"
                      value={backupCode}
                      onChange={(e) => {
                        setBackupCode(e.target.value.toUpperCase());
                        if (backupError) setBackupError(null);
                      }}
                      required
                      maxLength={12}
                      autoComplete="one-time-code"
                      spellCheck={false}
                      placeholder="Ej. ABCD-1234"
                      className="w-full bg-transparent text-sm font-mono uppercase tracking-wider text-[var(--text-primary)] outline-none font-bold"
                    />
                  </div>
                </div>

                {/* Nueva Contraseña */}
                <div className="space-y-1.5">
                  <label htmlFor="backup-new-password" className="text-xs font-semibold text-[var(--text-secondary)]">{t('auth.newPassword')}</label>
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-colors">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      id="backup-new-password"
                      name="newPassword"
                      type="password"
                      value={newPassword}
                      onChange={(e) => {
                        setNewPassword(e.target.value);
                        if (backupError) setBackupError(null);
                      }}
                      required
                      autoComplete="new-password"
                      placeholder={t('auth.minCharsPlaceholder')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                {/* Confirmar Nueva Contraseña */}
                <div className="space-y-1.5">
                  <label htmlFor="backup-confirm-password" className="text-xs font-semibold text-[var(--text-secondary)]">{t('auth.confirmNewPassword')}</label>
                  <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-amber-500 focus-within:ring-1 focus-within:ring-amber-500 transition-colors">
                    <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      id="backup-confirm-password"
                      name="confirmPassword"
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => {
                        setConfirmPassword(e.target.value);
                        if (backupError) setBackupError(null);
                      }}
                      required
                      autoComplete="new-password"
                      placeholder={t('auth.repeatNewPassword')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={
                    loadingBackup ||
                    !identifier.trim() ||
                    !backupCode.trim() ||
                    newPassword.length < 12
                  }
                  className="w-full py-3 px-4 rounded-[6px] text-xs font-bold bg-amber-500 hover:bg-amber-400 text-black transition-all flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 disabled:opacity-40 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
                >
                  {loadingBackup ? (
                    <Loader2 className="w-4 h-4 animate-spin text-black" />
                  ) : (
                    <Key className="w-4 h-4" />
                  )}
                  <span>{t('auth.resetWithEmergencyCode')}</span>
                </button>

                <div className="pt-2 text-center">
                  <Link
                    href="/login"
                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>{t('auth.backToLogin')}</span>
                  </Link>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
