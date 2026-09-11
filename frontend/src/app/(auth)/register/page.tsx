'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api, getApiBase } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/I18nProvider';
import {
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Shield,
  Zap,
  Tv,
  Layers,
  LockKeyhole,
  AlertCircle,
} from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [mounted, setMounted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<string | null>(null);
  const [registeredSuccess, setRegisteredSuccess] = useState<any>(null);

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const error = params.get('error');

      if (error) {
        if (error.includes('NOT_CONFIGURED')) {
          const provName = error.split('_')[0];
          showToast(`El proveedor ${provName} no está configurado aún en backend/.env`, 'info');
        } else if (error === 'ACCESS_DENIED') {
          showToast(t('auth.socialSignupCancelled'), 'info');
        } else {
          showToast(`${t('auth.socialSignupError')} ` + error, 'error');
        }
      }
    }
  }, []);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!username.trim()) {
      const msg = t('auth.enterUsername');
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      const msg = t('auth.enterValidEmail');
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }
    if (password.length < 12) {
      const msg = t('auth.passwordMinLength');
      setFormError(msg);
      showToast(msg, 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.register({
        username: username.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setRegisteredSuccess(res);
      showToast(res.message || t('auth.accountCreated'), 'success');
    } catch (err: any) {
      const msg = err.message || t('auth.registerFailed');
      setFormError(msg);
      showToast(msg, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSocialRegister = (provider: string) => {
    setSocialLoading(provider);
    showToast(`Redirigiendo a ${provider}...`, 'info');
    const apiBase = getApiBase();
    window.location.href = `${apiBase}/api/auth/${provider.toLowerCase()}`;
  };

  return (
    <div
      suppressHydrationWarning
      className="min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] grid grid-cols-1 lg:grid-cols-12 transition-colors duration-300 selection:bg-[var(--accent-primary)]/20 selection:text-[var(--accent-text)] relative overflow-x-hidden font-sans"
    >
      {/* ========================================================= */}
      {/* PANEL IZQUIERDO: TEXTO EDITORIAL & BRANDING LIMPIO       */}
      {/* ========================================================= */}
      <div className="hidden lg:flex lg:col-span-6 xl:col-span-7 flex-col justify-between p-10 xl:p-16 bg-[var(--bg-surface)] relative overflow-hidden">
        {/* Glows ambientales sutiles */}
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-hidden opacity-25 dark:opacity-20 z-0">
          <div className="absolute -top-20 -left-20 w-96 h-96 bg-[var(--accent-primary)] rounded-full blur-[150px]" />
          <div className="absolute -bottom-20 right-10 w-96 h-96 bg-purple-600 rounded-full blur-[160px]" />
        </div>

        {/* Top: Logo */}
        <div className="flex items-center justify-between relative z-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[8px] overflow-hidden flex items-center justify-center">
              <img
                src="/logo.webp"
                alt="SyncSekai Logo"
                width={40}
                height={40}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpeg';
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-lg tracking-tight font-heading">SyncSekai</span>
              <span className="px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold uppercase bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20">
                v3.2
              </span>
            </div>
          </Link>
        </div>

        {/* Centro: Texto Editorial & Declaración de Propósito */}
        <div className="my-auto py-10 space-y-8 relative z-10 max-w-xl">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-sky-400 bg-sky-500/10 border border-sky-500/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Registro Gratuito &bull; Sin Publicidad</span>
            </div>
            <h2 className="text-3xl xl:text-4xl font-extrabold tracking-tight font-heading leading-tight text-[var(--text-primary)]">{t('auth.registerAsideTitle')}</h2>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">{t('auth.registerAsideDesc')}</p>
          </div>

          {/* VENTAJAS EN FORMATO MINIMALISTA */}
          <div className="space-y-3 pt-2">
            <div className="flex items-start gap-3 p-3.5 rounded-[8px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] backdrop-blur-md">
              <div className="w-8 h-8 rounded-[6px] bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                <LockKeyhole className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-[var(--text-primary)]">{t('auth.registerPrivacyTitle')}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{t('auth.registerPrivacyDesc')}</div>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3.5 rounded-[8px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] backdrop-blur-md">
              <div className="w-8 h-8 rounded-[6px] bg-purple-500/10 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                <Layers className="w-4 h-4" />
              </div>
              <div className="space-y-0.5 text-xs">
                <div className="font-bold text-[var(--text-primary)]">{t('auth.registerSmartTitle')}</div>
                <div className="text-[11px] text-[var(--text-secondary)]">{t('auth.registerSmartDesc')}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom */}
        <div className="text-xs text-[var(--text-muted)] font-mono flex items-center justify-between relative z-10 border-t border-[var(--border-subtle)] pt-4">
          <span>&copy; {new Date().getFullYear()} SyncSekai Engine</span>
          <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>Infraestructura segura &bull; Cumplimiento RGPD</span>
          </span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* PANEL DERECHO: FORMULARIO DE REGISTRO                     */}
      {/* ========================================================= */}
      <div className="col-span-1 lg:col-span-6 xl:col-span-5 flex flex-col justify-between p-6 sm:p-10 xl:p-14 min-h-screen relative z-10">
        {/* Top Header que ocupa el ancho completo */}
        <div className="flex items-center justify-between w-full">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{t('common.back')}</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>

        {/* Formulario */}
        <main id="main-content" tabIndex={-1} className="w-full max-w-md mx-auto my-auto py-8 space-y-7 outline-none">
          <div className="space-y-2">
            <div className="w-11 h-11 rounded-[8px] overflow-hidden flex items-center justify-center mb-3 lg:hidden">
              <img
                src="/logo.webp"
                alt="SyncSekai Logo"
                width={44}
                height={44}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpeg';
                }}
              />
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight font-heading text-[var(--text-primary)]">
              {t('auth.registerTitle')}
            </h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">
              {t('auth.registerSubtitle')}
            </p>
          </div>

          {registeredSuccess ? (
            <div className="space-y-6 py-4 text-center animate-in fade-in zoom-in-95 duration-200" suppressHydrationWarning>
              <div className="w-14 h-14 rounded-[8px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-7 h-7" />
              </div>

              <div className="space-y-1.5">
                <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">
                  {registeredSuccess.role === 'ADMIN'
                    ? t('auth.adminAccountCreated')
                    : t('auth.accountCreatedTitle')}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed px-2">
                  {registeredSuccess.role === 'ADMIN'
                    ? t('auth.adminAccountReady')
                    : registeredSuccess.requiresActivation
                    ? t('auth.activationSent')
                    : t('auth.accountReady')}
                </p>
              </div>

              <Link
                href="/login"
                className="w-full py-3 px-4 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-primary)]/20"
              >
                <span>{t('auth.goToLogin')}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            </div>
          ) : (
            <div className="space-y-6" suppressHydrationWarning>
              {/* Proveedores Sociales */}
              <div className="space-y-3" suppressHydrationWarning>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => handleSocialRegister('Google')}
                    disabled={!!socialLoading || loading}
                    className="py-2.5 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] transition-all flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 shadow-xs"
                    title={t('auth.signUpGoogle')}
                  >
                    <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSocialRegister('Discord')}
                    disabled={!!socialLoading || loading}
                    className="py-2.5 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] transition-all flex items-center justify-center gap-2 text-xs font-semibold text-[var(--text-primary)] disabled:opacity-50 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 shadow-xs"
                    title={t('auth.signUpDiscord')}
                  >
                    <svg className="w-4 h-4 shrink-0 fill-[var(--brand-discord)]" viewBox="0 0 24 24">
                      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                    </svg>
                    <span>Discord</span>
                  </button>
                </div>

                <div className="relative flex items-center justify-center pt-2">
                  <div className="border-t border-[var(--border-subtle)] w-full" />
                  <span className="bg-[var(--bg-app)] px-3 text-[11px] font-mono text-[var(--text-muted)] uppercase tracking-wider shrink-0">{t('auth.orWithEmail')}</span>
                  <div className="border-t border-[var(--border-subtle)] w-full" />
                </div>
              </div>

              {/* Formulario Tradicional */}
              <form suppressHydrationWarning onSubmit={handleRegister} className="space-y-4">
                {formError && (
                  <div
                    role="alert"
                    aria-live="assertive"
                    className="p-3 rounded-[6px] text-xs font-medium bg-rose-500/10 border border-rose-500/30 text-rose-400 flex items-center gap-2 animate-in fade-in"
                  >
                    <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span>{formError}</span>
                  </div>
                )}

                {/* Nombre de Usuario */}
                <div className="space-y-1.5" suppressHydrationWarning>
                  <label htmlFor="register-username" className="text-xs font-semibold text-[var(--text-secondary)]">
                    {t('auth.username')}
                  </label>
                  <div
                    suppressHydrationWarning
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)] transition-colors"
                  >
                    <User className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      suppressHydrationWarning
                      id="register-username"
                      name="username"
                      type="text"
                      value={username}
                      onChange={(e) => {
                        setUsername(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      required
                      autoComplete="username"
                      spellCheck={false}
                      placeholder="tu_usuario"
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                {/* Correo Electrónico */}
                <div className="space-y-1.5" suppressHydrationWarning>
                  <label htmlFor="register-email" className="text-xs font-semibold text-[var(--text-secondary)]">
                    {t('auth.email')}
                  </label>
                  <div
                    suppressHydrationWarning
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)] transition-colors"
                  >
                    <Mail className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      suppressHydrationWarning
                      id="register-email"
                      name="email"
                      type="email"
                      value={email}
                      onChange={(e) => {
                        setEmail(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      required
                      autoComplete="email"
                      spellCheck={false}
                      placeholder={t('auth.emailPlaceholder')}
                      className="w-full bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                  </div>
                </div>

                {/* Contraseña */}
                <div className="space-y-1.5" suppressHydrationWarning>
                  <label htmlFor="register-password" className="text-xs font-semibold text-[var(--text-secondary)]">
                    {t('auth.password')} ({t('auth.passwordRequirements')})
                  </label>
                  <div
                    suppressHydrationWarning
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md focus-within:border-[var(--accent-primary)] focus-within:ring-1 focus-within:ring-[var(--accent-primary)] transition-colors"
                  >
                    <Lock className="w-4 h-4 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                    <input
                      suppressHydrationWarning
                      id="register-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => {
                        setPassword(e.target.value);
                        if (formError) setFormError(null);
                      }}
                      required
                      autoComplete="new-password"
                      placeholder="••••••••••••"
                      className="flex-1 min-w-0 bg-transparent text-sm text-[var(--text-primary)] outline-none"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowPassword((prev) => !prev);
                      }}
                      className="p-1 rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-white/5 transition-colors shrink-0 cursor-pointer relative z-10 flex items-center justify-center"
                      title={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                      aria-label={showPassword ? t('auth.hidePassword') : t('auth.showPassword')}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                    </button>
                  </div>
                </div>

                {/* Botón de Envío */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 px-4 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--accent-primary)]/20 disabled:opacity-40 mt-2 cursor-pointer hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> : <Sparkles className="w-4 h-4" aria-hidden="true" />}
                  <span>{loading ? t('auth.creatingAccount') : t('auth.registerButton')}</span>
                </button>
              </form>
            </div>
          )}

          {/* Enlace a Login */}
          <div className="pt-4 text-center text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
            <span>{t('auth.hasAccount')} </span>
            <Link href="/login" className="text-[var(--accent-text)] hover:underline font-bold">
              {t('auth.loginLink')}
            </Link>
          </div>
        </main>

        {/* Footer que ocupa todo el ancho */}
        <div className="w-full flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] border-t border-[var(--border-subtle)] pt-4" suppressHydrationWarning>
          <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">{t('legal.termsTitle')}</Link>
          <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">
            Privacidad &amp; RGPD
          </Link>
        </div>
      </div>
    </div>
  );
}
