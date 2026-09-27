'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SiteFooter } from '@/components/SiteFooter';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * A paragraph is a string; a list is an array of strings. No additional
 * formatting: legal text is read from top to bottom and any markup added
 * here is one more thing that could diverge from the original document.
 */
export type LegalBlock = string | string[];

export interface LegalSection {
  title: string;
  blocks: LegalBlock[];
}

export interface LegalDocumentData {
  title: string;
  /** Pre-formatted date, exactly as it should appear. */
  updated: string;
  /** Optional notice under title: for example, that the translation is not the binding version. */
  aviso?: string;
  sections: LegalSection[];
}

/** Only http(s) and mailto, and only what looks like a full URL. */
const URL_RE = /(https?:\/\/[^\s<>"')]+|mailto:[^\s<>"')]+)/g;

/**
 * Converts standalone URLs into links. That is the only parsing done on the
 * text: no markdown, no HTML, no emphasis. Uppercase disclaimer sections
 * arrive that way in the document and remain as such.
 */
function withLinks(text: string): React.ReactNode[] {
  return text.split(URL_RE).map((chunk, i) =>
    URL_RE.test(chunk) ? (
      <a
        key={i}
        href={chunk}
        target={chunk.startsWith('mailto:') ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="text-[var(--accent-text)] underline decoration-[var(--accent-text)]/40 underline-offset-2 hover:decoration-[var(--accent-text)] break-all"
      >
        {chunk.replace(/^mailto:/, '')}
      </a>
    ) : (
      <React.Fragment key={i}>{chunk}</React.Fragment>
    ),
  );
}

const sectionId = (n: number) => `section-${n}`;

/**
 * The traditional format for terms and policies: a long document with
 * numbered sections and a fixed index alongside. It intentionally resembles
 * other websites—anyone reading this already knows how to read it—and replaces
 * the previous version, which split text into colored cards and dozens
 * of translation keys of half a sentence each.
 */
export function LegalDocument({
  document,
  other,
}: {
  document: LegalDocumentData;
  /** Sibling document, for the header link. */
  other: { href: string; label: string };
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="w-full px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          {/* At 375 px the back text, link to other document,
              and both toggles don't fit: only the arrow remains, which already says "back". */}
          <Link
            href="/"
            aria-label={t('legal.backHome')}
            className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap max-sm:hidden">{t('legal.backHome')}</span>
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={other.href}
              className="text-xs font-semibold whitespace-nowrap text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {other.label}
            </Link>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
          {/*
            Index. Fixed on desktop, collapsed on mobile: on a narrow screen
            an expanded twenty-entry index takes a full screen before
            the first line of text.
          */}
          <nav aria-label={t('legal.tocLabel')} className="lg:sticky lg:top-24 lg:self-start mb-8 lg:mb-0">
            <details className="lg:hidden glass-card p-4 group">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-xs font-bold font-heading">
                <List className="w-4 h-4" aria-hidden="true" />
                {t('legal.tocLabel')}
              </summary>
              <ol className="mt-3 space-y-1.5">{index(document)}</ol>
            </details>
            <div className="hidden lg:block">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t('legal.tocLabel')}
              </p>
              <ol className="space-y-1 border-l border-[var(--border-subtle)]">{index(document)}</ol>
            </div>
          </nav>

          <article className="min-w-0 max-w-[72ch]">
            <header className="pb-6 mb-8 border-b border-[var(--border-subtle)]">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-heading">
                {document.title}
              </h1>
              <p className="mt-2 text-xs sm:text-sm font-mono text-[var(--text-secondary)]">
                {document.updated}
              </p>
              {document.aviso && (
                <p className="mt-4 p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs leading-relaxed text-[var(--text-secondary)]">
                  {document.aviso}
                </p>
              )}
            </header>

            <div className="space-y-10">
              {document.sections.map((docSection, i) => {
                const n = i + 1;
                return (
                  <section key={n} id={sectionId(n)} className="scroll-mt-24">
                    <h2 className="text-base sm:text-lg font-bold font-heading mb-3 flex gap-3">
                      <span className="font-mono text-[var(--text-muted)] tabular-nums shrink-0">{n}.</span>
                      <span>{docSection.title}</span>
                    </h2>
                    <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {docSection.blocks.map((block, j) =>
                        Array.isArray(block) ? (
                          <ul key={j} className="list-disc pl-6 space-y-1.5">
                            {block.map((item, k) => (
                              <li key={k}>{withLinks(item)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p key={j}>{withLinks(block)}</p>
                        ),
                      )}
                    </div>
                  </section>
                );
              })}
            </div>
          </article>
        </div>
      </main>

      <SiteFooter links={[other, { href: '/login', label: t('auth.loginButton') }]} />
    </div>
  );
}

function index(document: LegalDocumentData) {
  return document.sections.map((section, i) => {
    const n = i + 1;
    return (
      <li key={n}>
        <a
          href={`#${sectionId(n)}`}
          className="block pl-3 -ml-px border-l border-transparent py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-text)] transition-colors"
        >
          <span className="font-mono text-[var(--text-muted)] tabular-nums mr-1.5">{n}.</span>
          {section.title}
        </a>
      </li>
    );
  });
}
