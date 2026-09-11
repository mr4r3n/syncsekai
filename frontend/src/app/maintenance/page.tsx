'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import {
  Cog,
  Wrench,
  RefreshCw,
  Clock,
  ArrowRight,
  Shield,
  CheckCircle2,
} from 'lucide-react';

import { useI18n } from '@/i18n/I18nProvider';
export default function MaintenancePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>(
    t('maintenance.defaultMessage'),
  );
  const [estimatedEnd, setEstimatedEnd] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(10);

  useEffect(() => {
    checkMaintenanceStatus(false);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          checkMaintenanceStatus(false);
          return 10;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const checkMaintenanceStatus = async (isManual = true) => {
    if (isManual) setChecking(true);
    try {
      const res = await api.setup.getMaintenanceStatus();
      if (!res.inMaintenance) {
        router.push('/');
        return;
      }
      if (res.message) setStatusMessage(res.message);
      if (res.estimatedEnd) setEstimatedEnd(res.estimatedEnd);
    } catch {
      // Ignorar errores temporales
    } finally {
      if (isManual) {
        setTimeout(() => setChecking(false), 500);
      }
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-[var(--accent-primary)]/20 selection:text-[var(--accent-text)] transition-colors duration-300 relative overflow-x-hidden font-sans">
      {/* GLOWS AMBIENTALES DE FONDO */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] pointer-events-none overflow-hidden opacity-30 dark:opacity-20 z-0">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-[var(--accent-primary)] rounded-full blur-[150px]" />
        <div className="absolute -top-20 right-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[170px]" />
      </div>

      {/* TOPBAR HEADER DE BORDE A BORDE */}
      <header className="w-full border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-xs relative z-10">
        <div className="w-full px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[var(--radius-md,6px)] overflow-hidden flex items-center justify-center">
              <img
                src="/logo.webp"
                alt="SyncSekai Logo"
                width={36}
                height={36}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/logo.jpeg';
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight font-heading">SyncSekai</span>
              <span className="px-2 py-0.5 rounded-[var(--radius-sm,4px)] text-[10px] font-mono font-bold uppercase bg-amber-500/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 dark:bg-amber-400" />
                MANTENIMIENTO
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL: FLOTANTE Y SIN CAJAS EN EL CENTRO DE LA PANTALLA */}
      <main className="w-full max-w-2xl mx-auto px-4 sm:px-6 my-auto py-12 relative z-10 text-center space-y-8">
        {/* ENGRANAJES PUROS SIN BACKGROUNDS */}
        <div className="relative w-16 h-16 mx-auto flex items-center justify-center">
          {/* Engranaje Principal */}
          <Cog className="w-12 h-12 text-amber-500 dark:text-amber-400 animate-spin [animation-duration:10s] drop-shadow-md" />
          {/* Engranaje Secundario Acoplado */}
          <Cog className="w-7 h-7 text-[var(--accent-primary)] absolute -bottom-1 -right-1 animate-spin [animation-duration:6s] [animation-direction:reverse] drop-shadow-md" />
        </div>

        {/* TÍTULO Y MENSAJE */}
        <div className="space-y-3">
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[var(--text-primary)] font-heading leading-tight">{t('maintenance.title')}</h1>
          <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed max-w-lg mx-auto">
            {statusMessage}
          </p>
          {estimatedEnd && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 mt-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Finalización estimada: {new Date(estimatedEnd).toLocaleTimeString()}</span>
            </div>
          )}
        </div>

        {/* CONTADOR DE RECONEXIÓN & BARRA SUTIL */}
        <div className="space-y-2 max-w-xs mx-auto pt-2">
          <div className="text-xs font-mono text-[var(--text-muted)] flex items-center justify-center gap-2">
            <span>{t('maintenance.retryingIn')}</span>
            <span className="text-[var(--text-primary)] font-bold">{countdown}s</span>
          </div>
          <div className="w-full h-1 rounded-full bg-[var(--border-subtle)] overflow-hidden">
            <div
              style={{ width: `${((10 - countdown) / 10) * 100}%` }}
              className="h-full bg-[var(--accent-primary)] rounded-full transition-all duration-1000 ease-linear"
            />
          </div>
        </div>

        {/* BOTONES DE ACCIÓN */}
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          <button
            type="button"
            onClick={() => checkMaintenanceStatus(true)}
            disabled={checking}
            className="px-6 py-3 rounded-[var(--radius-md,6px)] bg-[var(--accent-primary)] text-white hover:opacity-90 font-bold text-xs shadow-xl shadow-[var(--accent-primary)]/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? t('maintenance.checkingServers') : t('maintenance.checkStatusNow')}</span>
          </button>

          <Link
            href="/docs"
            className="px-5 py-3 rounded-[var(--radius-md,6px)] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] font-semibold text-xs transition-colors text-center"
          >{t('topbar.documentation')}</Link>
        </div>

        {/* ENLACE DISCRETO DE ADMINISTRADOR */}
        <div className="pt-4 text-xs font-mono text-[var(--text-muted)]">
          <span>{t('maintenance.areYouAdmin')}{' '}</span>
          <Link
            href="/login"
            className="text-[var(--accent-primary)] hover:underline font-bold inline-flex items-center gap-1 ml-1.5"
          >
            <span>{t('maintenance.staffLogin')}</span>
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      </main>

      {/* FOOTER DE BORDE A BORDE */}
      <footer className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] py-6 relative z-10 transition-colors">
        <div className="w-full px-4 sm:px-8 lg:px-12 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono text-[var(--text-muted)]">
          <div>&copy; {new Date().getFullYear()} SyncSekai &bull; {t('maintenance.systemStatus')}</div>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="hover:text-[var(--text-primary)] transition-colors">
              Privacidad &amp; RGPD
            </Link>
            <Link href="/terms" className="hover:text-[var(--text-primary)] transition-colors">{t('legal.termsTitle')}</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
