'use client';

import React, { useEffect, useState } from 'react';
import { Users, Globe, EyeOff, Eye, Bell, Save, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/components/ToastProvider';

type Config = { minVotes: number; voterMinAgeDays: number; voterMinActiveDays: number };
type Consensus = {
  key: string;
  plexTitle: string;
  plexSeason: number;
  anilistMediaId: number;
  anilistTitle: string | null;
  voters: string[];
  dismissed: boolean;
  globalAnilistMediaId: number | null;
};

const CONFIG_FIELDS: { name: keyof Config; label: string; min: number; max: number }[] = [
  { name: 'minVotes', label: 'admin.communityMinVotes', min: 2, max: 50 },
  { name: 'voterMinAgeDays', label: 'admin.communityMinAgeDays', min: 0, max: 365 },
  { name: 'voterMinActiveDays', label: 'admin.communityMinActiveDays', min: 0, max: 365 },
];

/**
 * Community consensus review: promote an answer to an official global
 * mapping, dismiss it so it is never applied, and tune who counts as a voter.
 */
export function CommunityConsensusSection({ onGlobalChanged }: { onGlobalChanged: () => void }) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [draft, setDraft] = useState<Config | null>(null);
  const [list, setList] = useState<Consensus[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await api.communityMappings.getAdmin();
      setConfig(res.config);
      setDraft(res.config);
      setList(res.consensus || []);
    } catch (e: any) {
      showToast(e?.message || t('admin.communityLoadError'), 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const run = async (key: string, fn: () => Promise<unknown>, success: string) => {
    setBusyKey(key);
    try {
      await fn();
      if (success) showToast(success, 'success');
      await load();
    } catch (e: any) {
      showToast(e?.message || t('admin.communityActionError'), 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const configDirty = !!config && !!draft && CONFIG_FIELDS.some((f) => config[f.name] !== draft[f.name]);

  return (
    <div className="glass-card p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-400" aria-hidden="true" />
            {t('admin.communityTitle')}
          </h2>
          <p className="text-xs text-[var(--text-secondary)] max-w-2xl">{t('admin.communitySubtitle')}</p>
        </div>
        <button
          type="button"
          className="btn-secondary text-xs shrink-0"
          disabled={busyKey !== null}
          onClick={() =>
            run('notify', async () => {
              const res = await api.communityMappings.notifyNow();
              showToast(t('admin.communityNotified', { n: res.sent }), 'info');
            }, '')
          }
        >
          {busyKey === 'notify' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Bell className="w-3.5 h-3.5" />}
          <span>{t('admin.communityNotify')}</span>
        </button>
      </div>

      {draft && (
        <form
          className="flex flex-wrap items-end gap-3 p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]"
          onSubmit={(e) => {
            e.preventDefault();
            run('config', () => api.communityMappings.updateConfig(draft), t('admin.communityConfigSaved'));
          }}
        >
          {CONFIG_FIELDS.map((f) => (
            <label key={f.name} className="flex flex-col gap-1 text-xs text-[var(--text-secondary)]">
              <span>{t(f.label)}</span>
              <input
                type="number"
                min={f.min}
                max={f.max}
                value={draft[f.name]}
                onChange={(e) => setDraft({ ...draft, [f.name]: parseInt(e.target.value, 10) || 0 })}
                className="w-28 h-9 px-3 text-center rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-app)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
              />
            </label>
          ))}
          <button type="submit" className="btn-primary text-xs h-9" disabled={!configDirty || busyKey !== null}>
            {busyKey === 'config' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            <span>{t('admin.communitySaveConfig')}</span>
          </button>
        </form>
      )}

      {loading ? (
        <div className="py-8 flex justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--accent-text)]" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-xs text-[var(--text-muted)] py-4 text-center">{t('admin.communityEmpty')}</p>
      ) : (
        <ul className="divide-y divide-[var(--border-subtle)]">
          {list.map((c) => {
            const isGlobal = c.globalAnilistMediaId === c.anilistMediaId;
            const globalDiffers = c.globalAnilistMediaId !== null && !isGlobal;
            return (
              <li key={c.key} className={`py-3 flex flex-col md:flex-row md:items-center gap-3 ${c.dismissed ? 'opacity-60' : ''}`}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="text-sm font-semibold text-[var(--text-primary)] break-words">
                    {c.plexTitle}
                    {c.plexSeason > 1 && <span className="text-[var(--text-muted)]"> · {t('notif.season', { n: c.plexSeason })}</span>}
                    <span className="text-[var(--text-muted)]"> → </span>
                    <a
                      href={`https://anilist.co/anime/${c.anilistMediaId}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[var(--accent-text)] hover:underline"
                    >
                      {c.anilistTitle || `AniList #${c.anilistMediaId}`}
                    </a>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-[var(--text-secondary)]">
                    <span>{t('admin.communityVotes', { n: c.voters.length, users: c.voters.join(', ') })}</span>
                    {c.dismissed && <span className="badge-status-neutral">{t('admin.communityDismissed')}</span>}
                    {isGlobal && <span className="badge-status-success">{t('admin.communityAlreadyGlobal')}</span>}
                    {globalDiffers && <span className="badge-status-warning">{t('admin.communityGlobalDiffers')}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!isGlobal && !c.dismissed && (
                    <button
                      type="button"
                      className="btn-secondary text-xs"
                      disabled={busyKey !== null}
                      onClick={() =>
                        run(c.key, async () => {
                          await api.communityMappings.promote(c.key);
                          onGlobalChanged();
                        }, t('admin.communityPromoted'))
                      }
                    >
                      {busyKey === c.key ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Globe className="w-3.5 h-3.5 text-amber-400" />}
                      <span>{t('admin.communityPromote')}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn-secondary text-xs"
                    disabled={busyKey !== null}
                    onClick={() =>
                      run(
                        c.key + ':dismiss',
                        () => api.communityMappings.dismiss(c.key, !c.dismissed),
                        c.dismissed ? t('admin.communityRestored') : t('admin.communityDismissedToast'),
                      )
                    }
                  >
                    {c.dismissed ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    <span>{c.dismissed ? t('admin.communityRestore') : t('admin.communityDismiss')}</span>
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
