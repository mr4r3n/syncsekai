import React from 'react';
import { GitMerge, Search, Film, Globe, CheckCircle2, AlertCircle, Check, Edit3, Trash2 } from 'lucide-react';
import { ListRow, ListRows } from '@/components/ListRow';

interface MappingsListSectionProps {
  filteredMappings: any[];
  paginatedMappings: any[];
  searchFilter: string;
  handleSearchFilterChange: (val: string) => void;
  loading: boolean;
  currentUser: any;
  setActiveMappingSheetItem: (item: any) => void;
  handleApprove: (id: string) => Promise<void>;
  handleOpenEditModal: (item: any) => void;
  handleToggleGlobal: (id: string) => Promise<void>;
  handleUnlink: (item: any) => void;
  t: (key: string, params?: any) => string;
}

export function MappingsListSection({
  filteredMappings,
  paginatedMappings,
  searchFilter,
  handleSearchFilterChange,
  loading,
  currentUser,
  setActiveMappingSheetItem,
  handleApprove,
  handleOpenEditModal,
  handleToggleGlobal,
  handleUnlink,
  t,
}: MappingsListSectionProps) {
  return (
    <>
      {/* Cabecera & Barra de Filtros */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 px-3 sm:px-0 border-b border-[var(--glass-border)] gap-3">
        <div className="flex items-center gap-2.5">
          <GitMerge className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('mappings.activeAssociations')}</h2>
          <span className="text-xs text-[var(--text-muted)] font-mono">
            ({t('mappings.countLabel', { n: filteredMappings.length })})
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">

          {/* Input de Búsqueda */}
          <div className="relative flex-1 sm:flex-initial">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              placeholder={t('mappings.searchPlaceholder')}
              value={searchFilter}
              onChange={(e) => handleSearchFilterChange(e.target.value)}
              suppressHydrationWarning
              className="glass-input glass-input-icon w-full sm:w-64 text-xs"
            />
          </div>
        </div>
      </div>

      {/* Listado de Mapeos con Formato Adaptable */}
      <div className="divide-y divide-[var(--glass-border)]">
        {loading ? (
          <div className="py-16 text-center text-xs font-mono text-[var(--text-muted)]">{t('mappings.loadingCatalogue')}</div>
        ) : filteredMappings.length === 0 ? (
          <div className="py-16 text-center text-xs font-mono text-[var(--text-muted)]">{t('mappings.noMappingsForFilter')}</div>
        ) : (
          <ListRows label={t('mappings.title')}>
          {paginatedMappings.map((item) => {
            const isApproved = item.isApproved;

            return (
              <ListRow
                key={item.id}
                onOpen={() => setActiveMappingSheetItem(item)}
                openLabel={t('mappings.openMappingOptions')}
                tone={isApproved ? 'default' : 'danger'}
                media={
                  item.coverImage ? (
                    <img
                      src={item.coverImage}
                      alt=""
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.onerror = null;
                        e.currentTarget.src = item.anilistMediaId
                          ? `https://img.anili.st/media/${item.anilistMediaId}`
                          : 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                      }}
                      className="w-9 h-12 rounded-[var(--radius-sm)] object-cover border border-[var(--border-subtle)] bg-[var(--bg-app)]"
                    />
                  ) : (
                    <div className="w-9 h-12 rounded-[var(--radius-sm)] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)]">
                      <Film className="w-4 h-4" aria-hidden="true" />
                    </div>
                  )
                }
                title={item.plexTitle}
                badge={
                  item.isGlobal ? (
                    <span className="badge-status-warning shrink-0">
                      <Globe className="w-3 h-3" aria-hidden="true" /> {t('mappings.globalOfficial')}
                    </span>
                  ) : item.isManual ? (
                    <span className="badge-pill shrink-0">{t('mappings.manual')}</span>
                  ) : item.source === 'COMMUNITY' ? (
                    <span className="badge-status-success shrink-0" title={t('mappings.communityHint')}>
                      {t('mappings.community')}
                    </span>
                  ) : null
                }
                meta={[
                  `${t('mappings.seasonPrefix')}${item.plexSeason || 1}`,
                  <span key="al" className="text-[var(--brand-anilist)] font-semibold">
                    AniList #{item.anilistMediaId}
                  </span>,
                  item.malMediaId ? `MAL #${item.malMediaId}` : null,
                  item.matchScore ? `${Math.round(item.matchScore * 100)}%` : null,
                ]}
                status={
                  // Pildora, no boton: antes compartia altura, borde y
                  // familia visual con "Editar" y "Hacer Global" que
                  // tiene al lado, y la gente la pulsaba esperando algo.
                  // pointer-events-none lo deja claro tambien al raton.
                  <span
                    className={`shrink-0 pointer-events-none inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                      isApproved
                        ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]'
                        : 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]'
                    }`}
                  >
                    {isApproved ? (
                      <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                    ) : (
                      <AlertCircle className="w-3 h-3" aria-hidden="true" />
                    )}
                    {isApproved ? t('mappings.linked') : t('mappings.pending')}
                  </span>
                }
                actions={
                  <div className="hidden xl:flex items-center gap-1.5">
                    {!isApproved && (
                      <button
                        onClick={() => handleApprove(item.id)}
                        className="btn-primary"
                        title={t('mappings.approveForAutoSync')}
                      >
                        <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t('mappings.approve')}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleOpenEditModal(item)}
                      className="btn-secondary"
                      title={t('mappings.changeLinkedAnime')}
                    >
                      <Edit3 className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
                      <span>{t('mappings.edit')}</span>
                    </button>

                    {currentUser?.role === 'ADMIN' && (
                      <button
                        onClick={() => handleToggleGlobal(item.id)}
                        className={`btn-secondary ${
                          item.isGlobal ? 'text-[var(--status-warning)] border-[var(--status-warning)]/30' : ''
                        }`}
                        title={
                          item.isGlobal
                            ? t('mappings.globalActiveClickRevoke')
                            : t('mappings.promoteToGlobalTitle')
                        }
                      >
                        <Globe className="w-3.5 h-3.5 text-[var(--status-warning)]" aria-hidden="true" />
                        <span>{item.isGlobal ? t('mappings.globalOn') : t('mappings.makeGlobal')}</span>
                      </button>
                    )}

                    <button
                      onClick={() => handleUnlink(item)}
                      className="btn-danger btn-icon"
                      title={t('mappings.deleteMapping')}
                      aria-label={t('mappings.deleteMapping')}
                    >
                      <Trash2 className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                }
              />
            );
          })}
          </ListRows>
        )}
      </div>
    </>
  );
}
