'use client';

import React, { useEffect, useRef, useState } from 'react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { CustomSelect } from '@/components/CustomSelect';
import { BrandIcon } from '@/components/BrandIcon';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { api, type SiteLink, type RedSocial } from '@/lib/api';
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ImagePlus,
  ChevronUp,
  ChevronDown,
  Loader2,
  ExternalLink,
  Globe,
} from 'lucide-react';

/**
 * Site Settings > Footer Links. Saved immediately, action by action,
 * unlike other settings: each link is its own row and there is
 * nothing to "apply".
 *
 * Two distinct things, hence two separate sections:
 *
 * - **Networks** come from a closed catalog. Selected from the dropdown, and
 *   the name and icon come with it: nothing to upload, preventing
 *   ending up with a "Discord" pointing to an arbitrary image.
 * - **Recommended sites** are open-ended, so they do require a
 *   name, a description, and a logo uploaded by the administrator.
 *
 * Disabled items are not even sent to the client: disabling a link removes it
 * for real, not merely hiding it.
 */
export function FooterLinksPanel() {
  const { t } = useI18n();
  const { showToast, showUndoToast } = useToast();

  const [links, setLinks] = useState<SiteLink[]>([]);
  const [redes, setRedes] = useState<RedSocial[]>([]);
  const [loading, setLoading] = useState(true);
  const [toDelete, setToDelete] = useState<SiteLink | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState<string | null>(null);
  // Row being edited; fields live here until saved or cancelled.
  const [editing, setEditing] = useState<{
    id: string;
    label: string;
    url: string;
    description: string;
    descriptionEs: string;
  } | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  // Alta de red social
  const [selectedSocial, setSelectedSocial] = useState('');
  const [networkUrl, setNetworkUrl] = useState('');
  const [creatingSocial, setCreatingSocial] = useState(false);

  // Alta de sitio recomendado
  const [siteName, setSiteName] = useState('');
  const [siteUrl, setSiteUrl] = useState('');
  const [siteDesc, setSiteDesc] = useState('');
  const [siteDescEs, setSiteDescEs] = useState('');
  const [creatingSite, setCreatingSite] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);
  const idParaLogo = useRef<string | null>(null);

  const load = async () => {
    try {
      setLoading(true);
      const [res, cat] = await Promise.all([api.admin.siteLinks(), api.admin.siteLinkProviders()]);
      setLinks(res.links || []);
      setRedes(cat.providers || []);
      if (!selectedSocial && cat.providers?.length) setSelectedSocial(cat.providers[0].id);
    } catch (err: any) {
      showToast(`${t('adminLinks.loadError')} ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const redActual = redes.find((r) => r.id === selectedSocial);

  const handleCreateSocial = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSocial(true);
    try {
      const res = await api.admin.createSiteLink({
        kind: 'SOCIAL',
        provider: selectedSocial,
        url: networkUrl.trim(),
      });
      setLinks(res.links || []);
      setNetworkUrl('');
      showToast(t('adminLinks.created'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setCreatingSocial(false);
    }
  };

  const handleCreateSite = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingSite(true);
    try {
      const res = await api.admin.createSiteLink({
        kind: 'FRIEND',
        label: siteName.trim(),
        url: siteUrl.trim(),
        description: siteDesc.trim(),
        descriptionEs: siteDescEs.trim(),
      });
      setLinks(res.links || []);
      setSiteName('');
      setSiteUrl('');
      setSiteDesc('');
      setSiteDescEs('');
      showToast(t('adminLinks.created'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setCreatingSite(false);
    }
  };

  const update = async (id: string, changes: Partial<SiteLink>) => {
    try {
      const res = await api.admin.updateSiteLink(id, changes);
      setLinks(res.links || []);
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    }
  };

  const handleDelete = () => {
    if (!toDelete) return;
    const link = toDelete;
    setToDelete(null);
    setLinks((prev) => prev.filter((l) => l.id !== link.id));
    showUndoToast(t('common.deletingItem', { name: link.label }), {
      onUndo: () => setLinks((prev) => [...prev, link]),
      onExpire: async () => {
        try {
          const res = await api.admin.deleteSiteLink(link.id);
          setLinks(res.links || []);
          showToast(t('adminLinks.deleted'), 'success');
        } catch (err: any) {
          setLinks((prev) => [...prev, link]);
          showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
        }
      },
    });
  };

  /**
   * Move within its group by swapping order with the neighbor, rather than
   * renumbering the entire list: two writes instead of N and the same result.
   */
  const mover = async (link: SiteLink, direction: -1 | 1) => {
    const group = links.filter((l) => l.kind === link.kind);
    const i = group.findIndex((l) => l.id === link.id);
    const neighbor = group[i + direction];
    if (!neighbor) return;

    try {
      await api.admin.updateSiteLink(link.id, { sortOrder: neighbor.sortOrder });
      const res = await api.admin.updateSiteLink(neighbor.id, { sortOrder: link.sortOrder });
      setLinks(res.links || []);
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    }
  };

  const handleLogoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Always cleared: without this, retrying with the same file after a failure
    // does not trigger the event and makes the button appear non-responsive.
    e.target.value = '';
    const id = idParaLogo.current;
    if (!file || !id) return;

    setUploadingLogo(id);
    try {
      const formData = new FormData();
      formData.append('icon', file);
      const res = await api.admin.uploadSiteLinkIcon(id, formData);
      setLinks(res.links || []);
      showToast(t('adminLinks.iconUploaded'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setUploadingLogo(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    const link = links.find((l) => l.id === editing.id);
    if (!link) return setEditing(null);
    // A social network only changes address: name and icon are provided by the catalog.
    const changes: Partial<SiteLink> =
      link.kind === 'SOCIAL'
        ? { url: editing.url.trim() }
        : {
            label: editing.label.trim(),
            url: editing.url.trim(),
            description: editing.description.trim(),
            descriptionEs: editing.descriptionEs.trim(),
          };
    setSavingEdit(true);
    try {
      const res = await api.admin.updateSiteLink(link.id, changes);
      setLinks(res.links || []);
      setEditing(null);
      showToast(t('adminLinks.updated'), 'success');
    } catch (err: any) {
      showToast(`${t('adminLinks.saveError')} ${err.message}`, 'error');
    } finally {
      setSavingEdit(false);
    }
  };

  const editField = (valor: string, onChange: (v: string) => void, extra: Record<string, unknown>) => (
    <input
      value={valor}
      onChange={(e) => onChange(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') saveEdit();
        if (e.key === 'Escape') setEditing(null);
      }}
      spellCheck={false}
      autoComplete="off"
      className="w-full px-2.5 py-1.5 rounded-[5px] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-[var(--text-primary)] text-xs"
      {...extra}
    />
  );

  /** Row text, or its fields when being edited. */
  const body = (link: SiteLink) => {
    if (editing?.id === link.id) {
      const social = link.kind === 'SOCIAL';
      return (
        <div className="min-w-0 flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-2">
          {social ? (
            <div className="text-xs font-bold text-[var(--text-primary)] self-center truncate">{link.label}</div>
          ) : (
            editField(editing.label, (v) => setEditing({ ...editing, label: v }), {
              maxLength: 60,
              placeholder: t('adminLinks.label'),
              'aria-label': t('adminLinks.label'),
            })
          )}
          {editField(editing.url, (v) => setEditing({ ...editing, url: v }), {
            type: 'url',
            inputMode: 'url',
            placeholder: t('adminLinks.url'),
            'aria-label': t('adminLinks.url'),
          })}
          {!social &&
            editField(editing.description, (v) => setEditing({ ...editing, description: v }), {
              maxLength: 160,
              placeholder: t('adminLinks.description'),
              'aria-label': t('adminLinks.description'),
            })}
          {!social &&
            editField(editing.descriptionEs, (v) => setEditing({ ...editing, descriptionEs: v }), {
              maxLength: 160,
              placeholder: t('adminLinks.descriptionEs'),
              'aria-label': t('adminLinks.descriptionEs'),
            })}
        </div>
      );
    }
    return (
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-[var(--text-primary)] truncate">{link.label}</div>
        {linkUrl(link)}
        {link.description ? (
          <div className="text-[11px] text-[var(--text-secondary)] line-clamp-1">{link.description}</div>
        ) : null}
      </div>
    );
  };

  /** Controls shared by both lists: order, visibility, edit, and delete. */
  const controles = (link: SiteLink, i: number, total: number) =>
    editing?.id === link.id ? (
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={saveEdit}
          disabled={savingEdit}
          aria-label={t('common.save')}
          title={t('common.save')}
          className="p-1.5 rounded-[5px] text-emerald-400 hover:bg-emerald-500/10 disabled:opacity-50 cursor-pointer transition-colors"
        >
          {savingEdit ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
        </button>
        <button
          onClick={() => setEditing(null)}
          aria-label={t('common.cancel')}
          title={t('common.cancel')}
          className="p-1.5 rounded-[5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    ) : (
    <div className="flex items-center gap-1 shrink-0">
      <button
        onClick={() => mover(link, -1)}
        disabled={i === 0}
        aria-label={t('adminLinks.moveUp')}
        title={t('adminLinks.moveUp')}
        className="p-1.5 rounded-[5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-30 cursor-pointer transition-colors"
      >
        <ChevronUp className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={() => mover(link, 1)}
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
          checked={!!link.isEnabled}
          onChange={(e) => update(link.id, { isEnabled: e.target.checked })}
          className="accent-[var(--accent-primary)] cursor-pointer"
        />
        <span className="text-[11px] font-semibold text-[var(--text-secondary)]">
          {t('adminLinks.visible')}
        </span>
      </label>

      <button
        onClick={() =>
          setEditing({
            id: link.id,
            label: link.label,
            url: link.url,
            description: link.description || '',
            descriptionEs: link.descriptionEs || '',
          })
        }
        aria-label={t('adminLinks.edit')}
        title={t('adminLinks.edit')}
        className="p-1.5 rounded-[5px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
      >
        <Pencil className="w-3.5 h-3.5" />
      </button>

      <button
        onClick={() => setToDelete(link)}
        aria-label={t('adminLinks.delete')}
        title={t('adminLinks.delete')}
        className="p-1.5 rounded-[5px] text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
    );

  const baseRow = (link: SiteLink) =>
    `flex items-center gap-3 p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] transition-opacity ${
      link.isEnabled ? '' : 'opacity-50'
    }`;

  const linkUrl = (link: SiteLink) => (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[11px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors flex items-center gap-1"
    >
      <span className="truncate">{link.url}</span>
      <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
    </a>
  );

  const sociales = links.filter((l) => l.kind === 'SOCIAL');
  const sites = links.filter((l) => l.kind === 'FRIEND');

  return (
    <>
      <input
        ref={logoInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={handleLogoSelected}
      />

      {loading ? (
        <div className="glass-card p-8 flex items-center justify-center gap-2 xl:col-span-2">
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
              onSubmit={handleCreateSocial}
              className="grid grid-cols-1 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)_auto] gap-3 items-end"
            >
              <div className="space-y-1.5 min-w-0">
                <label className="text-[11px] font-semibold text-[var(--text-secondary)] block">
                  {t('adminLinks.network')}
                </label>
                <CustomSelect
                  value={selectedSocial}
                  onChange={setSelectedSocial}
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
                  value={networkUrl}
                  onChange={(e) => setNetworkUrl(e.target.value)}
                  required
                  spellCheck={false}
                  autoComplete="off"
                  placeholder={redActual?.example || 'https://…'}
                  className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs font-mono"
                />
              </div>

              <button type="submit" disabled={creatingSocial} className="btn-primary shrink-0">
                {creatingSocial ? (
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
                {sociales.map((link, i) => (
                  <li key={link.id} className={baseRow(link)}>
                    <span className="w-8 h-8 rounded-[5px] border border-[var(--border-subtle)] bg-[var(--bg-app)] flex items-center justify-center shrink-0">
                      {link.iconUrl ? (
                        <BrandIcon
                          icon={link.iconUrl}
                          iconDark={redes.find((r) => r.id === link.provider)?.iconDark}
                          size={18}
                          className="w-[18px] h-[18px]"
                        />
                      ) : (
                        <Globe className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
                      )}
                    </span>

                    {/* min-w-0: without it, a long URL pushes the buttons out of the row */}
                    {body(link)}

                    {controles(link, i, sociales.length)}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ======================= SITIOS RECOMENDADOS ======================= */}
          <section className="glass-card p-5 space-y-4 xl:col-span-2">
            <div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                {t('adminLinks.friendTitle')}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {t('adminLinks.friendHelp')}
              </p>
            </div>

            <form onSubmit={handleCreateSite} className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="space-y-1.5 min-w-0">
                  <label
                    htmlFor="nombre-sitio"
                    className="text-[11px] font-semibold text-[var(--text-secondary)] block"
                  >
                    {t('adminLinks.label')}
                  </label>
                  <input
                    id="nombre-sitio"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
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
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
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
                    value={siteDesc}
                    onChange={(e) => setSiteDesc(e.target.value)}
                    maxLength={160}
                    autoComplete="off"
                    placeholder={t('adminLinks.descriptionPlaceholder')}
                    className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs"
                  />
                </div>

                <div className="space-y-1.5 min-w-0">
                  <label
                    htmlFor="desc-sitio-es"
                    className="text-[11px] font-semibold text-[var(--text-secondary)] block"
                  >
                    {t('adminLinks.descriptionEs')}
                  </label>
                  <input
                    id="desc-sitio-es"
                    lang="es"
                    value={siteDescEs}
                    onChange={(e) => setSiteDescEs(e.target.value)}
                    maxLength={160}
                    autoComplete="off"
                    placeholder={t('adminLinks.descriptionEsPlaceholder')}
                    className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)] text-xs"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-[11px] text-[var(--text-muted)]">{t('adminLinks.logoHint')}</p>
                <button type="submit" disabled={creatingSite} className="btn-primary shrink-0">
                  {creatingSite ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{t('adminLinks.add')}</span>
                </button>
              </div>
            </form>

            {sites.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] py-2">{t('adminLinks.emptyFriend')}</p>
            ) : (
              <ul className="space-y-2">
                {sites.map((link, i) => (
                  <li key={link.id} className={baseRow(link)}>
                    {/* The logo is the upload button: that's where one looks when
                        wanting to change it, and an empty slot shows it is missing. */}
                    <button
                      onClick={() => {
                        idParaLogo.current = link.id;
                        logoInputRef.current?.click();
                      }}
                      disabled={uploadingLogo === link.id}
                      title={t('adminLinks.uploadIcon')}
                      aria-label={`${t('adminLinks.uploadIcon')}: ${link.label}`}
                      className="group relative w-11 h-11 rounded-[5px] border border-[var(--border-subtle)] bg-[var(--bg-app)] overflow-hidden shrink-0 cursor-pointer hover:border-[var(--accent-primary)] transition-colors"
                    >
                      {link.iconUrl ? (
                        <img
                          src={link.iconUrl}
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
                        {uploadingLogo === link.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        ) : (
                          <ImagePlus className="w-4 h-4" aria-hidden="true" />
                        )}
                      </span>
                    </button>

                    {body(link)}

                    {controles(link, i, sites.length)}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}

      <ConfirmModal
        isOpen={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={handleDelete}
        title={t('adminLinks.deleteTitle')}
        description={t('adminLinks.deleteMessage', { label: toDelete?.label || '' })}
        confirmText={t('adminLinks.delete')}
        variant="danger"
      />
    </>
  );
}
