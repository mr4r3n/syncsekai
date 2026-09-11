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
import { GUIA, CATEGORIAS, type BloqueGuia, type SeccionGuia } from '@/content/guia';
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

/** `**negrita**` y `[texto](/ruta)`. Nada más: es todo el marcado que la guía necesita. */
const MARCADO = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)]+\))/g;

function enLinea(texto: string): React.ReactNode[] {
  return texto.split(MARCADO).map((trozo, i) => {
    if (trozo.startsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[var(--text-primary)]">
          {trozo.slice(2, -2)}
        </strong>
      );
    }
    const enlace = trozo.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
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
    return <React.Fragment key={i}>{trozo}</React.Fragment>;
  });
}

/**
 * Un recorte de pantalla con ampliación. Una sola imagen, la misma en los dos
 * temas: las capturas son del tema claro y así se dice en el pie de la guía.
 */
function Captura({ src, alt, pie }: { src: string; alt: string; pie?: string }) {
  const { t } = useI18n();
  const [ampliada, setAmpliada] = useState(false);
  const { dialogProps } = useModalA11y(ampliada, () => setAmpliada(false));

  return (
    <figure className="my-1">
      <button
        type="button"
        onClick={() => setAmpliada(true)}
        title={t('docs.enlarge')}
        className="block w-full rounded-[var(--radius-md)] overflow-hidden border border-[var(--border-subtle)] bg-[#F4F4F5] cursor-zoom-in group text-left"
      >
        <img src={src} alt={alt} loading="lazy" className="w-full h-auto block" />
        <span className="sr-only">{t('docs.enlarge')}</span>
      </button>
      {pie && (
        <figcaption className="mt-1.5 text-[11.5px] text-[var(--text-muted)] flex items-center justify-between gap-3">
          <span>{pie}</span>
          <Maximize2 className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
        </figcaption>
      )}

      {ampliada && (
        <div
          onClick={() => setAmpliada(false)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 sm:p-8 animate-in fade-in duration-200 cursor-zoom-out"
        >
          <div {...dialogProps} className="relative max-w-6xl w-full rounded-[var(--radius-lg)] overflow-hidden border border-white/20 bg-[#F4F4F5]">
            <button
              type="button"
              onClick={() => setAmpliada(false)}
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

function Bloque({ bloque, alCopiar, copiado }: { bloque: BloqueGuia; alCopiar: (texto: string, id: string) => void; copiado: string | null }) {
  const { t } = useI18n();
  switch (bloque.tipo) {
    case 'p':
      return <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{enLinea(bloque.texto)}</p>;
    case 'pasos':
      return (
        <ol className="space-y-2.5 pl-1">
          {bloque.items.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm leading-relaxed text-[var(--text-secondary)]">
              <span className="shrink-0 w-6 h-6 rounded-full bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] text-[var(--text-primary)] font-mono text-[11px] font-bold flex items-center justify-center mt-0.5">
                {i + 1}
              </span>
              <span className="min-w-0">{enLinea(item)}</span>
            </li>
          ))}
        </ol>
      );
    case 'lista':
      return (
        <ul className="list-disc pl-6 space-y-2 text-sm leading-relaxed text-[var(--text-secondary)]">
          {bloque.items.map((item, i) => (
            <li key={i}>{enLinea(item)}</li>
          ))}
        </ul>
      );
    case 'captura':
      return <Captura src={bloque.src} alt={bloque.alt} pie={bloque.pie} />;
    case 'codigo':
      return (
        <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-3.5 py-2 bg-[var(--bg-surface)] border-b border-[var(--border-subtle)]">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)]">{bloque.etiqueta}</span>
            <button
              type="button"
              onClick={() => alCopiar(bloque.texto, bloque.id)}
              className="btn-secondary text-xs py-1 px-2.5"
            >
              {copiado === bloque.id ? <Check className="w-3.5 h-3.5 text-[var(--status-success)]" aria-hidden="true" /> : <Copy className="w-3.5 h-3.5" aria-hidden="true" />}
              <span>{copiado === bloque.id ? t('common.copied') : t('docs.copy')}</span>
            </button>
          </div>
          <pre className="p-4 bg-[var(--bg-app)] overflow-x-auto text-[11.5px] leading-relaxed font-mono text-[var(--text-primary)]">
            <code>{bloque.texto}</code>
          </pre>
        </div>
      );
    case 'nota': {
      const aviso = bloque.tono === 'aviso';
      const Icono = aviso ? AlertTriangle : Info;
      return (
        <div
          className={`flex gap-3 p-3.5 rounded-[var(--radius-md)] border text-sm leading-relaxed ${
            aviso
              ? 'bg-[var(--status-warning-bg)] border-[var(--status-warning)]/30 text-[var(--text-primary)]'
              : 'bg-[var(--bg-surface)] border-[var(--border-subtle)] text-[var(--text-secondary)]'
          }`}
        >
          <Icono className={`w-4 h-4 shrink-0 mt-0.5 ${aviso ? 'text-[var(--status-warning)]' : 'text-[var(--text-muted)]'}`} aria-hidden="true" />
          <p className="min-w-0">{enLinea(bloque.texto)}</p>
        </div>
      );
    }
  }
}

export default function DocsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t, locale } = useI18n();

  // /docs es pública: puede haber sesión o no. Arranca en false para que el
  // HTML del servidor no incluya la navegación del panel: un visitante anónimo
  // no debe ver un menú cuyos enlaces le echan al login.
  const [conSesion, setConSesion] = useState(false);
  useEffect(() => {
    let vigente = true;
    api.auth
      .me()
      .then((me) => {
        if (vigente && me && (me.id || me.user?.id || me.username)) setConSesion(true);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, []);

  const secciones = GUIA[locale === 'es' ? 'es' : 'en'];
  const [activa, setActiva] = useState(secciones[0].id);
  const [busqueda, setBusqueda] = useState('');
  const [categoria, setCategoria] = useState<'ALL' | SeccionGuia['categoria']>('ALL');
  const [copiado, setCopiado] = useState<string | null>(null);
  const [indiceAbierto, setIndiceAbierto] = useState(false);

  useEffect(() => {
    const leerUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const sec = params.get('section') || window.location.hash.replace('#', '');
      if (sec && secciones.some((s) => s.id === sec)) setActiva(sec);
    };
    leerUrl();
    // Los enlaces de la propia app a /docs#seccion no recargan la página.
    window.addEventListener('hashchange', leerUrl);
    return () => window.removeEventListener('hashchange', leerUrl);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const copiar = (texto: string, id: string) => {
    navigator.clipboard.writeText(texto);
    setCopiado(id);
    showToast(t('common.copied'), 'success');
    setTimeout(() => setCopiado(null), 2000);
  };

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return secciones.filter((s) => {
      if (categoria !== 'ALL' && s.categoria !== categoria) return false;
      if (!q) return true;
      const texto = [s.titulo, s.resumen, ...s.bloques.map((b) => ('texto' in b ? b.texto : 'items' in b ? b.items.join(' ') : ''))].join(' ').toLowerCase();
      return texto.includes(q);
    });
  }, [secciones, categoria, busqueda]);

  const indice = secciones.findIndex((s) => s.id === activa);
  const seccion = secciones[indice] || secciones[0];
  const anterior = indice > 0 ? secciones[indice - 1] : null;
  const siguiente = indice < secciones.length - 1 ? secciones[indice + 1] : null;
  const nombreCategoria = (id: SeccionGuia['categoria']) => CATEGORIAS.find((c) => c.id === id)?.[locale === 'es' ? 'es' : 'en'] ?? id;

  const irA = (id: string) => {
    setActiva(id);
    setIndiceAbierto(false);
    window.history.replaceState(null, '', `#${id}`);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const listaSecciones = (
    <ol className="space-y-1.5 xl:max-h-[calc(100vh-240px)] xl:overflow-y-auto xl:pr-1 scrollbar-thin">
      {filtradas.map((s) => {
        const Icono = s.icono;
        const esActiva = activa === s.id;
        return (
          <li key={s.id}>
            <button
              type="button"
              onClick={() => irA(s.id)}
              aria-current={esActiva ? 'page' : undefined}
              className={`w-full text-left p-3 rounded-[var(--radius-md)] transition-all flex items-center justify-between cursor-pointer border select-none ${
                esActiva
                  ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)] font-bold'
                  : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
              }`}
            >
              <div className="flex items-center gap-3 min-w-0">
                <div className={`w-8 h-8 rounded-[var(--radius-sm)] flex items-center justify-center shrink-0 ${esActiva ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-text)]' : 'bg-[var(--bg-surface)] text-[var(--text-muted)]'}`}>
                  <Icono className="w-4 h-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate leading-tight">{s.titulo}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)] truncate mt-0.5 font-normal">{nombreCategoria(s.categoria)}</div>
                </div>
              </div>
              <ChevronRight className={`w-4 h-4 shrink-0 ${esActiva ? 'text-[var(--accent-text)]' : 'opacity-40'}`} aria-hidden="true" />
            </button>
          </li>
        );
      })}
      {filtradas.length === 0 && (
        <li className="px-3 py-6 text-center text-xs text-[var(--text-muted)]">{t('docs.noResults')}</li>
      )}
    </ol>
  );

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        conSesion ? (isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]') : ''
      } pl-0 flex flex-col`}
    >
      {conSesion ? (
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
            {(['ALL', ...CATEGORIAS.map((c) => c.id)] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoria(cat)}
                className={`filter-tab whitespace-nowrap ${categoria === cat ? 'filter-tab-active' : ''}`}
              >
                {cat === 'ALL' ? t('docs.allTopics') : nombreCategoria(cat)}
              </button>
            ))}
          </div>

          <div className="w-full md:w-72 relative shrink-0">
            <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="search"
              placeholder={t('docs.searchPlaceholder')}
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="glass-input pl-8.5 text-xs"
            />
          </div>
        </div>
      </div>

      <main className="flex-1 w-full px-4 sm:px-6 md:px-8 py-6">
        <div className="w-full grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* Índice */}
          <nav aria-label={t('docs.title')} className="xl:col-span-4 xl:sticky xl:top-36 space-y-3">
            {/* En tablet y móvil el índice va encima del texto, y abierto son
                once entradas —una pantalla entera— antes de la primera línea.
                Plegado enseña la sección actual; se abre para cambiar. */}
            <details className="xl:hidden glass-card p-4 group" onToggle={(e) => setIndiceAbierto(e.currentTarget.open)} open={indiceAbierto}>
              <summary className="cursor-pointer list-none flex items-center justify-between gap-3 px-1">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                    {t('docs.sections', { n: filtradas.length })}
                  </span>
                  <span className="block text-sm font-semibold truncate">{seccion.titulo}</span>
                </span>
                <ChevronRight className="w-4 h-4 shrink-0 text-[var(--text-muted)] transition-transform group-open:rotate-90" aria-hidden="true" />
              </summary>
              <div className="mt-3 pt-3 border-t border-[var(--border-subtle)]">{listaSecciones}</div>
            </details>
            <div className="hidden xl:block glass-card p-4 space-y-3">
              <div className="flex items-center justify-between px-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)] font-mono">
                  {t('docs.sections', { n: filtradas.length })}
                </span>
              </div>
              {listaSecciones}
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

          {/* Sección activa */}
          <article className="xl:col-span-8 space-y-6">
            <div className="glass-card p-6 sm:p-8 space-y-7">
              <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[var(--border-subtle)]">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--accent-primary)]/10 border border-[var(--accent-primary)]/25 text-[var(--accent-text)] flex items-center justify-center shrink-0">
                    <seccion.icono className="w-6 h-6" aria-hidden="true" />
                  </div>
                  <div className="space-y-1 min-w-0">
                    <span className="badge-pill">{nombreCategoria(seccion.categoria)}</span>
                    <h1 className="text-xl sm:text-2xl font-bold font-heading tracking-tight">{seccion.titulo}</h1>
                    <p className="text-xs sm:text-sm text-[var(--text-secondary)] leading-relaxed">{seccion.resumen}</p>
                  </div>
                </div>
                {seccion.pantalla && (
                  <Link href={seccion.pantalla.href} className="btn-primary text-xs shrink-0 self-start sm:self-center">
                    <span>{seccion.pantalla.etiqueta}</span>
                    <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
                  </Link>
                )}
              </header>

              <div className="space-y-5 max-w-[78ch]">
                {seccion.bloques.map((b, i) => (
                  <Bloque key={i} bloque={b} alCopiar={copiar} copiado={copiado} />
                ))}
              </div>

              <footer className="flex items-center justify-between gap-4 pt-6 border-t border-[var(--border-subtle)]">
                {anterior ? (
                  <button type="button" onClick={() => irA(anterior.id)} className="btn-secondary text-xs">
                    <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">{anterior.titulo}</span>
                    <span className="sm:hidden">{t('common.previous')}</span>
                  </button>
                ) : (
                  <div />
                )}
                {siguiente ? (
                  <button type="button" onClick={() => irA(siguiente.id)} className="btn-secondary text-xs">
                    <span className="hidden sm:inline">{siguiente.titulo}</span>
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
