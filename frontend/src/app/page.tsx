'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';
import {
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Server,
  Activity,
  Cpu,
  Clock,
} from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';

interface PublicStats {
  status: string;
  uptimeFormatted: string;
  uptimePercentage: string;
  successRate: string;
  latency: string;
  totalScrobbles: number;
  totalUsers: number;
  totalMappings: number;
  engine: string;
  services: Record<string, string>;
  lastScrobbleAt?: string | null;
}

type Traductor = (key: string, vars?: Record<string, string | number>) => string;

function formatLastScrobble(t: Traductor, dateStr?: string | null): string {
  if (!dateStr) return t('landing.lastSyncNever');
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    if (diffMs < 0 || isNaN(diffMs)) return t('topbar.momentAgo');
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('topbar.momentAgo');
    if (mins < 60) return t('topbar.minutesAgo', { mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('topbar.hoursAgo', { hours });
    return t('topbar.daysAgo', { days: Math.floor(hours / 24) });
  } catch {
    return t('landing.lastSyncNever');
  }
}

/** Los servicios del panel de estado, en el orden en que se pintan. */
const SERVICIOS_PORTADA = [
  { clave: 'backend', etiqueta: 'SyncSekai API' },
  { clave: 'database', etiqueta: 'PostgreSQL' },
  { clave: 'anilist', etiqueta: 'AniList' },
  { clave: 'mal', etiqueta: 'MyAnimeList' },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [hasSession, setHasSession] = useState(false);
  const [stats, setStats] = useState<PublicStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    // La cookie de sesión es httpOnly, así que document.cookie nunca la ve: hay que
    // preguntarle al backend. Un 401 de visitante anónimo es la respuesta esperada.
    api.auth
      .me()
      .then((me) => {
        if (me && (me.id || me.user?.id || me.username)) {
          setHasSession(true);
          router.replace('/connections');
        }
      })
      .catch(() => setHasSession(false));

    api.setup
      .getPublicStats()
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        /*
         * Si la API no contesta, no se enseña nada.
         *
         * Aquí había un objeto entero inventado -1420 scrobbles, 99.8% de
         * acierto, 4ms- que se pintaba igual que si fuera real. Es decir: la
         * portada enseñaba sus mejores cifras justo cuando el servicio estaba
         * caído. Ahora las tarjetas muestran un guión.
         */
        setStats(null);
      })
      .finally(() => setLoadingStats(false));
  }, []);

  const handleOpenCookieSettings = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('open_cookie_settings'));
    }
  };

  return (
    <div className="min-h-screen w-full bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-[var(--accent-primary)]/20 selection:text-[var(--accent-text)] transition-colors duration-300 relative overflow-x-hidden font-sans">
      {/* GLOWS AMBIENTALES DE FONDO */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-[550px] pointer-events-none overflow-hidden opacity-30 dark:opacity-20 z-0">
        <div className="absolute -top-32 left-1/4 w-96 h-96 bg-[var(--accent-primary)] rounded-full blur-[150px]" />
        <div className="absolute -top-20 right-1/4 w-96 h-96 bg-purple-600 rounded-full blur-[170px]" />
      </div>

      {/* TOPBAR HEADER CON CRISTAL TEMPLADO FLUIDO QUE OCUPA TODO EL ANCHO */}
      <header className="sticky top-0 z-50 w-full border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-xs transition-colors duration-300">
        <nav className="w-full px-4 sm:px-8 lg:px-12 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-[8px] overflow-hidden flex items-center justify-center">
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
              <span className="font-bold text-base tracking-tight text-[var(--text-primary)] font-heading">
                SyncSekai
              </span>
              {/* Oculto por debajo de sm: en 375px la cabecera se salía 9px y recortaba
                  el botón de tema. La versión es informativa, no una función. */}
              <span className="hidden sm:inline-block px-2 py-0.5 rounded-[6px] text-[10px] font-mono font-bold uppercase bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20">
                v3.2
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/docs"
              className="hidden sm:inline-block px-3 py-1.5 rounded-[6px] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              {t('topbar.documentation')}
            </Link>
            <Link
              href="/login"
              className="hidden sm:inline-block whitespace-nowrap px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-[6px] text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors"
            >
              {t('auth.loginButton')}
            </Link>
            <Link
              href="/register"
              className="shrink-0 whitespace-nowrap px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-md shadow-[var(--accent-primary)]/20 transition-colors duration-200 flex items-center gap-1.5 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <span>{t('auth.registerButton')}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </nav>
      </header>

      {/* CONTENIDO PRINCIPAL CENTRADO & EXPANSIVO */}
      <main id="main-content" tabIndex={-1} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-16 sm:space-y-20 relative z-10 outline-none">
        {/* HERO SECTION ORIGINAL CENTRADA */}
        <section className="text-center space-y-6 max-w-4xl mx-auto pt-4 sm:pt-8">
          {/* BADGE DE ESTADO EN VIVO */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-sm backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span>
              {/* El porcentaje de disponibilidad no se mide en ninguna parte:
                  era un "99.9%" fijo dentro de la frase. Se dice el estado, que
                  si se comprueba. */}
              {!stats
                ? t('landing.statusUnknown')
                : stats.status === 'OPERATIONAL'
                ? t('landing.statusOperationalPlain')
                : t('landing.statusDegraded')}
            </span>
          </div>

          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[var(--text-primary)] leading-[1.12] font-heading">
            {t('landing.heroTitleBefore')}{' '}
            <span className="bg-gradient-to-r from-[var(--accent-primary)] via-[#ff7d69] to-[var(--accent-primary)] bg-clip-text text-transparent">
              Plex, Jellyfin &amp; Emby
            </span>{' '}
            {t('landing.heroTitleAfter')}
          </h1>

          <p className="text-sm sm:text-base text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed">
            {t('landing.heroBodyBefore')}{' '}
            <strong className="text-[var(--text-primary)]">AniList</strong>,{' '}
            <strong className="text-[var(--text-primary)]">MyAnimeList</strong> {t('common.and')}{' '}
            <strong className="text-[var(--text-primary)]">Kitsu</strong> {t('landing.heroBodyAfter')}
          </p>

          {/* BOTONES DE LLAMADA A LA ACCIÓN */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-3.5 rounded-[8px] text-xs sm:text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-xl shadow-[var(--accent-primary)]/25 transition-colors duration-200 border border-transparent flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <span>{t('landing.ctaPrimary')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-[8px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] text-[var(--text-primary)] transition-colors duration-200 flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              {t('auth.loginButton')}
            </Link>
          </div>

          {/* PILLS DE CARACTERÍSTICAS */}
          <div className="flex items-center justify-center gap-3 text-xs font-mono text-[var(--text-muted)] pt-2 flex-wrap">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              {t('landing.pillEncryption')}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
              {t('landing.pillTripleSync')}
            </span>
            <span>&bull;</span>
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
              {t('landing.pillGdpr')}
            </span>
          </div>
        </section>

        {/* MÉTRICAS DEL SISTEMA EN VIVO (4 KPI CARDS FLUIDAS) */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-5 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5 transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500/40">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
              <span>{t('landing.kpiAccuracy')}</span>
              <Activity className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-heading">
              {stats?.successRate || t('landing.noData')}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('landing.kpiAccuracyDesc')}</p>
          </div>

          <div className="p-5 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--accent-primary)]/40">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
              <span>{t('landing.kpiLatency')}</span>
              <Cpu className="w-4 h-4 text-[var(--accent-text)]" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-heading">
              {stats?.latency || t('landing.noData')}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('landing.kpiLatencyDesc')}</p>
          </div>

          <div className="p-5 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5 transition-all duration-200 hover:-translate-y-1 hover:border-purple-500/40">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
              <span>{t('landing.statScrobbles')}</span>
              <Layers className="w-4 h-4 text-purple-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-heading">
              {typeof stats?.totalScrobbles === 'number'
                ? stats.totalScrobbles.toLocaleString(locale)
                : t('landing.noData')}
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('landing.kpiScrobblesDesc')}</p>
          </div>

          <div className="p-5 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-1.5 transition-all duration-200 hover:-translate-y-1 hover:border-amber-500/40">
            <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
              <span>{t('landing.kpiSecurity')}</span>
              <ShieldCheck className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-heading">
              AES-256
            </div>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('landing.kpiSecurityDesc')}</p>
          </div>
        </section>

        {/* WIDGET EN VIVO: ESTADO DE NODOS & SERVICIOS EXTERNOS */}
        <section className="p-5 sm:p-6 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-[var(--border-subtle)] pb-3">
            <div className="flex items-center gap-2">
              <Server className="w-4 h-4 text-sky-400" />
              <h2 className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--text-primary)]">
                {t('landing.infraTitle')}
              </h2>
            </div>
            <div className="flex items-center gap-2 text-[11px] font-mono text-[var(--text-muted)]">
              <Clock className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              <span>
                {t('landing.lastSync')} {formatLastScrobble(t, stats?.lastScrobbleAt)}
              </span>
            </div>
          </div>

          {/* Este bloque estaba escrito a mano: cuatro filas fijas, las cuatro
              en verde diciendo ONLINE / LISTENING / HEALTHY pasara lo que
              pasara. Un panel de estado que no lee ningun estado es una foto, y
              en el peor momento -el servicio caido- seguia diciendo que todo va
              bien. Ahora sale de `services`, que el backend deduce de la base y
              de como fueron los ultimos envios a cada tracker. */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
            {SERVICIOS_PORTADA.map(({ clave, etiqueta }) => {
              const estado: string = stats?.services?.[clave] || 'UNKNOWN';
              const color =
                estado === 'ONLINE'
                  ? 'text-emerald-400'
                  : estado === 'DEGRADED'
                  ? 'text-amber-400'
                  : estado === 'OFFLINE'
                  ? 'text-rose-400'
                  : 'text-[var(--text-muted)]';
              const punto =
                estado === 'ONLINE'
                  ? 'bg-emerald-400'
                  : estado === 'DEGRADED'
                  ? 'bg-amber-400'
                  : estado === 'OFFLINE'
                  ? 'bg-rose-400'
                  : 'bg-[var(--text-muted)]';
              return (
                <div
                  key={clave}
                  className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-2"
                >
                  <span className="text-[var(--text-secondary)] truncate">{etiqueta}</span>
                  <span className={`font-bold flex items-center gap-1 shrink-0 ${color}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${punto}`} aria-hidden="true" />
                    {estado}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* CÓMO FUNCIONA EL PIPELINE */}
        <section className="p-6 sm:p-10 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] font-heading">
              {t('landing.pipelineTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
              {t('landing.pipelineSubtitle')}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-[8px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-3 relative overflow-hidden backdrop-blur-md">
              <div className="w-9 h-9 rounded-[6px] bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20 flex items-center justify-center font-mono font-bold text-sm">
                01
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
                {t('landing.step1Title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('landing.step1Desc')}
              </p>
            </div>

            <div className="p-6 rounded-[8px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-3 relative overflow-hidden backdrop-blur-md">
              <div className="w-9 h-9 rounded-[6px] bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center font-mono font-bold text-sm">
                02
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
                {t('landing.step2Title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('landing.step2Desc')}
              </p>
            </div>

            <div className="p-6 rounded-[8px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-3 relative overflow-hidden backdrop-blur-md">
              <div className="w-9 h-9 rounded-[6px] bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center font-mono font-bold text-sm">
                03
              </div>
              <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">
                {t('landing.step3Title')}
              </h3>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {t('landing.step3Desc')}
              </p>
            </div>
          </div>
        </section>
      </main>

      {/* FOOTER PANORÁMICO QUE OCUPA TODO EL ANCHO */}
      <SiteFooter
        enlaces={[
          { href: '/faq', label: t('faq.badge') },
          { href: '/terms', label: t('legal.termsTitle') },
          { href: '/privacy', label: t('landing.footerPrivacy') },
          { href: '/docs', label: t('landing.footerDocs') },
        ]}
        mostrarCookies
        onAbrirCookies={handleOpenCookieSettings}
      />
    </div>
  );
}
