'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { KeyRound, Loader2, Mail, Save, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';

interface Credential {
  key: string;
  group: string;
  label: string;
  isSecret: boolean;
  configured: boolean;
  value: string | null;
  updatedAt: string | null;
}

/**
 * Groups, in rendering order. Hint is the path inside provider's
 * console—or environment variable prefix—and is not
 * translated: those menus share the same name in any language.
 *
 * `logo` is the SVG in `public/`, the same file used by connections and
 * login. SMTP is not a brand and has none: uses a lucide icon instead.
 */
/**
 * Width of each field in the card's six-column grid. A port
 * does not require full width; a client id and secret fit in one row.
 * What is not listed here spans the full row.
 */
const COLUMNS: Record<string, string> = {
  SMTP_HOST: 'sm:col-span-4',
  SMTP_PORT: 'sm:col-span-2',
  SMTP_USER: 'sm:col-span-3',
  SMTP_PASS: 'sm:col-span-3',
  GOOGLE_CLIENT_ID: 'sm:col-span-3',
  GOOGLE_CLIENT_SECRET: 'sm:col-span-3',
  DISCORD_CLIENT_ID: 'sm:col-span-3',
  DISCORD_CLIENT_SECRET: 'sm:col-span-3',
  ANILIST_CLIENT_ID: 'sm:col-span-3',
  ANILIST_CLIENT_SECRET: 'sm:col-span-3',
  MAL_CLIENT_ID: 'sm:col-span-3',
  MAL_CLIENT_SECRET: 'sm:col-span-3',
};

const GROUPS: Array<{ id: string; name: string; hint: string; logo?: string }> = [
  { id: 'google', name: 'Google', logo: '/google.svg', hint: 'Cloud Console → Credentials → OAuth client' },
  { id: 'discord', name: 'Discord', logo: '/social/discord.svg', hint: 'Developer Portal → OAuth2 · Bot' },
  { id: 'anilist', name: 'AniList', logo: '/anilist.svg', hint: 'Settings → Developer → Create New Client' },
  { id: 'mal', name: 'MyAnimeList', logo: '/mal.svg', hint: 'API → Create ID (PKCE)' },
  { id: 'smtp', name: 'SMTP', hint: 'SMTP_*' },
  { id: 'plex', name: 'Plex', logo: '/plex.svg', hint: 'PLEX_CLIENT_ID' },
];

export default function CredentialsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t, locale } = useI18n();

  const [credentials, setCredentials] = useState<Credential[]>([]);
  const [isLoading, setLoading] = useState(true);
  /*
   * Touched fields only. Untouched fields are not sent: sending all
   * would rewrite working credentials, and a mid-save network failure
   * could leave the installation unable to authenticate users.
   */
  const [changes, setChanges] = useState<Record<string, string>>({});
  const [requestingPassword, setRequestingPassword] = useState(false);
  const [clave, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const yo = await api.auth.me().catch(() => null);
      const user = (yo as any)?.user || yo;
      if (!user || user.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }
      const res = await api.admin.getCredentials();
      setCredentials(res.credentials || []);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCount = Object.keys(changes).length;

  const save = async () => {
    try {
      setSaving(true);
      const res = await api.admin.updateCredentials(clave, changes);
      showToast(`${t('credentials.saved')} (${res.updated.length})`, 'success');
      setChanges({});
      setKey('');
      setRequestingPassword(false);
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB') : '';

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('credentials.title')} />

      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center shrink-0">
                <KeyRound className="w-4 h-4" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-heading">
                {t('credentials.title')}
              </h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('credentials.subtitle')}</p>
          </div>

          <button
            type="button"
            onClick={() => setRequestingPassword(true)}
            disabled={changeCount === 0 || isLoading}
            className="btn-primary shrink-0 w-full sm:w-auto justify-center disabled:opacity-40 disabled:cursor-default"
          >
            <Save className="w-3.5 h-3.5" aria-hidden="true" />
            <span>
              {t('credentials.save')}
              {changeCount > 0 ? ` (${changeCount})` : ''}
            </span>
          </button>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
        <p className="text-[11px] font-mono text-[var(--text-muted)]">
          {t('credentials.restartHint')}
        </p>

        {isLoading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {GROUPS.map((group) => {
              const inGroup = credentials.filter((c) => c.group === group.id);
              if (inGroup.length === 0) return null;

              return (
                <section key={group.id} className="glass-card p-5 sm:p-6 space-y-4">
                  <div className="pb-3 border-b border-[var(--glass-border)] flex items-center gap-3">
                    <div className="w-9 h-9 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                      {group.logo ? (
                        <img
                          src={group.logo}
                          alt=""
                          aria-hidden="true"
                          width={20}
                          height={20}
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Mail className="w-4 h-4 text-[var(--text-secondary)]" aria-hidden="true" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h2 className="text-sm font-bold font-heading">{group.name}</h2>
                      <p className="text-[11px] font-mono text-[var(--text-muted)] mt-0.5 truncate">
                        {group.hint}
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-6 gap-x-4 gap-y-4">
                    {inGroup.map((cred) => (
                      <div key={cred.key} className={`space-y-1.5 min-w-0 ${COLUMNS[cred.key] || 'sm:col-span-6'}`}>
                        <label
                          htmlFor={`cred-${cred.key}`}
                          className="block text-xs font-medium text-[var(--text-secondary)]"
                        >
                          {cred.label}
                        </label>

                        <div className="relative">
                          <input
                            id={`cred-${cred.key}`}
                            type={cred.isSecret ? 'password' : 'text'}
                            autoComplete="off"
                            suppressHydrationWarning
                            value={changes[cred.key] ?? cred.value ?? ''}
                            onChange={(e) =>
                              setChanges((prev) => ({ ...prev, [cred.key]: e.target.value }))
                            }
                            placeholder={
                              cred.isSecret && cred.configured
                                ? t('credentials.secretHidden')
                                : t('credentials.leaveBlank')
                            }
                            className={`glass-input text-xs font-mono w-full ${cred.configured ? 'pr-9' : ''}`}
                          />
                          {cred.configured && (
                            <button
                              type="button"
                              onClick={() => setChanges((prev) => ({ ...prev, [cred.key]: '' }))}
                              title={t('credentials.clear')}
                              aria-label={`${t('credentials.clear')} — ${cred.label}`}
                              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-[var(--radius-sm)] flex items-center justify-center text-[var(--status-danger)] hover:bg-[var(--status-danger-bg)] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                            </button>
                          )}
                        </div>

                        {/*
                          Status belongs on this line, not in a separate pill:
                          it is the same info—configured status and timestamp—
                          and splitting it forced looking twice.
                          Color is not standalone: unconfigured is stated in copy,
                          which aids those who cannot distinguish green from red.
                        */}
                        <p
                          className={`text-[10.5px] font-mono ${
                            cred.configured
                              ? 'text-[var(--status-success)]'
                              : 'text-[var(--status-danger)]'
                          }`}
                        >
                          {cred.configured
                            ? cred.updatedAt
                              ? t('credentials.changedOn', { date: date(cred.updatedAt) })
                              : t('credentials.configured')
                            : t('credentials.notConfigured')}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>

      {/* Prompt password again: rotating these keys affects all
          accounts, performed biannually. A compromised session should
          not suffice to alter them. */}
      <ConfirmModal
        isOpen={requestingPassword}
        title={t('credentials.confirmTitle')}
        description={t('credentials.confirmDesc', { n: changeCount })}
        confirmText={t('credentials.save')}
        cancelText={t('common.cancel')}
        variant="warning"
        loading={saving}
        onConfirm={save}
        onClose={() => {
          setRequestingPassword(false);
          setKey('');
        }}
      >
        <input
          type="password"
          autoComplete="current-password"
          suppressHydrationWarning
          value={clave}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('credentials.yourPassword')}
          className="glass-input text-xs"
        />
      </ConfirmModal>
    </div>
  );
}
