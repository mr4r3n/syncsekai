import React from 'react';
import { Film, Globe, MoreVertical, Check, Edit3, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminMappingsListSectionProps {
  loading: boolean;
  /** Rows that match the filters, across every page. */
  total: number;
  paginatedMappings: any[];
  setActiveAdminMappingSheetItem: (item: any) => void;
  handleToggleGlobal: (id: string) => void;
  handleApprove: (id: string) => void;
  handleOpenEditModal: (item: any) => void;
  handleDelete: (item: any) => void;
}

export function AdminMappingsListSection({
  loading,
  total,
  paginatedMappings,
  setActiveAdminMappingSheetItem,
  handleToggleGlobal,
  handleApprove,
  handleOpenEditModal,
  handleDelete,
}: AdminMappingsListSectionProps) {
  const { t } = useI18n();

  return (
    <div className="divide-y divide-[var(--glass-border)]">
      {loading ? (
        [...Array(6)].map((_, i) => (
          <div key={i} className="py-4 px-2 sm:px-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
            <div className="flex items-start sm:items-center gap-3 sm:gap-4 flex-1">
              <div className="skeleton w-12 h-16 sm:w-12 sm:h-18 rounded-[6px] shrink-0" />
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <div className="skeleton h-4 w-44 rounded" />
                  <div className="skeleton h-4 w-24 rounded-full" />
                  <div className="skeleton h-4 w-20 rounded" />
                </div>
                <div className="skeleton h-3 w-64 rounded" />
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="skeleton h-8 w-24 rounded-[6px]" />
              <div className="skeleton h-8 w-24 rounded-[6px]" />
              <div className="skeleton h-8 w-8 rounded-[6px]" />
            </div>
          </div>
        ))
      ) : total === 0 ? (
        <div className="py-16 text-center text-xs font-mono text-[var(--text-muted)]">{t('admin.noMappingsForSelectedFilter')}</div>
      ) : (
        paginatedMappings.map((item) => {
          const isApproved = item.isApproved;

          return (
            <div
              key={item.id}
              className="py-4 px-2 sm:px-3 flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4 hover:bg-[var(--bg-surface-hover)] transition-colors rounded-[6px] group"
            >
              {/* LADO IZQUIERDO: PORTADA + DETALLES COMPLETOS */}
              <div className="flex items-start sm:items-center gap-3 sm:gap-4 min-w-0 flex-1">
                {item.coverImage ? (
                  <img
                    src={item.coverImage}
                    alt={item.anilistTitle || item.plexTitle}
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      if (item.anilistMediaId) {
                        e.currentTarget.src = `https://img.anili.st/media/${item.anilistMediaId}`;
                      } else {
                        e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                      }
                    }}
                    className="w-12 h-16 sm:w-12 sm:h-18 rounded-[6px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0"
                  />
                ) : (
                  <div className="w-12 h-16 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-center shrink-0 text-[var(--text-muted)] text-[10px] font-mono">
                    <Film className="w-4 h-4 text-[var(--text-muted)]" />
                  </div>
                )}

                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[var(--accent-text)] transition-colors leading-snug">
                      {item.plexTitle}
                    </h3>
                    <span className="badge-pill">
                      {t('catalog.seasonN', { n: item.plexSeason || 1 })}
                    </span>
                    {item.isGlobal && (
                      <span className="px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold bg-amber-500/20 text-amber-400 border border-amber-500/40 flex items-center gap-1 shadow-sm shrink-0">
                        <Globe className="w-3 h-3" /> {t('admin.globalOfficialUpper')}
                      </span>
                    )}
                    <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">
                      {t('admin.byAuthorWithAt', { author: item.user?.username || t('admin.system') })}
                    </span>
                  </div>

                  <p className="text-xs text-[var(--text-secondary)] font-mono flex items-center gap-2 flex-wrap">
                    <span className="text-sky-400 font-semibold">
                      AniList: {item.anilistTitle || item.plexTitle} (#{item.anilistMediaId})
                    </span>
                    {item.malMediaId && (
                      <>
                        <span className="text-[var(--text-muted)]">•</span>
                        <span className="text-purple-400">MAL: #{item.malMediaId}</span>
                      </>
                    )}
                    <span className="text-[var(--text-muted)]">•</span>
                    <span className="text-[var(--text-muted)]">
                      {t('admin.confidenceScore', { score: Math.round((item.confidenceScore || 0.95) * 100) })}
                    </span>
                  </p>
                </div>
              </div>

              {/* RIGHT SIDE ON MOBILE: BADGE + 3-DOT BUTTON */}
              <div className="flex md:hidden items-center justify-between gap-2 pt-2 border-t border-[var(--glass-border)]">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {item.isGlobal && (
                    <span className="badge-status-warning text-[10.5px]">
                      Global
                    </span>
                  )}
                  <span className={isApproved ? 'badge-action-success text-[10.5px]' : 'badge-action-warning text-[10.5px]'}>
                    {isApproved ? t('mappings.linked') : t('mappings.pending')}
                  </span>
                </div>

                <button
                  onClick={() => setActiveAdminMappingSheetItem(item)}
                  className="btn-secondary p-2 shrink-0 rounded-[8px]"
                  title={t('mappings.mappingOptions')}
                  aria-label={t('mappings.openMappingOptions')}
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
              </div>

              {/* LADO DERECHO EN ESCRITORIO (md:): ACCIONES ADMIN */}
              <div className="hidden md:flex items-center flex-wrap gap-2 shrink-0 justify-end">
                {/* Make Global / Revoke Global Button */}
                <button
                  onClick={() => handleToggleGlobal(item.id)}
                  className={`btn-secondary text-xs font-mono flex items-center gap-1.5 ${
                    item.isGlobal
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                      : ''
                  }`}
                  title={
                    item.isGlobal
                      ? t('admin.revokeOfficialGlobalStatus')
                      : t('admin.makeOfficialGlobal')
                  }
                >
                  <Globe className="w-3.5 h-3.5 text-amber-400" />
                  <span>{item.isGlobal ? t('admin.globalChecked') : t('mappings.makeGlobal')}</span>
                </button>

                {/* Approve Button (If pending) */}
                {!isApproved && (
                  <button
                    onClick={() => handleApprove(item.id)}
                    className="btn-primary flex items-center gap-1 text-xs"
                    title={t('admin.approveMappingTitle')}
                  >
                    <Check className="w-3 h-3 stroke-[3]" />
                    <span>{t('admin.approve')}</span>
                  </button>
                )}

                {/* Edit Button */}
                <button
                  onClick={() => handleOpenEditModal(item)}
                  className="btn-secondary btn-icon"
                  title={t('admin.editMappingLabel')}
                >
                  <Edit3 className="w-4 h-4 text-[var(--accent-text)]" />
                </button>

                {/* Delete Button */}
                <button
                  onClick={() => handleDelete(item)}
                  className="btn-danger btn-icon"
                  title={t('admin.deleteMappingPermanently')}
                >
                  <Trash2 className="w-4 h-4 text-rose-400" />
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
