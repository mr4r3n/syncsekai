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
  Globe,
  Sparkles,
  BellRing,
  Languages,
  Wrench,
  BookOpen,
  HelpCircle,
} from 'lucide-react';
import { SiteFooter } from '@/components/SiteFooter';
import { CommunityLeaderboard } from '@/components/CommunityLeaderboard';
import { LandingGallery, BrowserFrame, useDocumentTheme } from '@/components/LandingGallery';

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

type Translator = (key: string, vars?: Record<string, string | number>) => string;

function formatLastScrobble(t: Translator, dateStr?: string | null): string {
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

/** Status panel services, in rendering order. */
const HOME_SERVICES = [
  { key: 'backend', label: 'SyncSekai API' },
  { key: 'database', label: 'PostgreSQL' },
  { key: 'anilist', label: 'AniList' },
  { key: 'mal', label: 'MyAnimeList' },
] as const;

export default function LandingPage() {
  const router = useRouter();
  const { t, locale } = useI18n();
  const [stats, setStats] = useState<PublicStats | null>(null);
  const theme = useDocumentTheme();

  useEffect(() => {
    // Session cookie is httpOnly, so document.cookie never sees it: we must
    // query backend. A 401 from anonymous visitor is the expected response.
    api.auth
      .me()
      .then((me) => {
        if (me && (me.id || me.user?.id || me.username)) {
          router.replace('/connections');
        }
      })
      .catch(() => {});

    api.setup
      .getPublicStats()
      .then((data) => {
        setStats(data);
      })
      .catch(() => {
        /*
         * If API does not respond, nothing is displayed.
         *
         * Previously contained an entirely fabricated object—1420 scrobbles, 99.8%
         * success, 4ms—rendered identically to real data. Meaning: homepage
         * displayed peak figures precisely while service was down.
         * Now cards display a dash.
         */
        setStats(null);
      });
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

      {/* FULL-WIDTH FLUID TEMPERED GLASS TOPBAR HEADER */}
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
              {/* Hidden below sm: at 375px header overflowed by 9px and clipped
                  theme toggle. Version is informational, not a function. */}
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
      <main id="main-content" tabIndex={-1} className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16 space-y-12 sm:space-y-14 relative z-10 outline-none">
        {/* HERO SECTION ORIGINAL CENTRADA */}
        <section className="text-center space-y-6 max-w-4xl mx-auto pt-4 sm:pt-8">
          {/* BADGE DE ESTADO EN VIVO */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-mono font-medium border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 shadow-sm backdrop-blur-md">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" aria-hidden="true" />
            <span>
              {/* Availability percentage is not measured anywhere:
                  it was a fixed "99.9%" in the sentence. Stating status instead,
                  which is actually verified. */}
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

          {/* CALL TO ACTION BUTTONS */}
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Link
              href="/demo"
              className="w-full sm:w-auto px-6 py-3.5 rounded-[8px] text-xs sm:text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-xl shadow-[var(--accent-primary)]/25 transition-colors duration-200 border border-transparent flex items-center justify-center gap-2 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              <span>{t('landing.ctaDemo')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3.5 rounded-[8px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] text-[var(--text-primary)] transition-colors duration-200 flex items-center justify-center hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98]"
            >
              {t('auth.loginButton')}
            </Link>
          </div>

          {/* FEATURE PILLS */}
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

          {/* Product preview: the catalogue, fading into the page */}
          <div className="pt-6 max-h-[440px] overflow-hidden [mask-image:linear-gradient(to_bottom,black_55%,transparent)]" aria-hidden="true">
            <BrowserFrame path="/catalog">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/landing/catalog-${theme}-${locale === 'es' ? 'es' : 'en'}.webp`}
                alt=""
                width={1400}
                height={805}
                className="w-full h-auto block"
              />
            </BrowserFrame>
          </div>
        </section>

        {/* LIVE STATUS: the four figures and the services, in one band */}
        <section className="rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-[var(--glass-shadow)] overflow-hidden">
          <div className="grid grid-cols-2 lg:grid-cols-4">
            {[
              { label: t('landing.kpiAccuracy'), icon: <Activity className="w-4 h-4 text-emerald-400" />, value: stats?.successRate || t('landing.noData'), desc: t('landing.kpiAccuracyDesc'), edge: 'border-r border-b lg:border-b-0' },
              { label: t('landing.kpiLatency'), icon: <Cpu className="w-4 h-4 text-[var(--accent-text)]" />, value: stats?.latency || t('landing.noData'), desc: t('landing.kpiLatencyDesc'), edge: 'border-b lg:border-b-0 lg:border-r' },
              {
                label: t('landing.statScrobbles'),
                icon: <Layers className="w-4 h-4 text-purple-400" />,
                value: typeof stats?.totalScrobbles === 'number' ? stats.totalScrobbles.toLocaleString(locale) : t('landing.noData'),
                desc: t('landing.kpiScrobblesDesc'),
                edge: 'border-r',
              },
              { label: t('landing.kpiSecurity'), icon: <ShieldCheck className="w-4 h-4 text-amber-400" />, value: 'AES-256', desc: t('landing.kpiSecurityDesc'), edge: '' },
            ].map(({ label, icon, value, desc, edge }) => (
              <div key={label} className={`p-5 sm:p-6 space-y-1.5 border-[var(--border-subtle)] ${edge}`}>
                <div className="flex items-center justify-between text-xs font-mono text-[var(--text-muted)]">
                  <span>{label}</span>
                  {icon}
                </div>
                <div className="text-2xl sm:text-3xl font-extrabold text-[var(--text-primary)] font-heading">{value}</div>
                <p className="text-[11px] text-[var(--text-secondary)]">{desc}</p>
              </div>
            ))}
          </div>

          {/* Services, driven by `services` from the backend (see HOME_SERVICES) */}
          <div className="px-5 sm:px-6 py-3.5 border-t border-[var(--border-subtle)] flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-6 text-xs font-mono">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 flex-1" aria-label={t('landing.infraTitle')}>
              <Server className="w-3.5 h-3.5 text-sky-400" aria-hidden="true" />
              {HOME_SERVICES.map(({ key, label }) => {
                const status: string = stats?.services?.[key] || 'UNKNOWN';
                const color =
                  status === 'ONLINE'
                    ? 'text-emerald-400'
                    : status === 'DEGRADED'
                    ? 'text-amber-400'
                    : status === 'OFFLINE'
                    ? 'text-rose-400'
                    : 'text-[var(--text-muted)]';
                const dot =
                  status === 'ONLINE'
                    ? 'bg-emerald-400'
                    : status === 'DEGRADED'
                    ? 'bg-amber-400'
                    : status === 'OFFLINE'
                    ? 'bg-rose-400'
                    : 'bg-[var(--text-muted)]';
                return (
                  <div
                    key={key}
                    className="flex items-center gap-2"
                  >
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${dot}`} aria-hidden="true" />
                    <span className="text-[var(--text-secondary)]">{label}</span>
                    {status === 'ONLINE' ? (
                      <span className="sr-only">{status}</span>
                    ) : (
                      <span className={`font-bold text-[10px] ${color}`}>{status}</span>
                    )}
                  </div>
                );
              })}
            </div>
            <span className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] shrink-0">
              <Clock className="w-3 h-3 text-emerald-400" aria-hidden="true" />
              {t('landing.lastSync')} {formatLastScrobble(t, stats?.lastScrobbleAt)}
            </span>
          </div>
        </section>

        <div aria-hidden="true" className="landing-divider" />

        {/* HOW IT WORKS: three steps on a line */}
        <section className="space-y-10">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent-text)]">{t('landing.eyebrowHow')}</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] font-heading">
              {t('landing.pipelineTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('landing.pipelineSubtitle')}</p>
          </div>

          <ol className="relative grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-8">
            <li aria-hidden="true" className="hidden md:block absolute top-5 left-[16.67%] right-[16.67%] h-px bg-[var(--border-strong)]" />
            {[
              { n: 1, tone: 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border-[var(--accent-primary)]/30' },
              { n: 2, tone: 'bg-sky-500/10 text-sky-400 border-sky-500/30' },
              { n: 3, tone: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
            ].map(({ n, tone }) => (
              <li key={n} className="relative text-center space-y-3">
                <div className="relative mx-auto w-10 h-10 rounded-full bg-[var(--bg-app)]">
                  <div className={`w-full h-full rounded-full border flex items-center justify-center font-mono font-bold text-sm ${tone}`}>0{n}</div>
                </div>
                <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">{t(`landing.step${n}Title`)}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed max-w-xs mx-auto">{t(`landing.step${n}Desc`)}</p>
              </li>
            ))}
          </ol>
        </section>

        <div aria-hidden="true" className="landing-divider" />

        {/* CENTRAL MESSAGE: the user only watches; SyncSekai keeps the lists up to date */}
        <section className="grid grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-8 lg:gap-14 items-center">
          <div className="space-y-4 text-center lg:text-left">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent-text)]">{t('landing.eyebrowIdea')}</p>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-tight text-[var(--text-primary)] font-heading leading-tight">
              {t('landing.messageTitle')}
            </h2>
            <p className="text-sm sm:text-base text-[var(--text-secondary)] leading-relaxed">{t('landing.messageBody')}</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-7">
            {[
              { icon: Globe, n: 1 },
              { icon: Server, n: 2 },
              { icon: Sparkles, n: 3 },
              { icon: BellRing, n: 4 },
            ].map(({ icon: Icon, n }) => (
              <div key={n} className="space-y-2">
                <Icon className="w-5 h-5 text-[var(--accent-text)]" aria-hidden="true" />
                <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t(`landing.point${n}Title`)}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t(`landing.point${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        <div aria-hidden="true" className="landing-divider" />

        <LandingGallery />

        <div aria-hidden="true" className="landing-divider" />

        {/* THE TRICKY CASES, including what does not resolve on its own */}
        <section className="space-y-8">
          <div className="text-center space-y-2 max-w-xl mx-auto">
            <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent-text)]">{t('landing.eyebrowHard')}</p>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] font-heading">
              {t('landing.hardTitle')}
            </h2>
            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('landing.hardSubtitle')}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: Layers, n: 1 },
              { icon: Languages, n: 2 },
              { icon: Wrench, n: 3 },
            ].map(({ icon: Icon, n }) => (
              <div key={n} className="p-6 rounded-[8px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-3 backdrop-blur-md">
                <Icon className="w-5 h-5 text-[var(--accent-text)]" aria-hidden="true" />
                <h3 className="text-base font-bold text-[var(--text-primary)] font-heading">{t(`landing.hard${n}Title`)}</h3>
                <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t(`landing.hard${n}Desc`)}</p>
              </div>
            ))}
          </div>
        </section>

        <div aria-hidden="true" className="landing-divider" />

        {/* GUIDE AND FAQ */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-x-8 border-t border-[var(--border-subtle)]">
          {[
            { href: '/docs', icon: BookOpen, key: 'guideCard' },
            { href: '/faq', icon: HelpCircle, key: 'faqCard' },
          ].map(({ href, icon: Icon, key }) => (
            <Link
              key={href}
              href={href}
              className="group py-6 flex items-start gap-4 border-b md:border-b-0 border-[var(--border-subtle)] last:border-b-0"
            >
              <Icon className="w-6 h-6 text-[var(--accent-text)] shrink-0 mt-0.5" aria-hidden="true" />
              <span className="space-y-1.5 flex-1">
                <span className="flex items-center gap-2 text-base font-bold text-[var(--text-primary)] font-heading">
                  {t(`landing.${key}Title`)}
                  <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
                <span className="block text-xs text-[var(--text-secondary)] leading-relaxed">{t(`landing.${key}Desc`)}</span>
              </span>
            </Link>
          ))}
        </section>

        <CommunityLeaderboard />
      </main>

      {/* FULL-WIDTH PANORAMIC FOOTER */}
      <SiteFooter
        links={[
          { href: '/faq', label: t('faq.badge') },
          { href: '/terms', label: t('legal.termsTitle') },
          { href: '/privacy', label: t('landing.footerPrivacy') },
          { href: '/docs', label: t('landing.footerDocs') },
        ]}
        showCookies
        onOpenCookies={handleOpenCookieSettings}
      />
    </div>
  );
}
