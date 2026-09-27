'use client';

import {
  Film,
  Link2,
  RotateCcw,
  ExternalLink,
  Copy,
} from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { SyncStatus, type LinkedTrackers } from '@/components/SyncStatus';
import { syncLabels } from './utils';

interface HistoryBottomSheetProps {
  activeHistorySheetItem: any | null;
  setActiveHistorySheetItem: (item: any | null) => void;
  resolveCoverUrl: (cover: string | null) => string | null;
  linked: LinkedTrackers;
  handleDeleteAndRevert: (item: any) => void;
  router: any;
  showToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  t: (key: string, values?: any) => string;
}

export function HistoryBottomSheet({
  activeHistorySheetItem,
  setActiveHistorySheetItem,
  resolveCoverUrl,
  linked,
  handleDeleteAndRevert,
  router,
  showToast,
  t,
}: HistoryBottomSheetProps) {
  return (
    <>
      {/* NATIVE MOBILE BOTTOM SHEET FOR HISTORY */}
      {activeHistorySheetItem && (
        <BottomSheet
          isOpen={!!activeHistorySheetItem}
          onClose={() => setActiveHistorySheetItem(null)}
          title={activeHistorySheetItem.showTitle}
          subtitle={`${t('history.sheetEpisode', { n: activeHistorySheetItem.episodeNumber })} • ${
            activeHistorySheetItem.librarySectionTitle
              || (activeHistorySheetItem.source === 'JELLYFIN'
                ? 'Jellyfin'
                : activeHistorySheetItem.source === 'EMBY'
                ? 'Emby'
                : activeHistorySheetItem.source === 'PLEX'
                ? 'Plex'
                : t('history.libraryUnknown'))
          }`}
          headerImage={
            resolveCoverUrl(activeHistorySheetItem.coverImage) ? (
              <img
                src={resolveCoverUrl(activeHistorySheetItem.coverImage)!}
                alt={activeHistorySheetItem.showTitle}
                className="w-10 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
              />
            ) : (
              <div className="w-10 h-14 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
                <Film className="w-4 h-4 text-[var(--text-muted)]" />
              </div>
            )
          }
          headerBadge={
            <span className="badge-pill font-mono text-[10px]">
              {activeHistorySheetItem.seasonNumber && activeHistorySheetItem.seasonNumber > 1
                ? `T${activeHistorySheetItem.seasonNumber} Ep.${activeHistorySheetItem.episodeNumber}`
                : `Ep.${activeHistorySheetItem.episodeNumber}`}
            </span>
          }
          actions={[
            ...(!activeHistorySheetItem.isMapped && !activeHistorySheetItem.anilistMediaId && (activeHistorySheetItem.anilistStatus === 'SKIPPED' || activeHistorySheetItem.anilistStatus === 'FAILED' || activeHistorySheetItem.malStatus === 'FAILED')
              ? [
                  {
                    label: t('history.mapAnimeAction'),
                    sublabel: t('history.associateInMappings'),
                    icon: Link2,
                    iconColor: 'text-purple-400',
                    onClick: () => {
                      setActiveHistorySheetItem(null);
                      router.push(
                        `/mappings?search=${encodeURIComponent(activeHistorySheetItem.showTitle)}&season=${activeHistorySheetItem.seasonNumber || 1}`,
                      );
                    },
                  },
                ]
              : []),
            {
              label: t('history.revertScrobbleAction'),
              sublabel: t('history.subtractEpisodeDesc'),
              icon: RotateCcw,
              variant: 'danger',
              onClick: () => handleDeleteAndRevert(activeHistorySheetItem),
            },
            ...(activeHistorySheetItem.anilistMediaId
              ? [
                  {
                    label: t('mappings.viewOnAniList'),
                    sublabel: t('history.openAniListSheet', { id: activeHistorySheetItem.anilistMediaId }),
                    icon: ExternalLink,
                    iconColor: 'text-[var(--brand-anilist)]',
                    onClick: () => {
                      window.open(`https://anilist.co/anime/${activeHistorySheetItem.anilistMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            ...(activeHistorySheetItem.malMediaId
              ? [
                  {
                    label: t('catalog.viewOnMal'),
                    sublabel: t('history.openMalSheet', { id: activeHistorySheetItem.malMediaId }),
                    icon: ExternalLink,
                    iconColor: 'text-[var(--brand-mal)]',
                    onClick: () => {
                      window.open(`https://myanimelist.net/anime/${activeHistorySheetItem.malMediaId}`, '_blank');
                    },
                  },
                ]
              : []),
            {
              label: t('history.copyPlexTitle'),
              sublabel: activeHistorySheetItem.showTitle,
              icon: Copy,
              onClick: () => {
                navigator.clipboard.writeText(activeHistorySheetItem.showTitle);
                showToast(t('history.titleCopied'), 'info');
              },
            },
          ]}
        >
          {/* Status: three icons with indicator, and remainder in a gray line. */}
          <div className="space-y-2.5">
            <SyncStatus
              linked={linked}
              anilist={activeHistorySheetItem.anilistStatus}
              mal={activeHistorySheetItem.malStatus}
              kitsu={activeHistorySheetItem.kitsuStatus}
              labels={syncLabels(activeHistorySheetItem, t)}
            />
            <p className="text-[11px] font-mono text-[var(--text-muted)]">
              {Math.round(activeHistorySheetItem.viewPercentage || 95)}%{' '}
              {t('history.watchedSuffix')}
              {activeHistorySheetItem.rating ? ` · ★ ${activeHistorySheetItem.rating}/10` : ''}
            </p>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
