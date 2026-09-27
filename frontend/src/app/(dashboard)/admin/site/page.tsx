'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Save, RotateCcw, Upload, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { FooterLinksPanel } from '@/components/FooterLinksPanel';
import { api } from '@/lib/api';

interface Setting {
  key: string;
  field: string;
  value: string;
  defaultValue: string;
  maxLength: number;
  updatedAt: string | null;
}

/** How each setting renders. What is not listed here is a single-line text field. */
const FIELDS: Record<string, { group: 'identidad' | 'seo' | 'registro'; type?: 'textarea' | 'switch' | 'email' }> = {
  SITE_NAME: { group: 'identidad' },
  SITE_CONTACT_EMAIL: { group: 'identidad', type: 'email' },
  SITE_TITLE: { group: 'seo' },
  SITE_DESCRIPTION: { group: 'seo', type: 'textarea' },
  REGISTRATION_OPEN: { group: 'registro', type: 'switch' },
};

const GROUPS: Array<'identidad' | 'seo' | 'registro'> = ['identidad', 'seo', 'registro'];

export default function SiteSettingsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t, locale } = useI18n();

  const [settings, setSettings] = useState<Setting[]>([]);
  const [iconVersion, setIconVersion] = useState<string | null>(null);
  const [uploadingIcon, setUploadingIcon] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // Touched only; untouched fields are not sent.
  const [changes, setChanges] = useState<Record<string, string>>({});

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
      const res = await api.admin.getSiteSettings();
      setSettings(res.settings || []);
      setIconVersion(res.iconVersion || null);
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
      const res = await api.admin.updateSiteSettings(changes);
      showToast(`${t('siteSettings.saved')} (${res.updated.length})`, 'success');
      setChanges({});
      await load();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  const uploadIcon = async (file: File | undefined) => {
    if (!file) return;
    try {
      setUploadingIcon(true);
      const fd = new FormData();
      fd.append('icon', file);
      const res = await api.admin.uploadSiteIcon(fd);
      setIconVersion(res.iconVersion);
      showToast(t('siteSettings.iconSaved'), 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setUploadingIcon(false);
    }
  };

  const resetIcon = async () => {
    try {
      await api.admin.deleteSiteIcon();
      setIconVersion(null);
      showToast(t('siteSettings.iconReset'), 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const valueOf = (a: Setting) => changes[a.key] ?? a.value;
  const date = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB') : '';

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('siteSettings.title')} />

      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center shrink-0">
                <Globe className="w-4 h-4" aria-hidden="true" />
              </div>
              <h1 className="text-xl font-bold tracking-tight font-heading">{t('siteSettings.title')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">{t('siteSettings.subtitle')}</p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={changeCount === 0 || loading || saving}
            className="btn-primary shrink-0 w-full sm:w-auto justify-center disabled:opacity-40 disabled:cursor-default"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>
              {t('siteSettings.save')}
              {changeCount > 0 ? ` (${changeCount})` : ''}
            </span>
          </button>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
        <p className="text-[11px] font-mono text-[var(--text-muted)]">{t('siteSettings.hint')}</p>

        {loading ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {GROUPS.map((group) => {
              const inGroup = settings.filter((a) => FIELDS[a.key]?.group === group);
              if (inGroup.length === 0) return null;
              return (
                <section key={group} className="glass-card p-5 sm:p-6 space-y-5">
                  <div className="pb-3 border-b border-[var(--glass-border)]">
                    <h2 className="text-sm font-bold font-heading">{t(`siteSettings.group.${group}`)}</h2>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t(`siteSettings.groupHint.${group}`)}</p>
                  </div>

                  {group === 'identidad' && (
                    <div className="flex items-center gap-4">
                      {/* Version query in URL forces browser cache bust on upload. */}
                      <img
                        src={`/logo.webp?v=${iconVersion || 'serie'}`}
                        alt=""
                        width={64}
                        height={64}
                        className="w-16 h-16 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] object-cover shrink-0"
                      />
                      <div className="min-w-0 space-y-1.5">
                        <p className="text-xs font-medium text-[var(--text-secondary)]">{t('siteSettings.icon')}</p>
                        <p className="text-[11px] text-[var(--text-muted)]">{t('siteSettings.iconHint')}</p>
                        <div className="flex items-center gap-2 pt-0.5">
                          <label className="btn-secondary text-xs cursor-pointer">
                            {uploadingIcon ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
                            <span>{t('siteSettings.iconUpload')}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              disabled={uploadingIcon}
                              onChange={(e) => {
                                uploadIcon(e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {iconVersion && (
                            <button type="button" onClick={resetIcon} className="btn-secondary text-xs text-[var(--status-danger)]">
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{t('siteSettings.iconReset')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {inGroup.map((a) => {
                    const field = FIELDS[a.key];
                    const valor = valueOf(a);
                    const changed = a.key in changes;
                    const touch = (v: string) => setChanges((prev) => ({ ...prev, [a.key]: v }));

                    return (
                      <div key={a.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`ajuste-${a.key}`} className="text-xs font-medium text-[var(--text-secondary)]">
                            {t(`siteSettings.field.${a.key}`)}
                          </label>
                          {field.type !== 'switch' && valor && valor !== a.defaultValue && a.defaultValue && (
                            <button
                              type="button"
                              onClick={() => touch('')}
                              className="text-[10.5px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              {t('siteSettings.useDefault')}
                            </button>
                          )}
                        </div>

                        {field.type === 'switch' ? (
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              id={`ajuste-${a.key}`}
                              type="checkbox"
                              checked={(valor || a.defaultValue) !== 'false'}
                              onChange={(e) => touch(e.target.checked ? 'true' : 'false')}
                              className="w-4 h-4 accent-[var(--accent-primary)]"
                            />
                            <span className="text-sm">
                              {(valor || a.defaultValue) !== 'false'
                                ? t('siteSettings.registrationOpen')
                                : t('siteSettings.registrationClosed')}
                            </span>
                          </label>
                        ) : field.type === 'textarea' ? (
                          <textarea
                            id={`ajuste-${a.key}`}
                            rows={3}
                            maxLength={a.maxLength}
                            value={valor}
                            placeholder={a.defaultValue}
                            onChange={(e) => touch(e.target.value)}
                            className="glass-input text-sm resize-y"
                          />
                        ) : (
                          <input
                            id={`ajuste-${a.key}`}
                            type={field.type === 'email' ? 'email' : 'text'}
                            maxLength={a.maxLength}
                            value={valor}
                            placeholder={a.defaultValue || t('siteSettings.empty')}
                            onChange={(e) => touch(e.target.value)}
                            className="glass-input text-sm"
                          />
                        )}

                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-[var(--text-muted)]">
                          <span>
                            {changed
                              ? t('siteSettings.unsaved')
                              : a.updatedAt && a.value
                                ? t('siteSettings.changedOn', { date: date(a.updatedAt) })
                                : t('siteSettings.usingDefault')}
                          </span>
                          {field.type !== 'switch' && (
                            <span className={valor.length > a.maxLength * 0.9 ? 'text-[var(--status-warning)]' : ''}>
                              {valor.length}/{a.maxLength}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </section>
              );
            })}
            <FooterLinksPanel />
          </div>
        )}
      </main>
    </div>
  );
}
