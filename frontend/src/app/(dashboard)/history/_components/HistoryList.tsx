'use client';

import Link from 'next/link';
import {
  History,
  Film,
  CheckSquare,
  Square,
  MinusSquare,
  Loader2,
  Link2,
  Trash2,
} from 'lucide-react';
import { ListRow, ListRows } from '@/components/ListRow';
import { SyncStatus, SyncSummary, type TrackersVinculados } from '@/components/SyncStatus';
import { etiquetasSync } from './utils';
import { HistoryPagination } from './HistoryPagination';

interface HistoryListProps {
  history: any[];
  loading: boolean;
  isBatchProcessing: boolean;
  selectedIds: string[];
  handleSelectAll: () => void;
  isAllSelected: boolean;
  isPartiallySelected: boolean;
  startRecord: number;
  endRecord: number;
  total: number;
  statusFilter: 'ALL' | 'SUCCESS' | 'ERROR';
  setStatusFilter: (filter: 'ALL' | 'SUCCESS' | 'ERROR') => void;
  filteredHistory: any[];
  search: string;
  handleClearSearch: () => void;
  handleToggleSelect: (id: string) => void;
  deletingId: string | null;
  setActiveHistorySheetItem: (item: any) => void;
  resolveCoverUrl: (cover: string | null) => string | null;
  vinculados: TrackersVinculados;
  handleDeleteAndRevert: (item: any) => void;
  totalPages: number;
  page: number;
  handlePageChange: (newPage: number) => void;
  handleJumpSubmit: (e: React.FormEvent) => void;
  jumpPage: string;
  setJumpPage: (value: string) => void;
  t: (key: string, values?: any) => string;
}

export function HistoryList({
  history,
  loading,
  isBatchProcessing,
  selectedIds,
  handleSelectAll,
  isAllSelected,
  isPartiallySelected,
  startRecord,
  endRecord,
  total,
  statusFilter,
  setStatusFilter,
  filteredHistory,
  search,
  handleClearSearch,
  handleToggleSelect,
  deletingId,
  setActiveHistorySheetItem,
  resolveCoverUrl,
  vinculados,
  handleDeleteAndRevert,
  totalPages,
  page,
  handlePageChange,
  handleJumpSubmit,
  jumpPage,
  setJumpPage,
  t,
}: HistoryListProps) {
  return (
    <>
      {/* COLUMNA IZQUIERDA: ACTIVIDAD RECIENTE (8 COLS) */}
      <div className="xl:col-span-8 space-y-4 min-w-0">
        {/* TARJETA DE CONTENEDOR DE SCROBBLES */}
        <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-0 py-4 sm:p-5 space-y-4">
          {/* BARRA SUPERIOR: SELECCIÓN + TÍTULO ACTIVIDAD RECIENTE + FILTROS DE ESTADO */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 px-3 sm:px-0 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-3">
              <button
                onClick={handleSelectAll}
                disabled={history.length === 0 || isBatchProcessing}
                className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors focus:outline-none cursor-pointer"
                title={isAllSelected ? t('history.deselectAllOnPage') : t('history.selectAllOnPage')}
              >
                {isAllSelected ? (
                  <CheckSquare className="w-4 h-4 text-sky-400" />
                ) : isPartiallySelected ? (
                  <MinusSquare className="w-4 h-4 text-sky-400" />
                ) : (
                  <Square className="w-4 h-4 text-[var(--text-muted)]" />
                )}
              </button>

              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('history.recentActivity')}</h2>
              </div>

              <span className="text-xs font-mono text-[var(--text-muted)] hidden md:inline">
                ({t('history.showing')} <strong className="text-[var(--text-primary)]">{startRecord} - {endRecord}</strong> {t('history.of')} <strong className="text-[var(--text-primary)]">{total}</strong>)
              </span>
            </div>

            {/* FILTRO DE ESTADO: TODO / ÉXITOS / ERRORES */}
            <div className="flex items-center gap-1 p-1 rounded-[6px] bg-[var(--bg-app)] border border-[var(--border-subtle)] text-xs font-mono self-start sm:self-auto">
              <button
                type="button"
                onClick={() => setStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'ALL'
                    ? 'bg-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >{t('history.allFilter')}</button>
              <button
                type="button"
                onClick={() => setStatusFilter('SUCCESS')}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'SUCCESS'
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >{t('history.successes')}</button>
              <button
                type="button"
                onClick={() => setStatusFilter('ERROR')}
                className={`px-2.5 py-1 rounded-[4px] text-xs font-semibold transition-all cursor-pointer ${
                  statusFilter === 'ERROR'
                    ? 'bg-rose-500/15 text-rose-400 border border-rose-500/30 shadow-xs'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                }`}
              >
                {t('history.errorsTab')}
              </button>
            </div>
          </div>

          {/* LISTA DE ELEMENTOS */}
          <div>
            {loading ? (
              <div className="space-y-3 py-3 animate-in fade-in">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="py-2 px-2.5 flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-transparent"
                  >
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <div className="skeleton w-4 h-4 rounded shrink-0" />
                      <div className="skeleton w-9 h-12 rounded-[var(--radius-sm)] shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="skeleton h-3.5 w-1/3 rounded" />
                        <div className="skeleton h-2.5 w-1/4 rounded" />
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <div className="skeleton h-7 w-20 rounded-[var(--radius-sm)]" />
                      <div className="skeleton h-8 w-8 rounded-[var(--radius-sm)]" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filteredHistory.length === 0 ? (
              <div className="py-16 px-3 text-center text-xs font-mono text-[var(--text-muted)] space-y-2">
                <p>{t('history.noViewingEvents')}</p>
                {search && (
                  <button
                    onClick={handleClearSearch}
                    className="text-sky-400 hover:underline inline-block mt-1"
                  >{t('catalog.clearSearch')}</button>
                )}
              </div>
            ) : (
              <ListRows label={t('history.recentActivity')}>
              {filteredHistory.map((item) => {
                const isSelected = selectedIds.includes(item.id);
                const formattedDate =
                  typeof item.viewedAt === 'string'
                    ? new Date(item.viewedAt).toLocaleString([], {
                        month: 'short',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : item.viewedAt;

                // S02E15: dos digitos siempre, para que la columna no
                // baile entre el episodio 9 y el 10.
                const dosDigitos = (n: number) => String(n).padStart(2, '0');
                const codigoEpisodio = `S${dosDigitos(item.seasonNumber || 1)}E${dosDigitos(
                  item.episodeNumber || 0,
                )}`;

                const fechaCorta =
                  typeof item.viewedAt === 'string'
                    ? new Date(item.viewedAt).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                      })
                    : item.viewedAt;

                const resolvedCover = resolveCoverUrl(item.coverImage);
                const fallo =
                  item.anilistStatus === 'FAILED' || item.malStatus === 'FAILED';
                const sinMapear =
                  !item.isMapped &&
                  !item.anilistMediaId &&
                  (item.anilistStatus === 'SKIPPED' ||
                    item.anilistStatus === 'FAILED' ||
                    item.malStatus === 'FAILED');

                return (
                  <ListRow
                    key={item.id}
                    selected={isSelected}
                    onSelect={() => handleToggleSelect(item.id)}
                    selectDisabled={isBatchProcessing}
                    tone={fallo ? 'danger' : 'default'}
                    onOpen={() => setActiveHistorySheetItem(item)}
                    openLabel={t('history.openScrobbleOptions')}
                    media={
                      resolvedCover ? (
                        <img
                          src={resolvedCover}
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
                    title={item.showTitle}
                    // El orden manda: en movil sobreviven los dos
                    // primeros. De los tres datos que situan un scrobble
                    // -que anime, que episodio y cuando- el primero va
                    // en el titulo y los otros dos abren esta linea.
                    meta={[
                      codigoEpisodio,
                      // Corta en movil, con hora en escritorio.
                      <>
                        <span className="md:hidden">{fechaCorta}</span>
                        <span className="hidden md:inline">{formattedDate}</span>
                      </>,
                      item.librarySectionTitle || t('history.libraryUnknown'),
                      `${Math.round(item.viewPercentage || 95)}% ${t('history.watchedSuffix')}`,
                      item.rating ? `★ ${item.rating}/10` : null,
                      item.episodeTitle || null,
                    ]}
                    status={
                      <>
                        {/* En movil una sola pieza: el detalle por
                            tracker esta a un toque, en la hoja. */}
                        <SyncSummary
                          className="md:hidden"
                          vinculados={vinculados}
                          anilist={item.anilistStatus}
                          mal={item.malStatus}
                          kitsu={item.kitsuStatus}
                          resumen={
                            fallo
                              ? t('history.syncSummaryFailed')
                              : t('history.syncSummary', {
                                  ok: [
                                    vinculados.anilist && item.anilistStatus === 'SUCCESS',
                                    vinculados.mal && item.malStatus === 'SUCCESS',
                                    vinculados.kitsu && item.kitsuStatus === 'SUCCESS',
                                  ].filter(Boolean).length,
                                  total: [vinculados.anilist, vinculados.mal, vinculados.kitsu].filter(
                                    Boolean,
                                  ).length,
                                })
                          }
                        />
                        <SyncStatus
                          className="hidden md:flex"
                          vinculados={vinculados}
                          anilist={item.anilistStatus}
                          mal={item.malStatus}
                          kitsu={item.kitsuStatus}
                          etiquetas={etiquetasSync(item, t)}
                        />
                      </>
                    }
                    actions={
                      <div className="hidden md:flex items-center gap-1.5">
                        {sinMapear && (
                          <Link
                            href={`/mappings?search=${encodeURIComponent(item.showTitle)}&season=${item.seasonNumber || 1}`}
                            className="w-8 h-8 rounded-[var(--radius-sm)] bg-purple-500/15 text-purple-300 hover:bg-purple-500/25 border border-purple-500/35 flex items-center justify-center transition-colors shrink-0"
                            title={t('history.createMappingForAnime')}
                          >
                            <Link2 className="w-4 h-4" aria-hidden="true" />
                          </Link>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAndRevert(item)}
                          disabled={isBatchProcessing || deletingId === item.id}
                          className="w-8 h-8 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--status-danger-bg)] hover:border-[var(--status-danger)]/40 text-[var(--text-muted)] hover:text-[var(--status-danger)] flex items-center justify-center transition-colors cursor-pointer shrink-0 disabled:opacity-30 disabled:cursor-not-allowed"
                          title={t('history.revertScrobble')}
                          aria-label={t('history.revertScrobble')}
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                          ) : (
                            <Trash2 className="w-4 h-4" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                    }
                  />
                );
              })}
              </ListRows>
            )}
          </div>

          <HistoryPagination
            totalPages={totalPages}
            page={page}
            loading={loading}
            handlePageChange={handlePageChange}
            handleJumpSubmit={handleJumpSubmit}
            jumpPage={jumpPage}
            setJumpPage={setJumpPage}
            t={t}
          />
        </div>
      </div>
    </>
  );
}
