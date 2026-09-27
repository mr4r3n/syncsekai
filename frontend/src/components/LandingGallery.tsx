'use client';

import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Eye, Link2, LayoutGrid, Tv, History, GitMerge } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Real screens of the app on the landing page, taken from /demo by
 * scripts/capture-landing.mjs: one set per theme and language, so the picture
 * matches the page around it (a dark screenshot on a light page looks like a patch).
 *
 * All five images sit on top of each other and only the active one is opaque:
 * switching cross-fades (the old one fades out while the new one fades in).
 */
const SCREENS = [
  { id: 'connections', path: '/connections', icon: Link2 },
  { id: 'catalog', path: '/catalog', icon: LayoutGrid },
  { id: 'detail', path: '/catalog', icon: Tv },
  { id: 'history', path: '/history', icon: History },
  { id: 'mappings', path: '/mappings', icon: GitMerge },
] as const;

type ScreenId = (typeof SCREENS)[number]['id'];

/** The site's theme, as the layout sets it on <html> before the first paint. */
export function useDocumentTheme(): 'dark' | 'light' {
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  useEffect(() => {
    const read = () => setTheme(document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark');
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => observer.disconnect();
  }, []);
  return theme;
}

/** A browser window around a screenshot, with the page's address in the bar. */
export function BrowserFrame({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[10px] overflow-hidden border border-[var(--glass-border)] bg-[var(--bg-surface)] shadow-[var(--glass-shadow)]">
      <div className="flex items-center gap-3 px-3 py-2 border-b border-[var(--glass-border)] bg-[var(--bg-surface-elevated)]">
        <span className="flex gap-1.5" aria-hidden="true">
          <span className="w-2.5 h-2.5 rounded-full bg-[#ff5f57]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#febc2e]" />
          <span className="w-2.5 h-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex-1 min-w-0 truncate text-center text-[11px] font-mono text-[var(--text-muted)] px-3 py-0.5 rounded-[6px] bg-[var(--bg-app)]">
          syncsekai.com{path}
        </span>
        <span className="w-10 hidden sm:block" aria-hidden="true" />
      </div>
      {children}
    </div>
  );
}
const keyOf = (id: ScreenId) => `landing.shot${id[0].toUpperCase()}${id.slice(1)}`;

export function LandingGallery() {
  const { t, locale } = useI18n();
  const [active, setActive] = useState<ScreenId>(SCREENS[0].id);
  const theme = useDocumentTheme();
  const lang = locale === 'es' ? 'es' : 'en';

  const current = SCREENS.find((s) => s.id === active)!;

  // One highlight that slides to the active screen instead of jumping between buttons.
  const listRef = useRef<HTMLDivElement>(null);
  const [marker, setMarker] = useState<{ top: number; left: number; width: number; height: number } | null>(null);
  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const place = () => {
      const button = list.querySelector<HTMLElement>(`[data-screen="${active}"]`);
      if (button) setMarker({ top: button.offsetTop, left: button.offsetLeft, width: button.offsetWidth, height: button.offsetHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(list);
    return () => observer.disconnect();
  }, [active]);

  const demoButton = (
    <div className="flex flex-col items-center lg:items-start gap-2">
      <Link
        href="/demo"
        className="px-5 py-3 rounded-[8px] text-xs sm:text-sm font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] shadow-lg shadow-[var(--accent-primary)]/20 transition-colors flex items-center gap-2"
      >
        <Eye className="w-4 h-4" aria-hidden="true" />
        {t('landing.ctaDemo')}
      </Link>
      <p className="text-[11px] text-[var(--text-muted)] text-center lg:text-left">{t('landing.demoHint')}</p>
    </div>
  );

  return (
    <section className="space-y-8">
      <div className="text-center space-y-2 max-w-xl mx-auto">
        <p className="text-[11px] font-mono font-bold uppercase tracking-[0.2em] text-[var(--accent-text)]">{t('landing.eyebrowDemo')}</p>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[var(--text-primary)] font-heading">
          {t('landing.galleryTitle')}
        </h2>
        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">{t('landing.gallerySubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-6 lg:gap-8 items-center">
        {/* Screen picker: pills on small screens, a list of names on wide ones */}
        <div className="space-y-6">
          <div
            ref={listRef}
            className="relative flex lg:flex-col items-stretch justify-center gap-1.5 lg:gap-1 flex-wrap lg:pl-4"
            role="tablist"
            aria-label={t('landing.galleryTitle')}
          >
            {/* Rail on wide screens: a thin line with a coral segment on the active screen */}
            <span aria-hidden="true" className="hidden lg:block absolute left-0 top-0 bottom-0 w-px bg-[var(--border-subtle)]" />
            {marker && (
              <>
                <span
                  aria-hidden="true"
                  className="hidden lg:block absolute left-[-1px] w-[3px] rounded-full bg-[var(--accent-primary)] transition-all duration-300 ease-out"
                  style={{ top: marker.top + 6, height: marker.height - 12 }}
                />
                <span
                  aria-hidden="true"
                  className="absolute rounded-full lg:rounded-[8px] bg-[var(--accent-primary)] lg:bg-[var(--bg-surface-elevated)] transition-all duration-300 ease-out"
                  style={marker}
                />
              </>
            )}
            {SCREENS.map(({ id, icon: Icon }) => (
              <button
                key={id}
                data-screen={id}
                type="button"
                role="tab"
                aria-selected={active === id}
                onClick={() => setActive(id)}
                className={`relative z-10 flex items-center gap-2.5 text-left cursor-pointer rounded-full lg:rounded-[8px] px-3.5 py-1.5 lg:px-3.5 lg:py-2.5 text-xs lg:text-sm font-semibold transition-colors duration-300 ${
                  active === id
                    ? 'text-white lg:text-[var(--text-primary)]'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Icon
                  className={`hidden lg:block w-4 h-4 transition-colors duration-300 ${active === id ? 'text-[var(--accent-text)]' : 'text-[var(--text-muted)]'}`}
                  aria-hidden="true"
                />
                {t(`${keyOf(id)}Tab`)}
              </button>
            ))}
          </div>
          <div className="hidden lg:block">{demoButton}</div>
        </div>

        <figure className="space-y-3 min-w-0">
          <BrowserFrame path={current.path}>
            <div className="relative aspect-[1400/805]">
              {SCREENS.map(({ id }) => (
                // No next/image: static files, already webp at their final size.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={`${id}-${theme}-${lang}`}
                  src={`/landing/${id}-${theme}-${lang}.webp`}
                  alt={active === id ? t(`${keyOf(id)}Alt`) : ''}
                  aria-hidden={active !== id}
                  width={1400}
                  height={805}
                  loading={id === SCREENS[0].id ? 'eager' : 'lazy'}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-500 ease-in-out ${
                    active === id ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              ))}
            </div>
          </BrowserFrame>
          <figcaption key={active} className="text-center text-xs sm:text-sm text-[var(--text-secondary)] max-w-2xl mx-auto leading-relaxed min-h-[3em] animate-[landing-fade-in_0.4s_ease-out]">
            {t(`${keyOf(active)}Desc`)}
          </figcaption>
        </figure>
      </div>

      <div className="lg:hidden">{demoButton}</div>
    </section>
  );
}
