'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Globe, Loader2, Save, RotateCcw, Upload, Trash2 } from 'lucide-react';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api } from '@/lib/api';

interface Ajuste {
  key: string;
  field: string;
  value: string;
  defaultValue: string;
  maxLength: number;
  updatedAt: string | null;
}

/** Cómo se pinta cada ajuste. Lo que no esté aquí es un campo de texto de una línea. */
const CAMPOS: Record<string, { grupo: 'identidad' | 'seo' | 'registro'; tipo?: 'textarea' | 'switch' | 'email' }> = {
  SITE_NAME: { grupo: 'identidad' },
  SITE_CONTACT_EMAIL: { grupo: 'identidad', tipo: 'email' },
  SITE_TITLE: { grupo: 'seo' },
  SITE_DESCRIPTION: { grupo: 'seo', tipo: 'textarea' },
  REGISTRATION_OPEN: { grupo: 'registro', tipo: 'switch' },
};

const GRUPOS: Array<'identidad' | 'seo' | 'registro'> = ['identidad', 'seo', 'registro'];

export default function AjustesSitioPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t, locale } = useI18n();

  const [ajustes, setAjustes] = useState<Ajuste[]>([]);
  const [iconVersion, setIconVersion] = useState<string | null>(null);
  const [subiendoIcono, setSubiendoIcono] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  // Sólo lo tocado; un campo que no se toca no se manda.
  const [cambios, setCambios] = useState<Record<string, string>>({});

  const cargar = async () => {
    try {
      setCargando(true);
      const yo = await api.auth.me().catch(() => null);
      const usuario = (yo as any)?.user || yo;
      if (!usuario || usuario.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }
      const res = await api.admin.getSiteSettings();
      setAjustes(res.settings || []);
      setIconVersion(res.iconVersion || null);
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const numeroDeCambios = Object.keys(cambios).length;

  const guardar = async () => {
    try {
      setGuardando(true);
      const res = await api.admin.updateSiteSettings(cambios);
      showToast(`${t('siteSettings.saved')} (${res.updated.length})`, 'success');
      setCambios({});
      await cargar();
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setGuardando(false);
    }
  };

  const subirIcono = async (file: File | undefined) => {
    if (!file) return;
    try {
      setSubiendoIcono(true);
      const fd = new FormData();
      fd.append('icon', file);
      const res = await api.admin.uploadSiteIcon(fd);
      setIconVersion(res.iconVersion);
      showToast(t('siteSettings.iconSaved'), 'success');
    } catch (e: any) {
      showToast(e.message, 'error');
    } finally {
      setSubiendoIcono(false);
    }
  };

  const restablecerIcono = async () => {
    try {
      await api.admin.deleteSiteIcon();
      setIconVersion(null);
      showToast(t('siteSettings.iconReset'), 'info');
    } catch (e: any) {
      showToast(e.message, 'error');
    }
  };

  const valorDe = (a: Ajuste) => cambios[a.key] ?? a.value;
  const fecha = (iso: string | null) =>
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
            onClick={guardar}
            disabled={numeroDeCambios === 0 || cargando || guardando}
            className="btn-primary shrink-0 w-full sm:w-auto justify-center disabled:opacity-40 disabled:cursor-default"
          >
            {guardando ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Save className="w-3.5 h-3.5" aria-hidden="true" />}
            <span>
              {t('siteSettings.save')}
              {numeroDeCambios > 0 ? ` (${numeroDeCambios})` : ''}
            </span>
          </button>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
        <p className="text-[11px] font-mono text-[var(--text-muted)]">{t('siteSettings.hint')}</p>

        {cargando ? (
          <div className="py-24 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {GRUPOS.map((grupo) => {
              const delGrupo = ajustes.filter((a) => CAMPOS[a.key]?.grupo === grupo);
              if (delGrupo.length === 0) return null;
              return (
                <section key={grupo} className="glass-card p-5 sm:p-6 space-y-5">
                  <div className="pb-3 border-b border-[var(--glass-border)]">
                    <h2 className="text-sm font-bold font-heading">{t(`siteSettings.group.${grupo}`)}</h2>
                    <p className="text-[11px] text-[var(--text-muted)] mt-0.5">{t(`siteSettings.groupHint.${grupo}`)}</p>
                  </div>

                  {grupo === 'identidad' && (
                    <div className="flex items-center gap-4">
                      {/* La versión en la URL fuerza al navegador a recargar tras subir. */}
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
                            {subiendoIcono ? <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />}
                            <span>{t('siteSettings.iconUpload')}</span>
                            <input
                              type="file"
                              accept="image/png,image/jpeg,image/webp"
                              className="sr-only"
                              disabled={subiendoIcono}
                              onChange={(e) => {
                                subirIcono(e.target.files?.[0]);
                                e.target.value = '';
                              }}
                            />
                          </label>
                          {iconVersion && (
                            <button type="button" onClick={restablecerIcono} className="btn-secondary text-xs text-[var(--status-danger)]">
                              <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                              <span>{t('siteSettings.iconReset')}</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {delGrupo.map((a) => {
                    const campo = CAMPOS[a.key];
                    const valor = valorDe(a);
                    const cambiado = a.key in cambios;
                    const tocar = (v: string) => setCambios((prev) => ({ ...prev, [a.key]: v }));

                    return (
                      <div key={a.key} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <label htmlFor={`ajuste-${a.key}`} className="text-xs font-medium text-[var(--text-secondary)]">
                            {t(`siteSettings.field.${a.key}`)}
                          </label>
                          {campo.tipo !== 'switch' && valor && valor !== a.defaultValue && a.defaultValue && (
                            <button
                              type="button"
                              onClick={() => tocar('')}
                              className="text-[10.5px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
                            >
                              <RotateCcw className="w-3 h-3" aria-hidden="true" />
                              {t('siteSettings.useDefault')}
                            </button>
                          )}
                        </div>

                        {campo.tipo === 'switch' ? (
                          <label className="flex items-center gap-3 cursor-pointer select-none">
                            <input
                              id={`ajuste-${a.key}`}
                              type="checkbox"
                              checked={(valor || a.defaultValue) !== 'false'}
                              onChange={(e) => tocar(e.target.checked ? 'true' : 'false')}
                              className="w-4 h-4 accent-[var(--accent-primary)]"
                            />
                            <span className="text-sm">
                              {(valor || a.defaultValue) !== 'false'
                                ? t('siteSettings.registrationOpen')
                                : t('siteSettings.registrationClosed')}
                            </span>
                          </label>
                        ) : campo.tipo === 'textarea' ? (
                          <textarea
                            id={`ajuste-${a.key}`}
                            rows={3}
                            maxLength={a.maxLength}
                            value={valor}
                            placeholder={a.defaultValue}
                            onChange={(e) => tocar(e.target.value)}
                            className="glass-input text-sm resize-y"
                          />
                        ) : (
                          <input
                            id={`ajuste-${a.key}`}
                            type={campo.tipo === 'email' ? 'email' : 'text'}
                            maxLength={a.maxLength}
                            value={valor}
                            placeholder={a.defaultValue || t('siteSettings.empty')}
                            onChange={(e) => tocar(e.target.value)}
                            className="glass-input text-sm"
                          />
                        )}

                        <div className="flex items-center justify-between gap-2 text-[10.5px] font-mono text-[var(--text-muted)]">
                          <span>
                            {cambiado
                              ? t('siteSettings.unsaved')
                              : a.updatedAt && a.value
                                ? t('siteSettings.changedOn', { fecha: fecha(a.updatedAt) })
                                : t('siteSettings.usingDefault')}
                          </span>
                          {campo.tipo !== 'switch' && (
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
          </div>
        )}
      </main>
    </div>
  );
}
