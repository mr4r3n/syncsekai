'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Compass,
  ArrowLeft,
  LayoutDashboard,
  Film,
  GitMerge,
  History,
  BookOpen,
  Sun,
  Moon,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/I18nProvider';

export default function NotFound() {
  const { t } = useI18n();
  const router = useRouter();
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const currentTheme = (document.documentElement.getAttribute('data-theme') as 'dark' | 'light') || 'dark';
    setTheme(currentTheme);
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
    localStorage.setItem('plexsync_theme', nextTheme);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-[var(--accent-primary)]/20 selection:text-[var(--accent-text)] relative overflow-hidden transition-colors duration-300">
      {/* Luces difuminadas de fondo */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-gradient-to-tr from-amber-500/10 via-rose-500/10 to-sky-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* HEADER SUPERIOR */}
      <header className="w-full px-6 py-5 flex items-center justify-between z-10">
        <Link href="/" className="flex items-center gap-3 group select-none">
          <div className="w-9 h-9 rounded-[6px] overflow-hidden flex items-center justify-center shadow-md group-hover:scale-105 transition-transform">
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
          <div>
            <span className="font-heading font-bold text-base text-[var(--text-primary)] block leading-tight">
              SyncSekai
            </span>
            <span className="text-[10px] font-mono text-[var(--text-muted)]">{t('errors.tagline')}</span>
          </div>
        </Link>

        <div className="flex items-center gap-2">
          <LanguageToggle />
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
        </div>
      </header>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full max-w-xl mx-auto px-4 py-8 flex flex-col items-center text-center z-10 my-auto">
        <div className="glass-card p-7 sm:p-10 w-full space-y-6 shadow-2xl relative">
          {/* Badge y Código 404 */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] text-xs font-mono font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20 select-none">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span>{t('errors.notFoundCode')}</span>
            </div>

            <div className="relative flex items-center justify-center">
              <span className="font-heading font-black text-7xl sm:text-8xl tracking-tighter text-[var(--text-primary)] opacity-90 select-none">
                404
              </span>
              <Compass className="w-12 h-12 text-[var(--accent-text)] absolute -bottom-1 -right-2 sm:right-6 opacity-80 animate-bounce" style={{ animationDuration: '3s' }} />
            </div>
          </div>

          {/* Textos Informativos */}
          <div className="space-y-2">
            <h1 className="text-lg sm:text-xl font-bold font-heading text-[var(--text-primary)]">{t('errors.notFoundTitle')}</h1>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed max-w-md mx-auto">{t('errors.notFoundDesc')}</p>
          </div>

          {/* Botones de Acción */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={() => router.back()}
              className="btn-secondary w-full sm:w-auto text-xs flex items-center justify-center gap-2"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>{t('errors.back')}</span>
            </button>

            <Link
              href="/connections"
              className="btn-primary w-full sm:w-auto text-xs flex items-center justify-center gap-2"
            >
              <LayoutDashboard className="w-3.5 h-3.5" />
              <span>{t('errors.toDashboard')}</span>
            </Link>

            <Link
              href="/catalog"
              className="btn-secondary w-full sm:w-auto text-xs flex items-center justify-center gap-2"
            >
              <Film className="w-3.5 h-3.5 text-sky-400" />
              <span>{t('errors.catalog')}</span>
            </Link>
          </div>

          {/* Accesos Rápidos */}
          <div className="pt-5 border-t border-[var(--border-subtle)] space-y-2.5">
            <span className="text-[11px] font-mono text-[var(--text-muted)] block uppercase tracking-wider">
              Enlaces Frecuentes
            </span>
            <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
              <Link
                href="/connections"
                className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
              >
                <LayoutDashboard className="w-3 h-3 text-[#FF634A]" />
                <span>{t('errors.connections')}</span>
              </Link>
              <Link
                href="/mappings"
                className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
              >
                <GitMerge className="w-3 h-3 text-amber-400" />
                <span>Mapeos</span>
              </Link>
              <Link
                href="/history"
                className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
              >
                <History className="w-3 h-3 text-emerald-400" />
                <span>{t('errors.history')}</span>
              </Link>
              <Link
                href="/docs"
                className="px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
              >
                <BookOpen className="w-3 h-3 text-sky-400" />
                <span>{t('topbar.documentation')}</span>
              </Link>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER INFERIOR */}
      <footer className="w-full px-6 py-4 text-center text-[11px] font-mono text-[var(--text-muted)] z-10">{t('errors.footerOperational')}</footer>
    </div>
  );
}
