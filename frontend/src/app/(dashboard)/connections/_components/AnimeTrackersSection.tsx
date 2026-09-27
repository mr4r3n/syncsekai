'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ShieldCheck } from 'lucide-react';

interface AnimeTrackersSectionProps {
  hubData: any;
  isAnilistConnected: boolean;
  isMalConnected: boolean;
  isKitsuConnected: boolean;
  setShowAnilistModal: (show: boolean) => void;
  setShowMalModal: (show: boolean) => void;
  setShowKitsuModal: (show: boolean) => void;
  loadHubData: (silent?: boolean) => Promise<void>;
}

export function AnimeTrackersSection({
  hubData,
  isAnilistConnected,
  isMalConnected,
  isKitsuConnected,
  setShowAnilistModal,
  setShowMalModal,
  setShowKitsuModal,
  loadHubData,
}: AnimeTrackersSectionProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [malAvatarError, setMalAvatarError] = useState(false);
  const [anilistAvatarError, setAnilistAvatarError] = useState(false);

  const handleDisconnectAnilist = async () => {
    if (!confirm(t('connections.confirmDisconnectAniList'))) return;
    try {
      await api.anilist.disconnect();
      showToast(t('connections.aniListDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectAniListError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectMal = async () => {
    if (!confirm(t('connections.confirmDisconnectMal'))) return;
    try {
      await api.mal.disconnect();
      showToast(t('connections.malDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectMalError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectKitsu = async () => {
    if (!confirm(t('connections.confirmDisconnectKitsu'))) return;
    try {
      await api.kitsu.disconnect();
      showToast(t('connections.kitsuDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectKitsuError')} ` + err.message, 'error');
    }
  };

  return (
    <section className="space-y-4">
      {/* Anime Section Header */}
      <div className="space-y-1">
        <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('connections.linkedAnimeAccounts')}</h2>
        <p className="text-xs text-[var(--text-secondary)]">{t('connections.bothAtOnce')}</p>
      </div>

      {/* Grid with AniList, MyAnimeList, and Kitsu side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {/* 2.1 Tarjeta AniList */}
        <div className="glass-card card-sin-borde-movil p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {isAnilistConnected && hubData?.anilist?.avatarUrl && !anilistAvatarError ? (
                  <img
                    src={hubData.anilist.avatarUrl}
                    alt="Avatar AniList"
                    onError={() => setAnilistAvatarError(true)}
                    className="w-11 h-11 rounded-[6px] object-cover border border-sky-400/40 shadow-sm shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-[6px] flex items-center justify-center font-bold text-sm text-white shadow-sm shrink-0"
                    style={{ backgroundColor: isAnilistConnected ? 'var(--brand-anilist)' : 'var(--border-subtle)' }}
                  >
                    AL
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">AniList (GraphQL API)</span>
                    {isAnilistConnected && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {hubData?.anilist?.lastLatencyMs || 10}ms
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-mono font-bold block ${
                      isAnilistConnected ? 'text-[var(--brand-anilist)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {isAnilistConnected
                      ? `@${hubData?.anilist?.remoteUsername || hubData?.anilist?.username || t('common.user')}`
                      : t('connections.unlinkedHandle')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
              <ShieldCheck
                className={`w-3.5 h-3.5 ${isAnilistConnected ? 'text-sky-400' : 'text-[var(--text-muted)]'}`}
              />
              <span>
                {isAnilistConnected
                  ? t('connections.tokenValidId', { id: hubData?.anilist?.remoteUserId || t('connections.detecting') })
                  : t('connections.requiresAuth')}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5">
            {hubData?.anilist?.needsReconnection ? (
              <span className="badge-pill bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-semibold">{t('connections.reconnectionRequired')}</span>
            ) : (
              <span className={isAnilistConnected ? 'badge-status-success' : 'badge-pill'}>
                ● {isAnilistConnected ? t('connections.syncOk') : t('connections.inactive')}
              </span>
            )}

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {isAnilistConnected && (
                <button
                  onClick={handleDisconnectAnilist}
                  className="btn-danger text-xs"
                >
                  {t('connections.disconnect')}
                </button>
              )}

              <button
                onClick={() => setShowAnilistModal(true)}
                className={`text-xs ${
                  hubData?.anilist?.needsReconnection
                    ? 'btn-primary bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse shadow-md'
                    : 'btn-primary'
                }`}
              >
                {hubData?.anilist?.needsReconnection
                  ? t('connections.reconnectNow')
                  : isAnilistConnected
                  ? t('connections.reauthenticate')
                  : t('connections.linkAniList')}
              </button>
            </div>
          </div>
        </div>

        {/* 2.2 Tarjeta MyAnimeList */}
        <div className="glass-card card-sin-borde-movil p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {isMalConnected && hubData?.mal?.avatarUrl && !malAvatarError ? (
                  <img
                    src={hubData.mal.avatarUrl}
                    alt="Avatar MAL"
                    onError={() => setMalAvatarError(true)}
                    className="w-11 h-11 rounded-[6px] object-cover border border-indigo-400/40 shadow-sm shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-[6px] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0"
                    style={{ backgroundColor: isMalConnected ? 'var(--brand-mal)' : 'var(--border-subtle)' }}
                  >
                    MAL
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">MyAnimeList (REST v2)</span>
                    {isMalConnected && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {hubData?.mal?.lastLatencyMs || 10}ms
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-mono font-bold block ${
                      isMalConnected ? 'text-[var(--brand-mal)]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {isMalConnected
                      ? `@${hubData?.mal?.remoteUsername || hubData?.mal?.username || t('common.user')}`
                      : t('connections.unlinkedHandle')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
              <ShieldCheck
                className={`w-3.5 h-3.5 ${isMalConnected ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}
              />
              <span>
                {isMalConnected ? t('connections.tokenValidSession') : t('connections.requiresAuth')}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5">
            {hubData?.mal?.needsReconnection ? (
              <span className="badge-pill bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-semibold">{t('connections.reconnectionRequired')}</span>
            ) : (
              <span className={isMalConnected ? 'badge-status-success' : 'badge-pill'}>
                ● {isMalConnected ? t('connections.syncOk') : t('connections.inactive')}
              </span>
            )}

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {isMalConnected && (
                <button
                  onClick={handleDisconnectMal}
                  className="btn-danger text-xs"
                >
                  {t('connections.disconnect')}
                </button>
              )}

              <button
                onClick={() => setShowMalModal(true)}
                className={`text-xs ${
                  hubData?.mal?.needsReconnection
                    ? 'btn-primary bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse shadow-md'
                    : 'btn-primary'
                }`}
              >
                {hubData?.mal?.needsReconnection
                  ? t('connections.reconnectNow')
                  : isMalConnected
                  ? t('connections.reauthenticate')
                  : t('connections.linkMal')}
              </button>
            </div>
          </div>
        </div>

        {/* 2.3 Tarjeta Kitsu */}
        <div className="glass-card card-sin-borde-movil p-4 sm:p-5 space-y-4 flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                {isKitsuConnected && hubData?.kitsu?.avatarUrl ? (
                  <img
                    src={hubData.kitsu.avatarUrl}
                    alt="Avatar Kitsu"
                    className="w-11 h-11 rounded-[6px] object-cover border border-[#fd755c]/40 shadow-sm shrink-0"
                  />
                ) : (
                  <div
                    className="w-11 h-11 rounded-[6px] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0"
                    style={{ backgroundColor: isKitsuConnected ? '#fd755c' : 'var(--border-subtle)' }}
                  >
                    KT
                  </div>
                )}
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">Kitsu (JSON:API v2)</span>
                    {isKitsuConnected && (
                      <span className="text-[10px] font-mono text-emerald-400 font-bold">
                        {hubData?.kitsu?.lastLatencyMs || 15}ms
                      </span>
                    )}
                  </div>
                  <span
                    className={`text-xs font-mono font-bold block ${
                      isKitsuConnected ? 'text-[#fd755c]' : 'text-[var(--text-muted)]'
                    }`}
                  >
                    {isKitsuConnected
                      ? `@${hubData?.kitsu?.remoteUsername || hubData?.kitsu?.username || t('common.user')}`
                      : t('connections.unlinkedHandle')}
                  </span>
                </div>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
              <ShieldCheck
                className={`w-3.5 h-3.5 ${isKitsuConnected ? 'text-[#fd755c]' : 'text-[var(--text-muted)]'}`}
              />
              <span>
                {isKitsuConnected ? t('connections.tokenValidSync') : t('connections.requiresAuth')}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5">
            {hubData?.kitsu?.needsReconnection ? (
              <span className="badge-pill bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-semibold">{t('connections.reconnectionRequired')}</span>
            ) : (
              <span className={isKitsuConnected ? 'badge-status-success' : 'badge-pill'}>
                ● {isKitsuConnected ? t('connections.syncOk') : t('connections.inactive')}
              </span>
            )}

            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              {isKitsuConnected && (
                <button
                  onClick={handleDisconnectKitsu}
                  className="btn-danger text-xs"
                >
                  {t('connections.disconnect')}
                </button>
              )}

              <button
                onClick={() => setShowKitsuModal(true)}
                className={`text-xs ${
                  hubData?.kitsu?.needsReconnection
                    ? 'btn-primary bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse shadow-md'
                    : 'btn-primary'
                }`}
              >
                {hubData?.kitsu?.needsReconnection
                  ? t('connections.reconnectNow')
                  : isKitsuConnected
                  ? t('connections.reauthenticate')
                  : t('connections.linkKitsu')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
