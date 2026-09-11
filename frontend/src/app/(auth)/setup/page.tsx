'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Globe,
  Mail,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Send,
  Zap,
  Server,
  Lock,
  Sparkles,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

export default function SetupPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [isAlreadyInstalled, setIsAlreadyInstalled] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    bootstrapToken: '',
    // Paso 1: Dominio & URLs
    appDomain: typeof window !== 'undefined'
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? `${window.location.protocol}//${window.location.hostname}:3000`
          : window.location.origin)
      : 'http://localhost:3000',
    webhookPublicUrl: typeof window !== 'undefined'
      ? (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
          ? `${window.location.protocol}//${window.location.hostname}:4000/api/plex/webhook`
          : `${window.location.origin}/api/plex/webhook`)
      : 'http://localhost:4000/api/plex/webhook',
    
    // Paso 2: SMTP
    smtpHost: '',
    smtpPort: 587,
    smtpUser: '',
    smtpPassword: '',
    smtpFrom: 'SyncSekai <noreply@tudominio.com>',
    testRecipient: '',
    
    // Paso 3: APIs
    anilistClientId: '',
    anilistClientSecret: '',
    malClientId: '',
    malClientSecret: '',
    googleClientId: '',
    googleClientSecret: '',
    discordClientId: '',
    discordClientSecret: '',
    plexClientId: 'plexsync-app',

    // Paso 4: SuperAdmin
    adminUsername: '',
    adminEmail: '',
    adminPassword: '',
    adminConfirmPassword: '',
  });

  const [testingSmtp, setTestingSmtp] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [setupComplete, setSetupComplete] = useState(false);

  useEffect(() => {
    async function checkSetup() {
      try {
        const res = await api.setup.getStatus();
        if (res.isInstalled) {
          setIsAlreadyInstalled(true);
        }
      } catch (err: any) {
        console.warn('Error verificando estado de instalación:', err.message);
      } finally {
        setCheckingStatus(false);
      }
    }
    checkSetup();
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleTestSmtp = async () => {
    if (!formData.smtpHost || !formData.smtpFrom || !formData.testRecipient) {
      showToast(t('setup.fillSmtpFields'), 'error');
      return;
    }

    setTestingSmtp(true);
    try {
      const res = await api.setup.testSmtp({
        bootstrapToken: formData.bootstrapToken,
        smtpHost: formData.smtpHost,
        smtpPort: Number(formData.smtpPort) || 587,
        smtpUser: formData.smtpUser || undefined,
        smtpPassword: formData.smtpPassword || undefined,
        smtpFrom: formData.smtpFrom,
        testRecipient: formData.testRecipient,
      });
      showToast(res.message || t('setup.testEmailSent'), 'success');
    } catch (err: any) {
      showToast(err.message || t('setup.smtpConnectError'), 'error');
    } finally {
      setTestingSmtp(false);
    }
  };

  const handleSubmitSetup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.adminUsername.trim() || !formData.adminEmail.trim()) {
      showToast(t('setup.fillAdminFields'), 'error');
      return;
    }

    if (formData.adminPassword.length < 12) {
      showToast(t('setup.adminPasswordMinLength'), 'error');
      return;
    }

    if (formData.adminPassword !== formData.adminConfirmPassword) {
      showToast(t('auth.passwordsDoNotMatch'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.setup.initialize({
        bootstrapToken: formData.bootstrapToken,
        appDomain: formData.appDomain.trim(),
        webhookPublicUrl: formData.webhookPublicUrl.trim(),
        smtpHost: formData.smtpHost.trim() || undefined,
        smtpPort: Number(formData.smtpPort) || 587,
        smtpUser: formData.smtpUser.trim() || undefined,
        smtpPassword: formData.smtpPassword || undefined,
        smtpFrom: formData.smtpFrom.trim() || undefined,
        anilistClientId: formData.anilistClientId.trim() || undefined,
        anilistClientSecret: formData.anilistClientSecret.trim() || undefined,
        malClientId: formData.malClientId.trim() || undefined,
        malClientSecret: formData.malClientSecret.trim() || undefined,
        googleClientId: formData.googleClientId.trim() || undefined,
        googleClientSecret: formData.googleClientSecret.trim() || undefined,
        discordClientId: formData.discordClientId.trim() || undefined,
        discordClientSecret: formData.discordClientSecret.trim() || undefined,
        plexClientId: formData.plexClientId.trim() || undefined,
        adminUsername: formData.adminUsername.trim(),
        adminEmail: formData.adminEmail.trim(),
        adminPassword: formData.adminPassword,
      });

      setSetupComplete(true);
      showToast(t('setup.installCompleteToast'), 'success');
      setTimeout(() => {
        router.push('/login');
      }, 2500);
    } catch (err: any) {
      showToast(err.message || t('setup.initSystemError'), 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (checkingStatus) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
        <span className="text-xs font-mono text-[var(--text-muted)]">{t('setup.checkingInstaller')}</span>
      </div>
    );
  }

  if (isAlreadyInstalled && !setupComplete) {
    return (
      <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
        <div className="glass-card p-8 max-w-md w-full text-center space-y-5">
          <div className="w-12 h-12 rounded-[6px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mx-auto">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-[var(--text-primary)] font-heading">{t('setup.alreadyInstalled')}</h2>
            <p className="text-xs text-[var(--text-secondary)]">{t('setup.alreadyInstalledDesc')}</p>
          </div>
          <button onClick={() => router.push('/login')} className="btn-primary w-full py-2.5">
            <span>{t('auth.goToLogin')}</span>
            <ArrowRight className="w-4 h-4 ml-1" />
          </button>
        </div>
      </div>
    );
  }

  const steps = [
    { id: 1, label: 'Dominio & Red', icon: Globe },
    { id: 2, label: t('setup.smtpServer'), icon: Mail },
    { id: 3, label: 'APIs & Conectores', icon: Key },
    { id: 4, label: 'SuperAdmin', icon: ShieldCheck },
  ];

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between py-8 px-4 sm:px-6">
      {/* TOAST FLOTANTE */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 flex items-center gap-2.5 px-4 py-3 rounded-[6px] border shadow-2xl text-xs font-medium backdrop-blur-xl animate-in slide-in-from-top-2 duration-200 ${
            toast.type === 'success'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
              : toast.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-400'
              : 'bg-sky-500/10 border-sky-500/30 text-sky-400'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* HEADER LOGO */}
      <div className="max-w-2xl mx-auto w-full text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-gradient-to-br from-rose-500 via-purple-600 to-sky-500 flex items-center justify-center font-bold text-white shadow-lg text-lg">
            P
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
            SyncSekai <span className="text-[var(--accent-text)]">Installer</span>
          </h1>
        </div>
        <p className="text-xs text-[var(--text-secondary)]">{t('setup.wizardSubtitle')}</p>
      </div>

      {/* STEPPER PROGRESS */}
      <div className="max-w-2xl mx-auto w-full my-6">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          {steps.map((s) => {
            const Icon = s.icon;
            const isCompleted = currentStep > s.id;
            const isCurrent = currentStep === s.id;
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (isCompleted) setCurrentStep(s.id);
                }}
                className={`p-3 rounded-[6px] border flex flex-col items-center gap-1.5 transition-all select-none ${
                  isCurrent
                    ? 'border-[var(--accent-primary)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] shadow-sm'
                    : isCompleted
                    ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-400 cursor-pointer'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-[11px] font-bold hidden sm:inline">{s.label}</span>
                </div>
                <span className="text-[10px] font-mono sm:hidden">Paso {s.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* CONTENEDOR DEL FORMULARIO */}
      <div className="max-w-2xl mx-auto w-full">
        <div className="glass-card p-6 sm:p-8 space-y-6">
          {setupComplete ? (
            <div className="py-12 text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center justify-center mx-auto animate-bounce">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div className="space-y-1.5">
                <h2 className="text-xl font-bold text-[var(--text-primary)] font-heading">{t('setup.installComplete')}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{t('setup.redirectingToLogin')}</p>
              </div>
              <div className="pt-2">
                <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-text)] mx-auto" />
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmitSetup} className="space-y-6">
              {/* PASO 1: DOMINIO & RED */}
              {currentStep === 1 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-400" />{t('setup.step1Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step1Desc')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.bootstrapToken')}</label>
                    <input
                      type="password"
                      required
                      autoComplete="off"
                      value={formData.bootstrapToken}
                      onChange={(e) => setFormData({ ...formData, bootstrapToken: e.target.value })}
                      className="glass-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('setup.bootstrapTokenDesc')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.appUrl')}</label>
                    <input
                      type="url"
                      required
                      placeholder="https://sync.tudominio.com"
                      value={formData.appDomain}
                      onChange={(e) => setFormData({ ...formData, appDomain: e.target.value })}
                      className="glass-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('setup.appUrlDesc')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.webhookUrl')}</label>
                    <input
                      type="url"
                      placeholder="https://sync.tudominio.com/api/plex/webhook"
                      value={formData.webhookPublicUrl}
                      onChange={(e) => setFormData({ ...formData, webhookPublicUrl: e.target.value })}
                      className="glass-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('setup.webhookUrlDesc')}</p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.appDomain.trim()) {
                          showToast(t('setup.enterAppDomain'), 'error');
                          return;
                        }
                        setCurrentStep(2);
                      }}
                      className="btn-primary"
                    >
                      <span>{t('setup.nextSmtp')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 2: SERVIDOR SMTP / CORREO */}
              {currentStep === 2 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-400" />{t('setup.step2Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step2Desc')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">Host SMTP:</label>
                      <input
                        type="text"
                        placeholder={t('setup.smtpHostPlaceholder')}
                        value={formData.smtpHost}
                        onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">Puerto:</label>
                      <input
                        type="number"
                        placeholder={t('setup.smtpPortPlaceholder')}
                        value={formData.smtpPort}
                        onChange={(e) => setFormData({ ...formData, smtpPort: Number(e.target.value) || 587 })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.smtpUser')}</label>
                      <input
                        type="text"
                        placeholder={t('setup.smtpUserPlaceholder')}
                        value={formData.smtpUser}
                        onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.smtpPassword')}</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={formData.smtpPassword}
                        onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">Remitente Oficial (From):</label>
                    <input
                      type="text"
                      placeholder="SyncSekai <noreply@tudominio.com>"
                      value={formData.smtpFrom}
                      onChange={(e) => setFormData({ ...formData, smtpFrom: e.target.value })}
                      className="glass-input text-xs"
                    />
                  </div>

                  {/* Prueba en Vivo de SMTP */}
                  {formData.smtpHost && (
                    <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-2.5 mt-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 text-sky-400" />{t('setup.testLiveEmail')}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          placeholder={t('setup.testEmailPlaceholder')}
                          value={formData.testRecipient}
                          onChange={(e) => setFormData({ ...formData, testRecipient: e.target.value })}
                          className="glass-input text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={handleTestSmtp}
                          disabled={testingSmtp || !formData.testRecipient}
                          className="btn-secondary shrink-0"
                        >
                          {testingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>{t('setup.sendTest')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t('auth.back')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="btn-primary"
                    >
                      <span>{t('setup.nextApiKeys')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 3: APIS & CONECTORES */}
              {currentStep === 3 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <Key className="w-4 h-4 text-purple-400" />{t('setup.step3Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step3Desc')}</p>
                  </div>

                  {/* AniList */}
                  <div className="p-4 rounded-[6px] border border-sky-500/20 bg-sky-500/5 space-y-3">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> AniList OAuth 2.0 Client (GraphQL)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="AniList Client ID"
                        value={formData.anilistClientId}
                        onChange={(e) => setFormData({ ...formData, anilistClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="AniList Client Secret"
                        value={formData.anilistClientSecret}
                        onChange={(e) => setFormData({ ...formData, anilistClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* MyAnimeList */}
                  <div className="p-4 rounded-[6px] border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" /> MyAnimeList REST API v2 Client
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="MAL Client ID"
                        value={formData.malClientId}
                        onChange={(e) => setFormData({ ...formData, malClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="MAL Client Secret"
                        value={formData.malClientSecret}
                        onChange={(e) => setFormData({ ...formData, malClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Google OAuth */}
                  <div className="p-4 rounded-[6px] border border-rose-500/20 bg-rose-500/5 space-y-3">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" />{t('setup.googleOauth')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Google Client ID (.apps.googleusercontent.com)"
                        value={formData.googleClientId}
                        onChange={(e) => setFormData({ ...formData, googleClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Google Client Secret"
                        value={formData.googleClientSecret}
                        onChange={(e) => setFormData({ ...formData, googleClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Discord OAuth */}
                  <div className="p-4 rounded-[6px] border border-indigo-500/20 bg-[#5865F2]/5 space-y-3">
                    <span className="text-xs font-bold text-[#5865F2] flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" />{t('setup.discordOauth')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Discord Client ID"
                        value={formData.discordClientId}
                        onChange={(e) => setFormData({ ...formData, discordClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Discord Client Secret"
                        value={formData.discordClientSecret}
                        onChange={(e) => setFormData({ ...formData, discordClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t('auth.back')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="btn-primary"
                    >
                      <span>{t('setup.nextSuperAdmin')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PASO 4: CUENTA SUPERADMINISTRADOR */}
              {currentStep === 4 && (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-rose-400" />{t('setup.step4Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step4Desc')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.adminUsername')}</label>
                      <input
                        type="text"
                        required
                        placeholder={t('setup.adminNamePlaceholder')}
                        value={formData.adminUsername}
                        onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                        className="glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('auth.emailLabel')}</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@tudominio.com"
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.masterPassword')}</label>
                      <input
                        type="password"
                        required
                        placeholder={t('security.minSixChars')}
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.confirmPassword')}</label>
                      <input
                        type="password"
                        required
                        placeholder={t('setup.repeatPasswordPlaceholder')}
                        value={formData.adminConfirmPassword}
                        onChange={(e) => setFormData({ ...formData, adminConfirmPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-300">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{t('setup.onPressing')}{' '}<strong>{t('setup.finishInstall')}</strong>{' '}{t('setup.sealNotice')}</span>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t('auth.back')}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary py-2.5 px-6 font-bold"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Instalando SyncSekai...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{t('setup.finishAndSeal')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </form>
          )}
        </div>
      </div>

      {/* FOOTER */}
      <div className="text-center text-[11px] font-mono text-[var(--text-muted)] mt-6">{t('setup.footerVersion')}</div>
    </div>
  );
}
