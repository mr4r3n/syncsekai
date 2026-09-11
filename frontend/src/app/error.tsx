'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useI18n } from '@/i18n/I18nProvider';
import {
  AlertTriangle,
  RotateCcw,
  LayoutDashboard,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Activity,
  Sun,
  Moon,
} from 'lucide-react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();
  const [showDetails, setShowDetails] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Loguear error internamente
    console.error('SyncSekai Uncaught Route Error:', error);

    const currentTheme = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
    setTheme(currentTheme);
  }, [error]);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('plexsync_theme', nextTheme);
  };

  const handleCopyDetails = () => {
    const details = `SyncSekai Error Report\nMessage: ${error?.message || 'Unknown'}\nDigest: ${error?.digest || 'N/A'}\nStack: ${error?.stack || 'N/A'}\nTimestamp: ${new Date().toISOString()}`;
    navigator.clipboard.writeText(details);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-rose-500/20 selection:text-rose-300 relative overflow-hidden transition-colors duration-300">
      {/* Luces difuminadas de fondo en tono cálido/alerta */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] bg-gradient-to-tr from-rose-500/15 via-amber-500/10 to-red-500/10 rounded-full blur-[110px] pointer-events-none" />

      {/* HEADER SUPERIOR */}
      <header className="w-full px-6 py-5 flex items-center justify-between z-10">
        <Link href="/connections" className="flex items-center gap-3 group select-none">
          <div className="w-9 h-9 rounded-[8px] bg-gradient-to-tr from-[#FF634A] to-[#FF8573] flex items-center justify-center shadow-lg shadow-rose-500/20 group-hover:scale-105 transition-transform">
            <span className="font-heading font-black text-white text-base tracking-tight">PS</span>
          </div>
          <div>
            <span className="font-heading font-bold text-sm text-[var(--text-primary)] block leading-tight">
              SyncSekai
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{t('errors.tagline')}</span>
          </div>
        </Link>

        {mounted && (
          <button
            onClick={toggleTheme}
            className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all cursor-pointer shadow-sm"
            title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            aria-label={t('errors.themeToggle')}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-indigo-400" />}
          </button>
        )}
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col items-center text-center z-10 my-auto">
        <div className="glass-card p-7 sm:p-10 w-full space-y-6 shadow-2xl relative border-rose-500/20">
          {/* Badge y Código 500 */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20 select-none">
              <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
              <span>{t('errors.serverErrorCode')}</span>
            </div>

            <div className="relative flex items-center justify-center">
              <span className="font-heading font-black text-7xl sm:text-8xl tracking-tighter text-[var(--text-primary)] opacity-90 select-none">
                500
              </span>
              <AlertTriangle className="w-12 h-12 text-rose-400 absolute -bottom-1 -right-2 sm:right-6 opacity-80 animate-pulse" />
            </div>
          </div>

          {/* Textos Informativos */}
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)]">{t('errors.boundaryTitle')}</h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">{t('errors.boundaryDesc')}</p>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => reset()}
              className="btn-primary w-full sm:w-auto text-xs flex items-center justify-center gap-2"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('errors.retry')}</span>
            </button>

            <Link
              href="/connections"
              className="btn-secondary w-full sm:w-auto text-xs flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t('errors.toDashboard')}</span>
            </Link>

            <Link
              href="/admin/services"
              className="btn-secondary w-full sm:w-auto text-xs flex items-center justify-center gap-2"
            >
              <Activity className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('errors.diagnostics')}</span>
            </Link>
          </div>

          {/* Detalles Técnicos Colapsables */}
          <div className="pt-4 border-t border-[var(--border-subtle)] space-y-3 text-left">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="w-full flex items-center justify-between text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors select-none cursor-pointer"
            >
              <span>{showDetails ? t('errors.hideTechnical') : t('errors.showTechnical')}</span>
              {showDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>

            {showDetails && (
              <div className="p-3.5 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-mono space-y-2.5">
                <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)]">
                  <span>{t('errors.message')}</span>
                  <button
                    onClick={handleCopyDetails}
                    className="flex items-center gap-1 text-[var(--accent-text)] hover:underline cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copiado' : 'Copiar informe'}</span>
                  </button>
                </div>
                <p className="text-rose-400 break-words leading-relaxed">
                  {error?.message || t('errors.unspecified')}
                </p>
                {error?.digest && (
                  <p className="text-[10px] text-[var(--text-muted)]">
                    Digest: {error.digest}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* FOOTER INFERIOR */}
      <footer className="w-full px-6 py-4 text-center text-[11px] font-mono text-[var(--text-muted)] z-10">{t('errors.footerMonitoring')}</footer>
    </div>
  );
}
