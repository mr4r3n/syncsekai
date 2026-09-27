'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';
import { SetupStepper } from './_components/SetupStepper';
import { SetupStepDomain } from './_components/SetupStepDomain';
import { SetupStepSmtp } from './_components/SetupStepSmtp';
import { SetupStepApis } from './_components/SetupStepApis';
import { SetupStepAdmin } from './_components/SetupStepAdmin';

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
      <SetupStepper currentStep={currentStep} setCurrentStep={setCurrentStep} />

      {/* FORM CONTAINER */}
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
                <SetupStepDomain
                  formData={formData}
                  setFormData={setFormData}
                  showToast={showToast}
                  setCurrentStep={setCurrentStep}
                />
              )}

              {/* PASO 2: SERVIDOR SMTP / CORREO */}
              {currentStep === 2 && (
                <SetupStepSmtp
                  formData={formData}
                  setFormData={setFormData}
                  setCurrentStep={setCurrentStep}
                  handleTestSmtp={handleTestSmtp}
                  testingSmtp={testingSmtp}
                />
              )}

              {/* PASO 3: APIS & CONECTORES */}
              {currentStep === 3 && (
                <SetupStepApis
                  formData={formData}
                  setFormData={setFormData}
                  setCurrentStep={setCurrentStep}
                />
              )}

              {/* PASO 4: CUENTA SUPERADMINISTRADOR */}
              {currentStep === 4 && (
                <SetupStepAdmin
                  formData={formData}
                  setFormData={setFormData}
                  setCurrentStep={setCurrentStep}
                  submitting={submitting}
                />
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
