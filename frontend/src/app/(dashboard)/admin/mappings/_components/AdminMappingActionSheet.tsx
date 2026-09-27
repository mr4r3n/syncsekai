import React from 'react';
import { Film, Edit3, Globe, Check, ExternalLink, Trash2 } from 'lucide-react';
import { BottomSheet } from '@/components/BottomSheet';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingActionSheetProps {
  activeAdminMappingSheetItem: any;
  setActiveAdminMappingSheetItem: (item: any) => void;
  handleOpenEditModal: (item: any) => void;
  handleToggleGlobal: (id: string) => void;
  handleApprove: (id: string) => void;
  handleDelete: (item: any) => void;
}

export function AdminMappingActionSheet({
  activeAdminMappingSheetItem,
  setActiveAdminMappingSheetItem,
  handleOpenEditModal,
  handleToggleGlobal,
  handleApprove,
  handleDelete,
}: AdminMappingActionSheetProps) {
  const { t } = useI18n();

  return (
    <BottomSheet
      isOpen={!!activeAdminMappingSheetItem}
      onClose={() => setActiveAdminMappingSheetItem(null)}
      title={activeAdminMappingSheetItem.plexTitle}
      subtitle={`Temporada ${activeAdminMappingSheetItem.plexSeason || 1} • Por: @${activeAdminMappingSheetItem.user?.username || 'Sistema'}`}
      headerImage={
        activeAdminMappingSheetItem.coverImage ? (
          <img
            src={activeAdminMappingSheetItem.coverImage}
            alt={activeAdminMappingSheetItem.anilistTitle || activeAdminMappingSheetItem.plexTitle}
            className="w-10 h-14 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
          />
        ) : (
          <div className="w-10 h-14 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0">
            <Film className="w-4 h-4 text-[var(--text-muted)]" />
          </div>
        )
      }
      headerBadge={
        <span
          className={
            activeAdminMappingSheetItem.isGlobal
              ? 'badge-status-warning text-[10px] font-mono'
              : 'badge-pill text-[10px] font-mono'
          }
        >
          {activeAdminMappingSheetItem.isGlobal ? 'Global Oficial' : 'Usuario'}
        </span>
      }
      actions={[
        {
          label: t('mappings.editMapping'),
          sublabel: t('admin.searchAndLinkAnotherAnime'),
          icon: Edit3,
          iconColor: 'text-[var(--accent-text)]',
          onClick: () => handleOpenEditModal(activeAdminMappingSheetItem),
        },
        {
          label: activeAdminMappingSheetItem.isGlobal ? 'Revocar Mapeo Global' : t('mappings.promoteToGlobal'),
          sublabel: activeAdminMappingSheetItem.isGlobal
            ? t('admin.revertToStandardMapping')
            : t('admin.masterMappingApplied'),
          icon: Globe,
          iconColor: 'text-amber-400',
          onClick: () => handleToggleGlobal(activeAdminMappingSheetItem.id),
        },
        ...(!activeAdminMappingSheetItem.isApproved
          ? [
              {
                label: 'Aprobar Mapeo',
                sublabel: t('admin.approveToEnableSync'),
                icon: Check,
                variant: 'success' as const,
                onClick: () => handleApprove(activeAdminMappingSheetItem.id),
              },
            ]
          : []),
        ...(activeAdminMappingSheetItem.anilistMediaId
          ? [
              {
                label: t('mappings.viewOnAniList'),
                sublabel: `AniList: ${activeAdminMappingSheetItem.anilistTitle || activeAdminMappingSheetItem.plexTitle} (#${activeAdminMappingSheetItem.anilistMediaId})`,
                icon: ExternalLink,
                iconColor: 'text-sky-400',
                onClick: () => {
                  window.open(`https://anilist.co/anime/${activeAdminMappingSheetItem.anilistMediaId}`, '_blank');
                },
              },
            ]
          : []),
        ...(activeAdminMappingSheetItem.malMediaId
          ? [
              {
                label: t('catalog.viewOnMal'),
                sublabel: `MAL ID: #${activeAdminMappingSheetItem.malMediaId}`,
                icon: ExternalLink,
                iconColor: 'text-purple-400',
                onClick: () => {
                  window.open(`https://myanimelist.net/anime/${activeAdminMappingSheetItem.malMediaId}`, '_blank');
                },
              },
            ]
          : []),
        {
          label: t('admin.deleteMappingPermanentlyTitle'),
          sublabel: t('admin.deleteMappingRuleDesc'),
          icon: Trash2,
          variant: 'danger' as const,
          onClick: () => handleDelete(activeAdminMappingSheetItem),
        },
      ]}
    />
  );
}
