'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, HelpCircle, BookOpen } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/i18n/I18nProvider';
import { SiteFooter } from '@/components/SiteFooter';

// Encabezados y párrafos planos a propósito, sin acordeón: el contenido queda
// visible para lectores de pantalla y para el rastreador sin depender de JS.
const PREGUNTAS = Array.from({ length: 14 }, (_, i) => String(i + 1));

export default function FaqPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col justify-between selection:bg-[var(--accent-primary)]/20 selection:text-[var(--accent-text)] transition-colors duration-300 font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="w-full px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            <span>{t('legal.backHome')}</span>
          </Link>

          <div className="flex items-center gap-3">
            <Link
              href="/docs"
              className="text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {t('topbar.documentation')}
            </Link>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        tabIndex={-1}
        className="w-full max-w-4xl mx-auto px-4 sm:px-6 py-10 sm:py-14 space-y-10 outline-none"
      >
        <div className="space-y-3 text-center sm:text-left border-b border-[var(--border-subtle)] pb-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] text-xs font-mono font-bold uppercase bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20">
            <HelpCircle className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('faq.badge')}</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-heading">
            {t('faq.title')}
          </h1>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed max-w-2xl">
            {t('faq.subtitle')}
          </p>
        </div>

        <div className="space-y-4">
          {PREGUNTAS.map((n) => (
            <section
              key={n}
              className="p-5 sm:p-6 rounded-[8px] border border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-2"
            >
              <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">
                {t(`faq.q${n}`)}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {t(`faq.a${n}`)}
              </p>
            </section>
          ))}
        </div>

        <section className="p-6 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] space-y-3">
          <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">
            {t('faq.stillStuck')}
          </h2>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {t('faq.stillStuckBody')}
          </p>
          <Link
            href="/docs"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[6px] text-xs font-bold bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('faq.goToDocs')}</span>
          </Link>
        </section>
      </main>

      <SiteFooter
        enlaces={[
          { href: '/terms', label: t('legal.termsTitle') },
          { href: '/privacy', label: t('legal.privacyTitle') },
          { href: '/docs', label: t('landing.footerDocs') },
        ]}
      />
    </div>
  );
}
