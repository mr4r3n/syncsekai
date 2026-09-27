'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  KeyRound,
  ShieldCheck,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

import { useI18n } from '@/i18n/I18nProvider';
export default function ResetPasswordPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();

  const token = (params?.token as string) || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const isLengthValid = password.length >= 8;
  const isMatch = password.length > 0 && password === confirmPassword;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      showToast(t('auth.tokenNotInUrl'), 'error');
      return;
    }

    if (password.length < 12) {
      showToast(t('auth.passwordMinTwelve'), 'error');
      return;
    }

    if (password !== confirmPassword) {
      showToast(t('auth.passwordsDoNotMatch'), 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.resetPassword({
        token,
        newPassword: password,
      });

      setSuccess(true);
      showToast(res.message || t('auth.passwordResetDone'), 'success');

      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err: any) {
      showToast(err.message || t('auth.passwordResetError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center p-4 selection:bg-[#FF634A]/30 relative overflow-hidden">
      {/* Luces ambientales de fondo */}
      <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#FF634A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#00D26A]/10 rounded-full blur-3xl pointer-events-none" />

      {/* TARJETA PRINCIPAL CON CRISTAL TEMPLADO */}
      <div className="w-full max-w-md p-8 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-2xl space-y-6 relative z-10">
        {/* CABECERA */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md mb-2 shadow-inner">
            <KeyRound className="w-6 h-6 text-[#FF634A]" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">{t('auth.newPassword')}</h1>
          <p className="text-xs text-[var(--text-secondary)] max-w-xs mx-auto">{t('auth.resetIntro')}</p>
        </div>

        {success ? (
          <div className="space-y-6 text-center py-4">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 mx-auto animate-in zoom-in-95 duration-300">
              <CheckCircle2 className="w-7 h-7" />
            </div>

            <div className="space-y-2">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">{t('auth.passwordUpdatedSuccess')}</h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('auth.sessionsRevoked')}</p>
              <p className="text-[11px] text-[var(--text-muted)] pt-2">{t('auth.redirectingToLogin')}</p>
            </div>

            <div className="pt-4 border-t border-[var(--border-subtle)]">
              <Link
                href="/login"
                className="w-full py-2.5 px-4 rounded-[6px] text-xs font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-[#FF634A]/20"
              >
                <span>{t('auth.goToLogin')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Nueva Contraseña */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('auth.newPassword')}</label>
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-[#FF634A] focus-within:ring-1 focus-within:ring-[#FF634A] transition-colors">
                <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoFocus
                  autoComplete="new-password"
                  placeholder="Mínimo 8 caracteres"
                  className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword((prev) => !prev)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer"
                  title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirmar Nueva Contraseña */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('auth.confirmNewPassword')}</label>
              <div className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-[#FF634A] focus-within:ring-1 focus-within:ring-[#FF634A] transition-colors">
                <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" />
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  autoComplete="new-password"
                  placeholder={t('auth.repeatNewPasswordPlaceholder')}
                  className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] outline-none"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors shrink-0 cursor-pointer"
                  title={showConfirmPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Indicadores de Requisitos de Seguridad */}
            <div className="p-3 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-2 text-xs">
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isLengthValid ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <span className={isLengthValid ? 'text-emerald-400 font-medium' : 'text-[var(--text-muted)]'}>{t('auth.minEightChars')}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-1.5 h-1.5 rounded-full ${isMatch ? 'bg-emerald-400' : 'bg-zinc-600'}`} />
                <span className={isMatch ? 'text-emerald-400 font-medium' : 'text-[var(--text-muted)]'}>{t('auth.passwordsMatch')}</span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !isLengthValid || !isMatch}
              className="w-full py-3 px-4 rounded-[6px] text-xs font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[#FF634A]/20 disabled:opacity-40 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              <span>{t('auth.saveNewPassword')}</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
