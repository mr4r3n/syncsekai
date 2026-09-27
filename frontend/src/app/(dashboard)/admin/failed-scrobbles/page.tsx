'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  AlertTriangle,
  RefreshCw,
  Copy,
  Check,
  ChevronLeft,
  ChevronRight,
  Tv,
  User,
  Clock,
  ArrowLeft,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface FailedScrobbleItem {
  id: string;
  showTitle: string;
  episodeNumber: number;
  seasonNumber: number;
  username: string;
  failedTrackers: string[];
  errorMessage: string;
  viewedAt: string;
}

interface PaginationInfo {
  currentPage: number;
  itemsPerPage: number;
  totalItems: number;
  totalPages: number;
}

const LEGACY_ERROR_MSG = 'Sin motivo registrado (anterior al registro de errores)';

export default function AdminFailedScrobblesPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [items, setItems] = useState<FailedScrobbleItem[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo>({
    currentPage: 1,
    itemsPerPage: 25,
    totalItems: 0,
    totalPages: 1,
  });
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    loadData(1, true);
  }, []);

  const loadData = async (page = 1, showInitialLoader = false) => {
    try {
      if (showInitialLoader) setLoading(true);
      else setIsRefreshing(true);

      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const res = await api.admin.getFailedScrobbles(page, pagination.itemsPerPage);
      setItems(res.items || []);
      setPagination(
        res.pagination || {
          currentPage: page,
          itemsPerPage: pagination.itemsPerPage,
          totalItems: res.items?.length || 0,
          totalPages: 1,
        }
      );
    } catch (e: any) {
      showToast(e.message || t('admin.loadFailuresError'), 'error');
    } finally {
      if (showInitialLoader) setLoading(false);
      setIsRefreshing(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        setCopiedId(id);
        showToast(t('admin.errorMessageCopied'), 'success');
        setTimeout(() => setCopiedId(null), 2500);
      });
    }
  };

  const renderTrackerBadge = (tracker: string) => {
    switch (tracker.toLowerCase()) {
      case 'anilist':
        return (
          <span
            key={tracker}
            className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-sky-500/10 border border-sky-500/30 text-sky-600 dark:text-sky-400"
          >
            AniList
          </span>
        );
      case 'mal':
      case 'myanimelist':
        return (
          <span
            key={tracker}
            className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-blue-600/10 border border-blue-500/30 text-blue-700 dark:text-blue-300"
          >
            MyAnimeList
          </span>
        );
      case 'kitsu':
        return (
          <span
            key={tracker}
            className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-orange-500/10 border border-orange-500/30 text-orange-700 dark:text-orange-400"
          >
            Kitsu
          </span>
        );
      default:
        return (
          <span
            key={tracker}
            className="inline-flex items-center px-2 py-0.5 rounded-[4px] text-[11px] font-semibold bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)]"
          >
            {tracker}
          </span>
        );
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleString('es-ES', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.failedScrobblesTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-3">
          <div className="flex items-center gap-2">
            <Link
              href="/admin/services"
              className="inline-flex items-center gap-1 text-xs font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span>Servicios &amp; Nodos</span>
            </Link>
            <span className="text-[var(--text-muted)]">/</span>
            <span className="text-xs font-mono text-[var(--accent-text)]">Scrobbles Fallidos</span>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center">
                  <AlertTriangle className="w-4 h-4" aria-hidden="true" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.failedScrobblesTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.failedScrobblesSubtitle')}</p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                onClick={() => loadData(pagination.currentPage, false)}
                disabled={isRefreshing || loading}
                className="btn-secondary text-xs py-2 px-3.5 flex items-center gap-2 cursor-pointer"
                title="Actualizar listado"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[var(--accent-text)]' : ''}`}
                  aria-hidden="true"
                />
                <span>{isRefreshing ? 'Actualizando…' : 'Refrescar'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <main id="main-content" tabIndex={-1} className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0 outline-none">
        {/* Banner Explicativo de Contexto */}
          <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-secondary)] flex items-start gap-3 shadow-sm">
            <Info className="w-4 h-4 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5" aria-hidden="true" />
            <div className="space-y-1 leading-relaxed">
              <p className="font-semibold text-[var(--text-primary)]">{t('admin.failuresVsSkips')}</p>
              <p className="text-[11.5px] text-[var(--text-muted)]">{t('admin.listOnlyContains')}{' '}<span className="font-mono text-rose-600 dark:text-rose-400 font-semibold">FAILED</span>{' '}{t('admin.failedScrobblesExplain')}{' '}<span className="font-mono text-sky-600 dark:text-sky-400 font-semibold">SKIPPED</span>{' '}{t('admin.normalPipelineSkips')}</p>
            </div>
          </div>

          {/* Listado Principal */}
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              className="py-16 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)] font-mono text-xs border border-[var(--border-subtle)] rounded-[8px] bg-[var(--glass-bg)]"
            >
              <RefreshCw className="w-6 h-6 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
              <span>{t('admin.loadingFailures')}</span>
            </div>
          ) : items.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3 text-center border border-[var(--border-subtle)] rounded-[8px] bg-[var(--glass-bg)] p-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ShieldAlert className="w-6 h-6" aria-hidden="true" />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-primary)]">{t('admin.noFailedScrobbles')}</h2>
              <p className="text-xs text-[var(--text-muted)] max-w-sm">{t('admin.allEventsOk')}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="glass-card overflow-hidden border border-[var(--glass-border)] rounded-[8px]">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-[11px] text-[var(--text-muted)] uppercase tracking-wider">
                        <th scope="col" className="py-3 px-4 font-semibold">Show / Episodio</th>
                        <th scope="col" className="py-3 px-4 font-semibold">{t('admin.user')}</th>
                        <th scope="col" className="py-3 px-4 font-semibold">Trackers Afectados</th>
                        <th scope="col" className="py-3 px-4 font-semibold">{t('admin.errorReason')}</th>
                        <th scope="col" className="py-3 px-4 font-semibold whitespace-nowrap">Fecha / Hora</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-subtle)]">
                      {items.map((item) => {
                        const isLegacy = item.errorMessage === LEGACY_ERROR_MSG;

                        return (
                          <tr
                            key={item.id}
                            className="hover:bg-[var(--bg-surface-hover)] transition-colors group"
                          >
                            {/* Show y Episodio */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-1">
                                <div className="font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                                  <Tv className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" aria-hidden="true" />
                                  <span className="line-clamp-1">{item.showTitle}</span>
                                </div>
                                <div className="text-[11px] font-mono text-[var(--text-muted)]">
                                  T{item.seasonNumber} • Ep. {item.episodeNumber}
                                </div>
                              </div>
                            </td>

                            {/* Usuario */}
                            <td className="py-3.5 px-4 align-top">
                              <span className="inline-flex items-center gap-1 font-mono text-xs text-[var(--text-secondary)]">
                                <User className="w-3 h-3 text-[var(--text-muted)]" aria-hidden="true" />
                                {item.username}
                              </span>
                            </td>

                            {/* Trackers con error */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="flex flex-wrap gap-1.5 max-w-xs">
                                {item.failedTrackers && item.failedTrackers.length > 0 ? (
                                  item.failedTrackers.map((t) => renderTrackerBadge(t))
                                ) : (
                                  <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                    Desconocido
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Mensaje de Error */}
                            <td className="py-3.5 px-4 align-top">
                              <div className="space-y-1.5">
                                {isLegacy ? (
                                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[4px] bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 font-medium text-[11px]">
                                    <Info className="w-3.5 h-3.5 shrink-0 text-amber-700 dark:text-amber-400" aria-hidden="true" />
                                    <span>{t('admin.historicRecord')}</span>
                                  </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-rose-500/10 border border-rose-500/25 max-w-full">
                                    <p className="font-mono text-[11px] text-rose-800 dark:text-rose-300 break-words leading-snug">
                                      {item.errorMessage}
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => handleCopy(item.id, item.errorMessage)}
                                      className="p-1 rounded text-rose-600/70 hover:text-rose-900 dark:text-rose-400/70 dark:hover:text-rose-200 hover:bg-rose-500/10 transition-colors shrink-0 cursor-pointer"
                                      title={t('admin.copyErrorMessage')}
                                      aria-label={t('admin.copyErrorMessage')}
                                    >
                                      {copiedId === item.id ? (
                                        <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                                      ) : (
                                        <Copy className="w-3.5 h-3.5" aria-hidden="true" />
                                      )}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </td>

                            {/* Fecha */}
                            <td className="py-3.5 px-4 align-top whitespace-nowrap text-[11px] font-mono text-[var(--text-muted)]">
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3 h-3" aria-hidden="true" />
                                <span>{formatDate(item.viewedAt)}</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Barra de Paginación */}
                {pagination.totalPages > 1 && (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs font-mono">
                    <span className="text-[var(--text-muted)]">
                      Página {pagination.currentPage} de {pagination.totalPages} ({pagination.totalItems} fallos totales)
                    </span>

                    <div className="flex items-center gap-2 self-end sm:self-auto">
                      <button
                        type="button"
                        disabled={pagination.currentPage <= 1 || loading}
                        onClick={() => loadData(pagination.currentPage - 1, true)}
                        className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs disabled:opacity-30 cursor-pointer"
                        aria-label={t('mappings.previousPage')}
                      >
                        <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
                        <span>{t('common.previous')}</span>
                      </button>

                      <span className="px-2 font-bold text-[var(--text-primary)]">
                        {pagination.currentPage}
                      </span>

                      <button
                        type="button"
                        disabled={pagination.currentPage >= pagination.totalPages || loading}
                        onClick={() => loadData(pagination.currentPage + 1, true)}
                        className="btn-secondary py-1.5 px-3 flex items-center gap-1 text-xs disabled:opacity-30 cursor-pointer"
                        aria-label={t('mappings.nextPage')}
                      >
                        <span>{t('common.next')}</span>
                        <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </main>
    </div>
  );
}
