import React from 'react';
import { Edit3, Check, Globe, ExternalLink, Trash2, Film } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';

interface MappingActionSheetProps {
  activeMappingSheetItem: any;
  setActiveMappingSheetItem: (item: any) => void;
  currentUser: any;
  handleOpenEditModal: (item: any) => void;
  handleApprove: (id: string) => Promise<void>;
  handleToggleGlobal: (id: string) => Promise<void>;
  handleUnlink: (item: any) => void;
  t: (key: string, params?: any) => string;
}

export function MappingActionSheet({
  activeMappingSheetItem,
  setActiveMappingSheetItem,
  currentUser,
  handleOpenEditModal,
  handleApprove,
  handleToggleGlobal,
  handleUnlink,
  t,
}: MappingActionSheetProps) {
  return (
    <BottomSheet
      isOpen={!!activeMappingSheetItem}
      onClose={() => setActiveMappingSheetItem(null)}
      title={activeMappingSheetItem.plexTitle}
      subtitle={`${t('mappings.seasonPrefix')}${activeMappingSheetItem.plexSeason || 1} • AniList: ${activeMappingSheetItem.anilistTitle || activeMappingSheetItem.plexTitle}`}
      headerImage={
        activeMappingSheetItem.coverImage ? (
          <img
            src={activeMappingSheetItem.coverImage}
            alt={activeMappingSheetItem.anilistTitle || activeMappingSheetItem.plexTitle}
            className="w-10 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
          />
        ) : (
          <div className="w-10 h-14 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        )
      }
      headerBadge={
        <span
          className={
            activeMappingSheetItem.isApproved
              ? 'badge-action-success text-[10px] font-mono'
              : 'badge-action-warning text-[10px] font-mono'
          }
        >
          {activeMappingSheetItem.isApproved ? t('mappings.linked') : t('mappings.pending')}
        </span>
      }
      actions={[
        {
          label: t('mappings.editMapping'),
          sublabel: t('mappings.searchAndChangeAnime'),
          icon: Edit3,
          iconColor: 'text-[var(--accent-text)]',
          onClick: () => handleOpenEditModal(activeMappingSheetItem),
        },
        ...(!activeMappingSheetItem.isApproved
          ? [
              {
                label: t('mappings.approveLink'),
                sublabel: t('mappings.confirmForImmediateSync'),
                icon: Check,
                variant: 'success' as const,
                onClick: () => handleApprove(activeMappingSheetItem.id),
              },
            ]
          : []),
        ...(currentUser?.role === 'ADMIN'
          ? [
              {
                label: activeMappingSheetItem.isGlobal ? 'Revocar Mapeo Global' : t('mappings.promoteToGlobal'),
                sublabel: activeMappingSheetItem.isGlobal
                  ? t('mappings.revertToUserMapping')
                  : t('mappings.makeVisibleToAll'),
                icon: Globe,
                iconColor: 'text-amber-400',
                onClick: () => handleToggleGlobal(activeMappingSheetItem.id),
              },
            ]
          : []),
        ...(activeMappingSheetItem.anilistMediaId
          ? [
              {
                label: t('mappings.viewOnAniList'),
                sublabel: `ID: #${activeMappingSheetItem.anilistMediaId}`,
                icon: ExternalLink,
                iconColor: 'text-[var(--brand-anilist)]',
                onClick: () => {
                  window.open(`https://anilist.co/anime/${activeMappingSheetItem.anilistMediaId}`, '_blank');
                },
              },
            ]
          : []),
        {
          label: t('mappings.deleteMapping'),
          sublabel: t('mappings.unlinkAndDelete'),
          icon: Trash2,
          variant: 'danger' as const,
          onClick: () => handleUnlink(activeMappingSheetItem),
        },
      ]}
    />
  );
}
