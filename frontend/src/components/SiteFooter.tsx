'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Code2, Cookie, ExternalLink, Mail } from 'lucide-react';
import { api, type SiteLink } from '@/lib/api';
import { BrandIcon } from './BrandIcon';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Pie de la web pública, compartido por todas las páginas. Es el único sitio
 * donde se pintan las redes y los sitios recomendados, que se configuran desde
 * Panel > Enlaces.
 *
 * Lo que no está activado no llega hasta aquí: el endpoint público sólo
 * devuelve lo habilitado. Ocultarlo por CSS no serviría de nada, porque
 * «oculto» en un navegador es abrir las herramientas de desarrollo y leerlo.
 *
 * Si no hay ninguna red ni ningún sitio, la fila superior no se dibuja. Nada de
 * una cabecera «Comunidad» sobre un hueco.
 */

/** Los iconos de marca los sube el administrador; si no hay, va el nombre. */
function EnlaceSocial({ enlace }: { enlace: SiteLink }) {
  const esCorreo = enlace.url.startsWith('mailto:');

  return (
    <a
      href={enlace.url}
      target={esCorreo ? undefined : '_blank'}
      rel={esCorreo ? undefined : 'noopener noreferrer'}
      title={enlace.label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
    >
      {enlace.iconUrl ? (
        <BrandIcon
          icon={enlace.iconUrl}
          iconDark={enlace.iconDarkUrl}
          size={16}
          className="w-4 h-4 rounded-[3px]"
        />
      ) : esCorreo ? (
        <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span className="text-xs font-semibold">{enlace.label}</span>
    </a>
  );
}

function SitioAmigo({ enlace }: { enlace: SiteLink }) {
  return (
    <a
      href={enlace.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 min-w-0"
    >
      {enlace.iconUrl ? (
        <img
          src={enlace.iconUrl}
          alt=""
          width={28}
          height={28}
          className="w-7 h-7 rounded-[5px] object-cover border border-[var(--border-subtle)] shrink-0"
        />
      ) : (
        <span
          aria-hidden="true"
          className="w-7 h-7 rounded-[5px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center justify-center text-[11px] font-bold text-[var(--text-secondary)] shrink-0"
        >
          {enlace.label.charAt(0).toUpperCase()}
        </span>
      )}

      {/* min-w-0 en el hijo flexible: sin él, un nombre largo empuja la columna
          en vez de recortarse. */}
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
          <span className="truncate">{enlace.label}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
        </span>
        {/* La descripcion NO lleva `block`: `display:block` pisaria al
            `-webkit-box` que necesita line-clamp y se iria a tres lineas. */}
        {enlace.description ? (
          <span className="text-[11px] text-[var(--text-muted)] line-clamp-2">
            {enlace.description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

export function SiteFooter({
  nota,
  enlaces,
  mostrarCookies = false,
  onAbrirCookies,
}: {
  /** Texto de la izquierda. Por defecto, la marca. */
  nota?: React.ReactNode;
  /** Enlaces internos de la derecha. */
  enlaces: { href: string; label: string }[];
  mostrarCookies?: boolean;
  onAbrirCookies?: () => void;
}) {
  const { t } = useI18n();
  const [social, setSocial] = useState<SiteLink[]>([]);
  const [amigos, setAmigos] = useState<SiteLink[]>([]);

  useEffect(() => {
    // Si falla, el pie se queda con lo de siempre. No es contenido crítico y no
    // merece un mensaje de error en la portada.
    api.setup
      .getSiteLinks()
      .then((res) => {
        setSocial(res.social || []);
        setAmigos(res.friends || []);
      })
      .catch(() => {});
  }, []);

  const hayComunidad = social.length > 0 || amigos.length > 0;

  return (
    <footer className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] relative z-10 transition-colors">
      {hayComunidad && (
        <div className="w-full px-4 sm:px-8 lg:px-12 py-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-[var(--border-subtle)]">
          {social.length > 0 && (
            <section>
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t('footer.community')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {social.map((enlace) => (
                  <EnlaceSocial key={enlace.id} enlace={enlace} />
                ))}
              </div>
            </section>
          )}

          {amigos.length > 0 && (
            <section>
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t('footer.recommended')}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                {amigos.map((enlace) => (
                  <SitioAmigo key={enlace.id} enlace={enlace} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      <div className="w-full px-4 sm:px-8 lg:px-12 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs font-mono text-[var(--text-muted)]">
        <div className="flex items-center gap-2 text-center md:text-left">
          {nota ?? (
            <>
              <span className="font-bold text-[var(--text-primary)]" translate="no">
                SyncSekai
              </span>
              <span>&bull;</span>
              <span>{t('landing.footerTagline')}</span>
            </>
          )}
        </div>

        <nav className="flex items-center flex-wrap justify-center gap-x-6 gap-y-2">
          {enlaces.map((enlace) => (
            <Link
              key={enlace.href}
              href={enlace.href}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              {enlace.label}
            </Link>
          ))}

          {/* El codigo esta publicado y esa es la respuesta a "por que deberia
              fiarme de este servidor": no hace falta, montatelo tu. Conviene
              que se vea sin buscarlo. */}
          <a
            href="https://github.com/mr4r3n/syncsekai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('landing.footerSource')}</span>
          </a>

          {mostrarCookies && (
            <button
              type="button"
              onClick={onAbrirCookies}
              className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1 cursor-pointer"
            >
              <Cookie className="w-3.5 h-3.5 text-amber-400" aria-hidden="true" />
              <span>{t('landing.footerCookies')}</span>
            </button>
          )}
        </nav>
      </div>
    </footer>
  );
}
