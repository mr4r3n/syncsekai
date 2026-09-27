'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { Database } from 'lucide-react';

interface AnimeModalSyncFooterProps {
  selectedAnime: any;
  catalogResponse: any;
  isJellyfinServerConnected: boolean;
  isEmbyServerConnected: boolean;
  isPlexServerConnected: boolean;
  isAnilistActive: boolean;
  isMalActive: boolean;
  isKitsuActive: boolean;
}

export function AnimeModalSyncFooter({
  selectedAnime,
  catalogResponse,
  isJellyfinServerConnected,
  isEmbyServerConnected,
  isPlexServerConnected,
  isAnilistActive,
  isMalActive,
  isKitsuActive,
}: AnimeModalSyncFooterProps) {
  const { t } = useI18n();

  return (
    <div className="p-3.5 sm:p-5 pt-2 relative z-10 shrink-0 mt-auto">
      <div className="p-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs shadow-sm">
        <div className="flex items-center gap-2 text-[11px] font-semibold text-[var(--text-primary)]">
          <Database className="w-3.5 h-3.5 text-[#01bcf3]" />
          <span>{t('catalog.syncLabel')}</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap text-[11px]">
          {/* Local State if no tracker is linked */}
          {!selectedAnime.anilistId && !selectedAnime.malId && !selectedAnime.kitsuId && (
            <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border border-amber-500/30 bg-amber-500/10 text-amber-400 font-medium">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{t('catalog.localNoTrackers')}</span>
            </div>
          )}

          {/* Jellyfin */}
          {(selectedAnime.syncedJellyfin || isJellyfinServerConnected) && (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                selectedAnime.syncedJellyfin
                  ? 'border-[#00a4dc]/30 bg-[#00a4dc]/10 text-[#00a4dc]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedAnime.syncedJellyfin ? 'bg-[#00a4dc]' : 'bg-zinc-500'}`} />
              <span>Jellyfin {catalogResponse?.providers?.jellyfin?.serverName ? `(${catalogResponse.providers.jellyfin.serverName})` : ''}</span>
            </div>
          )}

          {/* Emby */}
          {(selectedAnime.syncedEmby || isEmbyServerConnected) && (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                selectedAnime.syncedEmby
                  ? 'border-[#52b54b]/30 bg-[#52b54b]/10 text-[#52b54b]'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedAnime.syncedEmby ? 'bg-[#52b54b]' : 'bg-zinc-500'}`} />
              <span>Emby {catalogResponse?.providers?.emby?.serverName ? `(${catalogResponse.providers.emby.serverName})` : ''}</span>
            </div>
          )}

          {/* Plex */}
          {(selectedAnime.syncedPlex || isPlexServerConnected) && (
            <div
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
                selectedAnime.syncedPlex
                  ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
                  : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${selectedAnime.syncedPlex ? 'bg-amber-400' : 'bg-zinc-500'}`} />
              <span>Plex {catalogResponse?.providers?.plex?.serverName ? `(${catalogResponse.providers.plex.serverName})` : ''}</span>
            </div>
          )}

          {/* AniList */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
              (selectedAnime.syncedAnilist || (selectedAnime.anilistId && selectedAnime.anilistId > 0)) && isAnilistActive
                ? 'border-sky-500/30 bg-sky-500/10 text-sky-400'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${(selectedAnime.syncedAnilist || (selectedAnime.anilistId && selectedAnime.anilistId > 0)) && isAnilistActive ? 'bg-sky-400' : 'bg-zinc-500'}`} />
            <span>AniList {isAnilistActive && catalogResponse?.providers?.anilist?.username ? `(@${catalogResponse.providers.anilist.username})` : ''}</span>
          </div>

          {/* MyAnimeList */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
              (selectedAnime.syncedMal || selectedAnime.malId) && isMalActive
                ? 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${(selectedAnime.syncedMal || selectedAnime.malId) && isMalActive ? 'bg-indigo-400' : 'bg-zinc-500'}`} />
            <span>MAL {isMalActive && catalogResponse?.providers?.mal?.username ? `(@${catalogResponse.providers.mal.username})` : ''}</span>
          </div>

          {/* Kitsu */}
          <div
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] border transition-colors font-medium ${
              (selectedAnime.syncedKitsu || selectedAnime.kitsuId) && isKitsuActive
                ? 'border-[#fd755c]/30 bg-[#fd755c]/10 text-[#fd755c]'
                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-60'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${(selectedAnime.syncedKitsu || selectedAnime.kitsuId) && isKitsuActive ? 'bg-[#fd755c]' : 'bg-zinc-500'}`} />
            <span>Kitsu {isKitsuActive && catalogResponse?.providers?.kitsu?.username ? `(@${catalogResponse.providers.kitsu.username})` : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
