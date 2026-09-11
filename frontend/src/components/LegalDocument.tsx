'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, List } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LanguageToggle } from '@/components/LanguageToggle';
import { SiteFooter } from '@/components/SiteFooter';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Un párrafo es una cadena; una lista es un array de cadenas. No hay más
 * formato: un texto legal se lee de arriba abajo y cualquier marcado que se
 * añada aquí es una cosa más que puede desviarse del documento original.
 */
export type BloqueLegal = string | string[];

export interface SeccionLegal {
  titulo: string;
  bloques: BloqueLegal[];
}

export interface DocumentoLegal {
  titulo: string;
  /** Fecha ya formateada, tal como debe verse. */
  actualizado: string;
  /** Aviso opcional bajo el título: por ejemplo, que la traducción no es la versión vinculante. */
  aviso?: string;
  secciones: SeccionLegal[];
}

/** Sólo http(s) y mailto, y sólo lo que parece una URL entera. */
const URL_RE = /(https?:\/\/[^\s<>"')]+|mailto:[^\s<>"')]+)/g;

/**
 * Convierte las URL sueltas en enlaces. Es lo único que se interpreta del
 * texto: sin markdown, sin HTML, sin énfasis. Los apartados en mayúsculas de
 * los descargos vienen así en el documento y así se quedan.
 */
function conEnlaces(texto: string): React.ReactNode[] {
  return texto.split(URL_RE).map((trozo, i) =>
    URL_RE.test(trozo) ? (
      <a
        key={i}
        href={trozo}
        target={trozo.startsWith('mailto:') ? undefined : '_blank'}
        rel="noopener noreferrer"
        className="text-[var(--accent-text)] underline decoration-[var(--accent-text)]/40 underline-offset-2 hover:decoration-[var(--accent-text)] break-all"
      >
        {trozo.replace(/^mailto:/, '')}
      </a>
    ) : (
      <React.Fragment key={i}>{trozo}</React.Fragment>
    ),
  );
}

const idDeSeccion = (n: number) => `seccion-${n}`;

/**
 * El formato de siempre para condiciones y políticas: un documento largo con
 * apartados numerados y un índice fijo al lado. Se parece al de todos los demás
 * sitios a propósito —quien llega a leer esto ya sabe cómo se lee— y sustituye
 * a la versión anterior, que partía el texto en tarjetas de colores y en
 * decenas de claves de traducción de media frase cada una.
 */
export function LegalDocument({
  documento,
  otro,
}: {
  documento: DocumentoLegal;
  /** El documento hermano, para el enlace de la cabecera. */
  otro: { href: string; label: string };
}) {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col font-sans">
      <header className="sticky top-0 z-50 w-full border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="w-full px-4 sm:px-6 md:px-8 h-16 flex items-center justify-between">
          {/* A 375 px no caben el texto de volver, el enlace al otro documento
              y los dos conmutadores: se queda la flecha, que ya dice "volver". */}
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
              href={otro.href}
              className="text-xs font-semibold whitespace-nowrap text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {otro.label}
            </Link>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-10 sm:py-14">
        <div className="lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12">
          {/*
            Índice. Fijo en escritorio, plegado en móvil: en una pantalla estrecha
            un índice de veinte entradas abierto es una pantalla entera antes de
            la primera línea del texto.
          */}
          <nav aria-label={t('legal.tocLabel')} className="lg:sticky lg:top-24 lg:self-start mb-8 lg:mb-0">
            <details className="lg:hidden glass-card p-4 group">
              <summary className="cursor-pointer list-none flex items-center gap-2 text-xs font-bold font-heading">
                <List className="w-4 h-4" aria-hidden="true" />
                {t('legal.tocLabel')}
              </summary>
              <ol className="mt-3 space-y-1.5">{indice(documento)}</ol>
            </details>
            <div className="hidden lg:block">
              <p className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t('legal.tocLabel')}
              </p>
              <ol className="space-y-1 border-l border-[var(--border-subtle)]">{indice(documento)}</ol>
            </div>
          </nav>

          <article className="min-w-0 max-w-[72ch]">
            <header className="pb-6 mb-8 border-b border-[var(--border-subtle)]">
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight font-heading">
                {documento.titulo}
              </h1>
              <p className="mt-2 text-xs sm:text-sm font-mono text-[var(--text-secondary)]">
                {documento.actualizado}
              </p>
              {documento.aviso && (
                <p className="mt-4 p-3.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs leading-relaxed text-[var(--text-secondary)]">
                  {documento.aviso}
                </p>
              )}
            </header>

            <div className="space-y-10">
              {documento.secciones.map((seccion, i) => {
                const n = i + 1;
                return (
                  <section key={n} id={idDeSeccion(n)} className="scroll-mt-24">
                    <h2 className="text-base sm:text-lg font-bold font-heading mb-3 flex gap-3">
                      <span className="font-mono text-[var(--text-muted)] tabular-nums shrink-0">{n}.</span>
                      <span>{seccion.titulo}</span>
                    </h2>
                    <div className="space-y-3 text-sm leading-relaxed text-[var(--text-secondary)]">
                      {seccion.bloques.map((bloque, j) =>
                        Array.isArray(bloque) ? (
                          <ul key={j} className="list-disc pl-6 space-y-1.5">
                            {bloque.map((item, k) => (
                              <li key={k}>{conEnlaces(item)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p key={j}>{conEnlaces(bloque)}</p>
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

      <SiteFooter enlaces={[otro, { href: '/login', label: t('auth.loginButton') }]} />
    </div>
  );
}

function indice(documento: DocumentoLegal) {
  return documento.secciones.map((seccion, i) => {
    const n = i + 1;
    return (
      <li key={n}>
        <a
          href={`#${idDeSeccion(n)}`}
          className="block pl-3 -ml-px border-l border-transparent py-0.5 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--accent-text)] transition-colors"
        >
          <span className="font-mono text-[var(--text-muted)] tabular-nums mr-1.5">{n}.</span>
          {seccion.titulo}
        </a>
      </li>
    );
  });
}
