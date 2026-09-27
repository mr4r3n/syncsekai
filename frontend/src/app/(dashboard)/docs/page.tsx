'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { Sidebar } from '@/components/Sidebar';
import { Topbar } from '@/components/Topbar';
import { useSidebar } from '@/components/SidebarProvider';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useModalA11y } from '@/components/useModalA11y';
import { GUIDE, CATEGORIES, type GuideBlock, type GuideSection } from '@/content/guide';
import {
  Search,
  ArrowRight,
  ArrowLeft,
  HelpCircle,
  ChevronRight,
  Maximize2,
  X,
  Copy,
  Check,
  Info,
  AlertTriangle,
} from 'lucide-react';

/** `**bold**` and `[text](/route)`. Nothing more: that is all the markup the guide needs. */
const MARKED = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function inline(text: string): React.ReactNode[] {
  return text.split(MARKED).map((chunk, i) => {
    if (chunk.startsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[var(--text-primary)]">
          {chunk.slice(2, -2)}
        </strong>
      );
    }
    const enlace = chunk.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (enlace) {
      return (
        <Link
          key={i}
          href={enlace[2]}
          className="text-[var(--accent-text)] underline decoration-[var(--accent-text)]/40 underline-offset-2 hover:decoration-[var(--accent-text)]"
        >
          {enlace[1]}
        </Link>
      );
    }
    return <React.Fragment key={i}>{chunk}</React.Fragment>;
  });
}

/**
 * A screenshot excerpt with zoom. A single image, identical across both
 * themes: screenshots use light theme as stated in guide footer.
 */
function Screenshot({ src, alt, pie: caption }: { src: string; alt: string; pie?: string }) {
  const { t } = useI18n();
  const [enlarged, setEnlarged] = useState(false);
  const { dialogProps } = useModalA11y(enlarged, () => setEnlarged(false));

  return (
    <figure className="my-1">
      <button
        type="button"
        onClick={() => setEnlarged(true)}
        title={t('docs.enlarge')}
        className="block w-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)] bg-[#F4F4F5] cursor-zoom-in group text-left"
      >
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
        <span className="sr-only">{t('docs.enlarge')}</span>
      </button>
      {caption && (
        <figcaption className="mt-1.5 text-[11.5px] text-[var(--text-muted)] flex items-center justify-between gap-3">
          <span>{caption}</span>
          <Maximize2 className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
        </figcaption>
      )}

      {enlarged && (
        <div
          onClick={() => setEnlarged(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div {...dialogProps} className="relative max-w-6xl w-full rounded-[var(--radius-lg)] overflow-hidden border border-white/20 bg-[#F4F4F5]">
            <button
              type="button"
              onClick={() => setEnlarged(false)}
              aria-label={t('common.close')}
              className="absolute top-3 right-3 z-10 p-2 rounded-[var(--radius-sm)] bg-black/60 text-white hover:bg-black/80 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" aria-hidden="true" />
            </button>
            <img src={src} alt={alt} className="w-full h-auto max-h-[85vh] object-contain" />
          </div>
        </div>
      )}
    </figure>
  );
}

function Block({ block, onCopy, copied }: { block: GuideBlock; onCopy: (text: string, id: string) => void; copied: string | null }) {
  const { t } = useI18n();
  switch (block.type) {
    case 'p':
      return <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{inline(block.text)}</p>;
    case 'pasos':
      return (
        <ol className="space-y-2.5 pl-1">
          {block.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] text-[var(--text-primary)] font-mono text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="min-w-0">{inline(item)}</span>
            </li>
          ))}
        </ol>
      );
    case 'lista':
      return (
        <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {block.items.map((item, i) => (
            <li key={i}>{inline(item)}</li>
          ))}
        </ul>
      );
    case 'captura':
      return <Screenshot src={block.src} alt={block.alt} pie={block.caption} />;
    case 'codigo':
      return (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">{block.label}</span>
            <button
              type="button"
              onClick={() => onCopy(block.text, block.id)}
              className="btn-secondary text-xs py-1 px-2.5"
            >
              {copied === block.id ? <Check className="w-3.5 h-3.5 text-[var(--status-success)]" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{copied === block.id ? t('common.copied') : t('docs.copy')}</span>
            </button>
          </div>
          <pre className="p-4 bg-[var(--bg-app)] overflow-x-auto text-[11.5px] leading-relaxed font-mono text-[var(--text-primary)]">
            <code>{block.text}</code>
          </pre>
        </div>
      );
    case 'nota': {
      const aviso = block.tone === 'aviso';
      const Icon = aviso ? AlertTriangle : Info;
      return (
        <div
          className={`flex gap-3 p-3.5 rounded-[var(--radius-md)] border text-sm leading-relaxed ${
            aviso
              ? 'bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30 text-[var(--text-primary)]'
              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          <Icon className={`w-4 h-4 shrink-0 mt-0.5 ${aviso ? 'text-[var(--status-warning)]' : 'text-[var(--text-muted)]'}`} aria-hidden="true" />
          <p className="min-w-0">{inline(block.text)}</p>
        </div>
      );
    }
  }
}

export default function DocsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t, locale } = useI18n();

  // /docs is public: session may or may not exist. Starts false so
  // server HTML omits dashboard navigation: anonymous visitor
  // should not see a menu with links kicking them to login.
  const [withSession, setWithSession] = useState(false);
  useEffect(() => {
    let current = true;
    api.auth
      .me()
      .then((me) => {
        if (current && me && (me.id || me.user?.id || me.username)) setWithSession(true);
      })
      .catch(() => {});
    return () => {
      current = false;
    };
  }, []);

  const sections = GUIDE[locale === 'es' ? 'es' : 'en'];
  const [active, setActive] = useState(sections[0].id);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<'ALL' | GuideSection['category']>('ALL');
  const [copiado, setCopied] = useState<string | null>(null);
  const [indexOpen, setIndexOpen] = useState(false);

  useEffect(() => {
    const readUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get('section') || window.location.hash.replace('#', '');
      if (sec && sections.some((s) => s.id === sec)) setActive(sec);
    };
    readUrl();
    // In-app links to /docs#section do not reload the page.
    window.addEventListener('hashchange', readUrl);
    return () => window.removeEventListener('hashchange', readUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    showToast(t('common.copied'), 'success');
    setTimeout(() => setCopied(null), 2000);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sections.filter((s) => {
      if (category !== 'ALL' && s.category !== category) return false;
      if (!q) return true;
      const text = [s.title, s.summary, ...s.blocks.map((b) => ('text' in b ? b.text : 'items' in b ? b.items.join(' ') : ''))].join(' ').toLowerCase();
      return text.includes(q);
    });
  }, [sections, category, search]);

  const index = sections.findIndex((s) => s.id === active);
  const section = sections[index] || sections[0];
  const anterior = index > 0 ? sections[index - 1] : null;
  const next = index < sections.length - 1 ? sections[index + 1] : null;
  const categoryName = (id: GuideSection['category']) => CATEGORIES.find((c) => c.id === id)?.[locale === 'es' ? 'es' : 'en'] ?? id;

  const irA = (id: string) => {
    setActive(id);
    setIndexOpen(false);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const sectionList = (
    <ol className="space-y-1.5 xl:max-h-[calc(100vh-240px)] xl:overflow-y-auto xl:pr-1 scrollbar-thin">
      {filtered.map((s) => {
        const Icon = s.icon;
        const isActive = active === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => irA(s.id)}
              aria-current={isActive ? 'page' : undefined}
              className={`w-full text-left p-3 rounded-[var(--radius-md)] transition-all flex items-center justify-between cursor-pointer border select-none ${
                isActive
                  ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)] font-bold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${isActive ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-text)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                  <Icon className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight">{s.title}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)] truncate mt-0.5 font-normal">{categoryName(s.category)}</div>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${isActive ? 'text-[var(--accent-text)]' : 'opacity-40'}`} aria-hidden="true" />
            </button>
          </li>
        );
      })}
      {filtered.length === 0 && (
        <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">{t('docs.noResults')}</li>
      )}
    </ol>
  );

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        withSession ? (isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]') : ''
      } pl-0 flex flex-col`}
    >
      {withSession ? (
        <>
          <Sidebar />
          <Topbar rootLabel={t('topbar.support')} currentLabel={t('docs.title')} />
        </>
      ) : (
        <header className="sticky top-0 z-50 w-full border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
          <div className="w-full px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
            <Link
              href="/"
              aria-label={t('legal.backHome')}
              className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span className="max-sm:hidden whitespace-nowrap">{t('legal.backHome')}</span>
            </Link>
            <div className="flex items-center gap-3">
              <Link
                href="/faq"
                className="text-xs font-semibold whitespace-nowrap text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
              >
                {t('faq.badge')}
              </Link>
              <LanguageToggle />
              <ThemeToggle />
            </div>
          </div>
        </header>
      )}

      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-xs">
        <div className="w-full flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-0.5">
            {(['ALL', ...CATEGORIES.map((c) => c.id)] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`filter-tab whitespace-nowrap ${category === cat ? 'filter-tab-active' : ''}`}
              >
                {cat === 'ALL' ? t('docs.allTopics') : categoryName(cat)}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72 relative shrink-0">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              placeholder={t('docs.searchPlaceholder')}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="glass-input pl-8.5 text-xs"
            />
          </div>
        </div>
      </div>

      <main className="flex-1 w-full px-4 sm:px-6 md:px-8 py-6">
        <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Table of Contents */}
          <nav aria-label={t('docs.title')} className="xl:col-span-4 xl:sticky xl:top-36 space-y-3">
            {/* On tablet and mobile table of contents sits above text, and open
                spans eleven entries—a full screen—before line one.
                Collapsed shows current section; opens to change. */}
            <details className="xl:hidden glass-card p-4 group" onToggle={(e) => setIndexOpen(e.currentTarget.open)} open={indexOpen}>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-1">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    {t('docs.sections', { n: filtered.length })}
                  </span>
                  <span className="block text-sm font-semibold truncate">{section.title}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">{sectionList}</div>
            </details>
            <div className="hidden xl:block glass-card p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                  {t('docs.sections', { n: filtered.length })}
                </span>
              </div>
              {sectionList}
            </div>

            <div className="glass-card p-4 space-y-2">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                <HelpCircle className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                <span>{t('docs.needMoreHelp')}</span>
              </div>
              <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('docs.needMoreHelpBody')}</p>
              <p className="text-[11px] text-[var(--text-muted)] leading-relaxed pt-1 border-t border-[var(--border-subtle)]">{t('docs.screenshotNote')}</p>
            </div>
          </nav>

          {/* Active section */}
          <article className="xl:col-span-8 space-y-6">
            <div className="glass-card p-6 sm:p-8 space-y-7">
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/25 text-[var(--accent-text)] flex items-center justify-center shrink-0">
                    <section.icon className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <span className="badge-pill">{categoryName(section.category)}</span>
                    <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">{section.title}</h1>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{section.summary}</p>
                  </div>
                </div>
                {section.screen && (
                  <Link href={section.screen.href} className="btn-primary text-xs shrink-0 self-start sm:self-center">
                    <span>{section.screen.label}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
              </header>

              <div className="space-y-5 max-w-[78ch]">
                {section.blocks.map((b, i) => (
                  <Block key={i} block={b} onCopy={copy} copied={copiado} />
                ))}
              </div>

              <footer className="flex items-center justify-between gap-4 pt-6 border-t border-[var(--border-subtle)]">
                {anterior ? (
                  <button type="button" onClick={() => irA(anterior.id)} className="btn-secondary text-xs">
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{anterior.title}</span>
                    <span className="sm:hidden">{t('common.previous')}</span>
                  </button>
                ) : (
                  <div />
                )}
                {next ? (
                  <button type="button" onClick={() => irA(next.id)} className="btn-secondary text-xs">
                    <span className="hidden sm:inline">{next.title}</span>
                    <span className="sm:hidden">{t('common.next')}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                ) : (
                  <div />
                )}
              </footer>
            </div>
          </article>
        </div>
      </main>
    </div>
  );
}
