'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Code2, Cookie, ExternalLink, Mail } from 'lucide-react';
import { api, type SiteLink, type SiteSettings } from '@/lib/api';
import { BrandIcon } from './BrandIcon';
import { useI18n } from '@/i18n/I18nProvider';

/**
 * Footer of public site, shared by all pages. Only place
 * where networks and recommended sites are rendered, configured from
 * Dashboard > Links.
 *
 * Disabled items do not reach here: public endpoint only
 * returns enabled ones. Hiding via CSS would be useless, because
 * "hidden" in a browser means opening devtools and reading it.
 *
 * If there are no networks and no sites, top row is not rendered. No
 * "Community" header over an empty gap.
 */

/** Brand icons are uploaded by admin; if absent, name is shown. */
function SocialLink({ link }: { link: SiteLink }) {
  const isEmail = link.url.startsWith('mailto:');

  return (
    <a
      href={link.url}
      target={isEmail ? undefined : '_blank'}
      rel={isEmail ? undefined : 'noopener noreferrer'}
      title={link.label}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
    >
      {link.iconUrl ? (
        <BrandIcon
          icon={link.iconUrl}
          iconDark={link.iconDarkUrl}
          size={16}
          className="w-4 h-4 rounded-[3px]"
        />
      ) : isEmail ? (
        <Mail className="w-4 h-4 shrink-0" aria-hidden="true" />
      ) : null}
      <span className="text-xs font-semibold">{link.label}</span>
    </a>
  );
}

function FriendSite({ link }: { link: SiteLink }) {
  const { locale } = useI18n();
  const description = (locale === 'es' && link.descriptionEs) || link.description;

  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex items-start gap-2.5 min-w-0"
    >
      {link.iconUrl ? (
        <img
          src={link.iconUrl}
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
          {link.label.charAt(0).toUpperCase()}
        </span>
      )}

      {/* min-w-0 on flex child: without it, a long name pushes column
          instead of truncating. */}
      <span className="min-w-0">
        <span className="flex items-center gap-1 text-xs font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
          <span className="truncate">{link.label}</span>
          <ExternalLink className="w-3 h-3 shrink-0 opacity-60" aria-hidden="true" />
        </span>
        {/* Description does NOT use `block`: `display:block` would override
            `-webkit-box` needed by line-clamp and spill into three lines. */}
        {description ? (
          <span className="text-[11px] text-[var(--text-muted)] line-clamp-2">
            {description}
          </span>
        ) : null}
      </span>
    </a>
  );
}

export function SiteFooter({
  nota,
  links,
  showCookies = false,
  onOpenCookies,
}: {
  /** Left text. By default, the brand. */
  nota?: React.ReactNode;
  /** Internal links on the right. */
  links: { href: string; label: string }[];
  showCookies?: boolean;
  onOpenCookies?: () => void;
}) {
  const { t } = useI18n();
  const [social, setSocial] = useState<SiteLink[]>([]);
  const [amigos, setAmigos] = useState<SiteLink[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);

  useEffect(() => {
    // If it fails, footer retains defaults. Not critical content and does not
    // warrant an error message on homepage.
    api.setup
      .getSiteLinks()
      .then((res) => {
        setSocial(res.social || []);
        setAmigos(res.friends || []);
      })
      .catch(() => {});
    api.setup.getSiteSettings().then(setSettings).catch(() => {});
  }, []);

  const hasCommunity = social.length > 0 || amigos.length > 0;

  return (
    <footer className="w-full border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] relative z-10 transition-colors">
      {hasCommunity && (
        <div className="w-full px-4 sm:px-8 lg:px-12 py-8 grid grid-cols-1 md:grid-cols-2 gap-8 border-b border-[var(--border-subtle)]">
          {social.length > 0 && (
            <section>
              <h2 className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--text-muted)] mb-3">
                {t('footer.community')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {social.map((enlace) => (
                  <SocialLink key={enlace.id} link={enlace} />
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
                  <FriendSite key={enlace.id} link={enlace} />
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
                {settings?.siteName || 'SyncSekai'}
              </span>
              <span>&bull;</span>
              <span>{t('landing.footerTagline')}</span>
            </>
          )}
        </div>

        <nav className="flex items-center flex-wrap justify-center gap-x-6 gap-y-2">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="hover:text-[var(--text-primary)] transition-colors"
            >
              {link.label}
            </Link>
          ))}

          {settings?.contactEmail && (
            <a href={`mailto:${settings.contactEmail}`} className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{t('footer.contact')}</span>
            </a>
          )}

          {/* Code is published and that is the answer to "why should I
              trust this server": you don't have to, host it yourself. Good
              for it to be seen without searching. */}
          <a
            href="https://github.com/mr4r3n/syncsekai"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-[var(--text-primary)] transition-colors flex items-center gap-1.5"
          >
            <Code2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('landing.footerSource')}</span>
          </a>

          {showCookies && (
            <button
              type="button"
              onClick={onOpenCookies}
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
