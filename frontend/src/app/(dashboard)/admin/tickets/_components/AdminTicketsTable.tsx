import React from 'react';
import { Loader2, CheckCircle2, User, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import { AdminTicketItem } from './types';
import { CATEGORY_LABELS, PRIORITY_STYLES, STATUS_STYLES } from './constants';

interface AdminTicketsTableProps {
  loading: boolean;
  tickets: AdminTicketItem[];
  handleOpenTicketDetail: (ticketId: string) => void;
  totalPages: number;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  totalCount: number;
}

export function AdminTicketsTable({
  loading,
  tickets,
  handleOpenTicketDetail,
  totalPages,
  page,
  setPage,
  totalCount,
}: AdminTicketsTableProps) {
  const { t } = useI18n();

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('topbar.momentAgo');
    if (mins < 60) return `Hace ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Hace ${hours} h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `Hace ${days} d`;
    return new Date(dateStr).toLocaleDateString();
  };

  return (
    <>
      {loading ? (
        <div className="p-16 flex flex-col items-center justify-center gap-3 border border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)]">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF634A]" />
          <p className="text-xs font-mono text-[var(--text-muted)]">{t('tickets.loadingTickets')}</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)] space-y-2">
          <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400/80" />
          <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.inboxClear')}</h3>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mx-auto">{t('admin.noPendingTickets')}</p>
        </div>
      ) : (
        <div className="rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] font-mono uppercase text-[11px]">
                  <th scope="col" className="py-3 px-4"># Ticket</th>
                  <th scope="col" className="py-3 px-4">{t('admin.user')}</th>
                  <th scope="col" className="py-3 px-4">{t('admin.subjectAndCategory')}</th>
                  <th scope="col" className="py-3 px-4">{t('tickets.priority')}</th>
                  <th scope="col" className="py-3 px-4">Estado</th>
                  <th scope="col" className="py-3 px-4">{t('admin.lastReply')}</th>
                  <th scope="col" className="py-3 px-4 text-right">{t('admin.action')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border-subtle)]">
                {tickets.map((ticket) => {
                  const statusCfg = STATUS_STYLES[ticket.status] || STATUS_STYLES.OPEN;
                  const priorityCfg = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.NORMAL;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr
                      key={ticket.id}
                      onClick={() => handleOpenTicketDetail(ticket.id)}
                      className="hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer group"
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-[#FF634A]">
                        #{ticket.ticketNumber}
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-[4px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center font-bold text-[11px] text-[var(--text-primary)]">
                            {ticket.user.username ? ticket.user.username.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
                          </div>
                          <div>
                            <span className="font-bold text-[var(--text-primary)] block">
                              {ticket.user.username}
                            </span>
                            <span className="text-[11px] text-[var(--text-muted)] block truncate max-w-[140px]">
                              {ticket.user.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 max-w-xs">
                        <span className="font-bold text-[var(--text-primary)] group-hover:text-[#FF634A] transition-colors block truncate">
                          {ticket.subject}
                        </span>
                        <span className="text-[11px] text-[var(--text-muted)]">
                          {t(CATEGORY_LABELS[ticket.category] || ticket.category)} • {ticket._count?.messages || 1} msgs
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold border ${priorityCfg.class}`}>
                          {t(priorityCfg.label)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold border inline-flex items-center gap-1 ${statusCfg.class}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{t(statusCfg.label)}</span>
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-[var(--text-muted)] font-mono text-[11px]">
                        {formatTimeAgo(ticket.lastReplyAt)}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenTicketDetail(ticket.id);
                          }}
                          className="h-8 px-3 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] text-xs font-semibold inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <span>Gestionar</span>
                          <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs">
              <span className="text-[var(--text-muted)]">
                Página {page} de {totalPages} ({totalCount} tickets)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="h-8 px-3 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
                >{t('common.previous')}</button>
                <button
                  type="button"
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="h-8 px-3 rounded-[4px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
                >{t('common.next')}</button>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}
