'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Topbar } from '@/components/Topbar';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomSelect } from '@/components/CustomSelect';
import { BrandIcon } from '@/components/BrandIcon';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api, type SiteLink, type RedSocial } from '@/lib/api';
import {
  Link2,
  Plus,
  Trash2,
  ImagePlus,
  ChevronUp,
  ChevronDown,
  Loader2,
  ExternalLink,
  Globe,
} from 'lucide-react';

/**
 * Panel > Enlaces del pie.
 *
 * Dos cosas distintas, y por eso dos secciones separadas:
 *
 * - Las **redes** salen de un catálogo cerrado. Se elige cuál del desplegable y
 *   el nombre y el icono vienen con ella: no hay nada que subir, y así tampoco
 *   hay forma de acabar con un "Discord" que apunta a una imagen cualquiera.
 * - Los **sitios recomendados** son libres, así que ahí sí hace falta un
 *   nombre, una descripción y un logo que suba el administrador.
 *
 * Lo desactivado no se envía siquiera al cliente: apagar un enlace lo quita de
 * verdad, no lo esconde.
 */
export default function AdminLinksPage() {
  const router = useRouter();
  const { t } = useI18n();
  const { showToast } = useToast();
  const { isCollapsed } = useSidebar();

  const [links, setLinks] = useState<SiteLink[]>([]);
  const [redes, setRedes] = useState<RedSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [aBorrar, setABorrar] = useState<SiteLink | null>(null);
  const [subiendoLogo, setSubiendoLogo] = useState<string | null>(null);

  // Alta de red social
  const [redElegida, setRedElegida] = useState('');
  const [urlRed, setUrlRed] = useState('');
  const [creandoRed, setCreandoRed] = useState(false);

  // Alta de sitio recomendado
  const [nombreSitio, setNombreSitio] = useState('');
  const [urlSitio, setUrlSitio] = useState('');
  const [descSitio, setDescSitio] = useState('');
  const [creandoSitio, setCreandoSitio] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const idParaLogo = useRef<string | null>(null);

  const cargar = async () => {
    try {
      setLoading(true);
      const [res, cat] = await Promise.all([api.admin.siteLinks(), api.admin.siteLinkProviders()]);
      setLinks(res.links || []);
      setRedes(cat.providers || []);
      if (!redElegida && cat.providers?.length) setRedElegida(cat.providers[0].id);
    } catch (err: any) {
      showToast(`${t('adminLinks.loadError')} ${err.message}`, 'error');
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const redActual = redes.find((r) => r.id === redElegida);

  const handleCrearRed = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoRed(true);
    try {
      const res = await api.admin.createSiteLink({
        kind: 'SOCIAL',
        provider: redElegida,
        url: urlRed.trim(),
      });
      setLinks(res.links || []);
      setUrlRed('');
      showToast(t('adminLinks.created'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setCreandoRed(false);
    }
  };

  const handleCrearSitio = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreandoSitio(true);
    try {
      const res = await api.admin.createSiteLink({
        kind: 'FRIEND',
        label: nombreSitio.trim(),
        url: urlSitio.trim(),
        description: descSitio.trim(),
      });
      setLinks(res.links || []);
      setNombreSitio('');
      setUrlSitio('');
      setDescSitio('');
      showToast(t('adminLinks.created'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setCreandoSitio(false);
    }
  };

  const actualizar = async (id: string, cambios: Partial<SiteLink>) => {
    try {
      const res = await api.admin.updateSiteLink(id, cambios);
      setLinks(res.links || []);
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    }
  };

  const handleBorrar = async () => {
    if (!aBorrar) return;
    try {
      const res = await api.admin.deleteSiteLink(aBorrar.id);
      setLinks(res.links || []);
      showToast(t('adminLinks.deleted'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setABorrar(null);
    }
  };

  /**
   * Mover dentro de su grupo intercambiando el orden con el vecino, en lugar de
   * renumerar la lista entera: dos escrituras en vez de N y el mismo resultado.
   */
  const mover = async (enlace: SiteLink, direccion: -1 | 1) => {
    const grupo = links.filter((l) => l.kind === enlace.kind);
    const i = grupo.findIndex((l) => l.id === enlace.id);
    const vecino = grupo[i + direccion];
    if (!vecino) return;

    try {
      await api.admin.updateSiteLink(enlace.id, { sortOrder: vecino.sortOrder });
      const res = await api.admin.updateSiteLink(vecino.id, { sortOrder: enlace.sortOrder });
      setLinks(res.links || []);
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    }
  };

  const handleLogoElegido = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Se limpia siempre: sin esto, reintentar con el mismo fichero tras un fallo
    // no dispara el evento y parece que el boton no hace nada.
    e.target.value = '';
    const id = idParaLogo.current;
    if (!file || !id) return;

    setSubiendoLogo(id);
    try {
      const formData = new FormData();
      formData.append('icon', file);
      const res = await api.admin.uploadSiteLinkIcon(id, formData);
      setLinks(res.links || []);
      showToast(t('adminLinks.iconUploaded'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setSubiendoLogo(null);
    }
  };

  /** Controles comunes a las dos listas: orden, visibilidad y borrado. */
  const controles = (enlace: SiteLink, i: number, total: number) => (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={() => mover(enlace, -1)}
        disabled={i === 0}
        aria-label={t('adminLinks.moveUp')}
        title={t('adminLinks.moveUp')}
        className="p-1.5 rounded-[5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 cursor-pointer transition-colors"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => mover(enlace, 1)}
        disabled={i === total - 1}
        aria-label={t('adminLinks.moveDown')}
        title={t('adminLinks.moveDown')}
        className="p-1.5 rounded-[5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 cursor-pointer transition-colors"
      >
        <ChevronDown className="w-3.5 h-3.5" />
      </button>

      <label className="flex items-center gap-1.5 px-2 cursor-pointer">
        <input
          type="checkbox"
          checked={!!enlace.isEnabled}
          onChange={(e) => actualizar(enlace.id, { isEnabled: e.target.checked })}
          className="accent-[var(--accent-primary)] cursor-pointer"
        />
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          {t('adminLinks.visible')}
        </span>
      </label>

      <button
        onClick={() => setABorrar(enlace)}
        aria-label={t('adminLinks.delete')}
        title={t('adminLinks.delete')}
        className="p-1.5 rounded-[5px] text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  );

  const filaBase = (enlace: SiteLink) =>
    `flex items-center gap-3 p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-opacity ${
      enlace.isEnabled ? '' : 'opacity-50'
    }`;

  const enlaceUrl = (enlace: SiteLink) => (
    <a
      href={enlace.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
    >
      <span className="truncate">{enlace.url}</span>
      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
    </a>
  );

  const sociales = links.filter((l) => l.kind === 'SOCIAL');
  const sitios = links.filter((l) => l.kind === 'FRIEND');

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('adminLinks.title')} />

      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
            <Link2 className="w-4 h-4" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
              {t('adminLinks.title')}
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('adminLinks.subtitle')}</p>
          </div>
        </div>
      </div>

      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0">
        <input
          ref={logoInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={handleLogoElegido}
        />

        {loading ? (
          <div className="glass-card p-8 flex items-center justify-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[var(--text-muted)]" aria-hidden="true" />
            <span className="text-xs font-mono text-[var(--text-muted)]">
              {t('adminLinks.loading')}
            </span>
          </div>
        ) : (
          <>
            {/* ============================ REDES ============================ */}
            <section className="glass-card p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                  {t('adminLinks.socialTitle')}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('adminLinks.socialHelp')}
                </p>
              </div>

              <form
                onSubmit={handleCrearRed}
                className="grid grid-cols-1 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] gap-3 items-end"
              >
                <div className="space-y-1.5 min-w-0">
                  <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                    {t('adminLinks.network')}
                  </label>
                  <CustomSelect
                    value={redElegida}
                    onChange={setRedElegida}
                    options={redes.map((r) => ({
                      value: r.id,
                      label: r.label,
                      icon: (
                        <BrandIcon icon={r.icon} iconDark={r.iconDark} size={16} className="w-4 h-4" />
                      ),
                    }))}
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label
                    htmlFor="url-red"
                    className="text-[11px] font-semibold text-[var(--text-secondary)] block"
                  >
                    {t('adminLinks.url')}
                  </label>
                  <input
                    id="url-red"
                    type="url"
                    inputMode="url"
                    value={urlRed}
                    onChange={(e) => setUrlRed(e.target.value)}
                    required
                    spellCheck={false}
                    autoComplete="off"
                    placeholder={redActual?.ejemplo || 'https://…'}
                    className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-mono"
                  />
                </div>

                <button type="submit" disabled={creandoRed} className="btn-primary shrink-0">
                  {creandoRed ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{t('adminLinks.add')}</span>
                </button>
              </form>

              {sociales.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2">{t('adminLinks.emptySocial')}</p>
              ) : (
                <ul className="space-y-2">
                  {sociales.map((enlace, i) => (
                    <li key={enlace.id} className={filaBase(enlace)}>
                      <span className="w-8 h-8 rounded-[5px] border border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-center shrink-0">
                        {enlace.iconUrl ? (
                          <BrandIcon
                            icon={enlace.iconUrl}
                            iconDark={redes.find((r) => r.id === enlace.provider)?.iconDark}
                            size={18}
                            className="w-[18px] h-[18px]"
                          />
                        ) : (
                          <Globe className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                        )}
                      </span>

                      {/* min-w-0: sin el, una URL larga empuja los botones fuera de la fila */}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {enlace.label}
                        </div>
                        {enlaceUrl(enlace)}
                      </div>

                      {controles(enlace, i, sociales.length)}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            {/* ======================= SITIOS RECOMENDADOS ======================= */}
            <section className="glass-card p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                  {t('adminLinks.friendTitle')}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {t('adminLinks.friendHelp')}
                </p>
              </div>

              <form onSubmit={handleCrearSitio} className="space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="nombre-sitio"
                      className="text-[11px] font-semibold text-[var(--text-secondary)] block"
                    >
                      {t('adminLinks.label')}
                    </label>
                    <input
                      id="nombre-sitio"
                      value={nombreSitio}
                      onChange={(e) => setNombreSitio(e.target.value)}
                      required
                      maxLength={60}
                      spellCheck={false}
                      autoComplete="off"
                      placeholder={t('adminLinks.labelPlaceholder')}
                      className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs"
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="url-sitio"
                      className="text-[11px] font-semibold text-[var(--text-secondary)] block"
                    >
                      {t('adminLinks.url')}
                    </label>
                    <input
                      id="url-sitio"
                      type="url"
                      inputMode="url"
                      value={urlSitio}
                      onChange={(e) => setUrlSitio(e.target.value)}
                      required
                      spellCheck={false}
                      autoComplete="off"
                      placeholder="https://ejemplo.com"
                      className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <label
                      htmlFor="desc-sitio"
                      className="text-[11px] font-semibold text-[var(--text-secondary)] block"
                    >
                      {t('adminLinks.description')}
                    </label>
                    <input
                      id="desc-sitio"
                      value={descSitio}
                      onChange={(e) => setDescSitio(e.target.value)}
                      maxLength={160}
                      autoComplete="off"
                      placeholder={t('adminLinks.descriptionPlaceholder')}
                      className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <p className="text-[11px] text-[var(--text-muted)]">{t('adminLinks.logoHint')}</p>
                  <button type="submit" disabled={creandoSitio} className="btn-primary shrink-0">
                    {creandoSitio ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                    )}
                    <span>{t('adminLinks.add')}</span>
                  </button>
                </div>
              </form>

              {sitios.length === 0 ? (
                <p className="text-xs text-[var(--text-muted)] py-2">{t('adminLinks.emptyFriend')}</p>
              ) : (
                <ul className="space-y-2">
                  {sitios.map((enlace, i) => (
                    <li key={enlace.id} className={filaBase(enlace)}>
                      {/* El logo es el boton de subida: es donde uno mira cuando
                          quiere cambiarlo, y con hueco vacio se ve que falta. */}
                      <button
                        onClick={() => {
                          idParaLogo.current = enlace.id;
                          logoInputRef.current?.click();
                        }}
                        disabled={subiendoLogo === enlace.id}
                        title={t('adminLinks.uploadIcon')}
                        aria-label={`${t('adminLinks.uploadIcon')}: ${enlace.label}`}
                        className="group relative w-11 h-11 rounded-[5px] border border-[var(--border-subtle)] bg-[var(--bg-app)] overflow-hidden shrink-0 cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                      >
                        {enlace.iconUrl ? (
                          <img
                            src={enlace.iconUrl}
                            alt=""
                            width={44}
                            height={44}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="w-full h-full flex items-center justify-center text-[var(--text-muted)]">
                            <ImagePlus className="w-4 h-4" aria-hidden="true" />
                          </span>
                        )}

                        <span className="absolute inset-0 bg-black/60 text-white opacity-0 group-hover:opacity-100 focus-visible:opacity-100 transition-opacity flex items-center justify-center">
                          {subiendoLogo === enlace.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <ImagePlus className="w-4 h-4" aria-hidden="true" />
                          )}
                        </span>
                      </button>

                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate">
                          {enlace.label}
                        </div>
                        {enlaceUrl(enlace)}
                        {enlace.description ? (
                          <div className="text-[11px] text-[var(--text-secondary)] line-clamp-1">
                            {enlace.description}
                          </div>
                        ) : null}
                      </div>

                      {controles(enlace, i, sitios.length)}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>

      <ConfirmModal
        isOpen={!!aBorrar}
        onClose={() => setABorrar(null)}
        onConfirm={handleBorrar}
        title={t('adminLinks.deleteTitle')}
        description={t('adminLinks.deleteMessage', { label: aBorrar?.label || '' })}
        confirmText={t('adminLinks.delete')}
        variant="danger"
      />
    </div>
  );
}
