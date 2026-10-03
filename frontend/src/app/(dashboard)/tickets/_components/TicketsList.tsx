'use client';

import React from 'react';
import Link from 'next/link';
import {
  LifeBuoy,
  Plus,
  Loader2,
  MessageSquare,
  Clock,
  ArrowRight,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';
import {
  TicketItem,
  STATUS_STYLES,
  PRIORITY_STYLES,
  CATEGORY_LABELS,
} from './constants';
import { useNow } from '@/lib/useNow';

interface TicketsListProps {
  loading: boolean;
  tickets: TicketItem[];
  search: string;
  selectedStatus: string;
  selectedCategory: string;
  setIsCreateModalOpen: (val: boolean) => void;
  totalPages: number;
  page: number;
  totalCount: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
}

export function TicketsList({
  loading,
  tickets,
  search,
  selectedStatus,
  selectedCategory,
  setIsCreateModalOpen,
  totalPages,
  page,
  totalCount,
  setPage,
}: TicketsListProps) {
  const { t } = useI18n();
  const now = useNow();

  const formatTimeAgo = (dateStr: string) => {
    const diffMs = now - new Date(dateStr).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('topbar.momentAgo');
    if (mins < 60) return t('topbar.minutesAgo', { mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('topbar.hoursAgo', { hours });
    const days = Math.floor(hours / 24);
    if (days < 30) return t('topbar.daysAgo', { days });
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
          <div className="p-12 text-center border border-dashed border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)] space-y-3">
            <LifeBuoy className="w-10 h-10 mx-auto text-[var(--text-muted)] opacity-70" />
            <div>
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('tickets.noTicketsFound')}</h3>
              <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                {search || selectedStatus !== 'ALL' || selectedCategory !== 'ALL'
                  ? t('tickets.noMatchingRequests')
                  : t('tickets.firstTicketHint')}
              </p>
            </div>
            {!search && selectedStatus === 'ALL' && selectedCategory === 'ALL' && (
              <button
                type="button"
                onClick={() => setIsCreateModalOpen(true)}
                className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md transition-all inline-flex items-center gap-2 cursor-pointer mt-2"
              >
                <Plus className="w-4 h-4" />
                <span>{t('tickets.createTicketNow')}</span>
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {tickets.map((ticket) => {
              const statusCfg = STATUS_STYLES[ticket.status] || STATUS_STYLES.OPEN;
              const priorityCfg = PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.NORMAL;
              const categoryCfg = CATEGORY_LABELS[ticket.category] || { label: ticket.category, desc: '' };
              const StatusIcon = statusCfg.icon;

              return (
                <Link
                  key={ticket.id}
                  href={`/tickets/${ticket.id}`}
                  className="block p-4 sm:p-5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] hover:border-[var(--border-strong)] transition-all duration-180 shadow-sm group cursor-pointer"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="text-xs font-mono font-bold text-[#FF634A]">
                          #{ticket.ticketNumber}
                        </span>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold border flex items-center gap-1 ${statusCfg.class}`}>
                          <StatusIcon className="w-3 h-3" />
                          <span>{t(statusCfg.label)}</span>
                        </span>
                        <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold border ${priorityCfg.class}`}>
                          {t(priorityCfg.label)}
                        </span>
                        <span className="text-xs text-[var(--text-muted)] font-medium">
                          {t(categoryCfg.label)}
                        </span>
                      </div>

                      <h3 className="text-sm sm:text-base font-bold text-[var(--text-primary)] group-hover:text-[#FF634A] transition-colors truncate">
                        {ticket.subject}
                      </h3>
                    </div>

                    <div className="flex items-center justify-between sm:justify-end gap-4 shrink-0 border-t sm:border-t-0 pt-2 sm:pt-0 border-[var(--border-subtle)]">
                      <div className="text-left sm:text-right space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-[var(--text-secondary)]">
                          <MessageSquare className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                          <span>{t('tickets.messageCount', { n: ticket._count?.messages || 1 })}</span>
                        </div>
                        <div className="flex items-center gap-1 text-[11px] text-[var(--text-muted)]">
                          <Clock className="w-3 h-3" />
                          <span>{formatTimeAgo(ticket.lastReplyAt)}</span>
                        </div>
                      </div>

                      <div className="w-8 h-8 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] flex items-center justify-center text-[var(--text-muted)] group-hover:text-[#FF634A] group-hover:border-[#FF634A]/30 transition-colors">
                        <ArrowRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)]">
                  {t('tickets.paginationInfo', { page, totalPages, totalCount })}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="h-9 px-3 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
                  >{t('common.previous')}</button>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="h-9 px-3 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] disabled:opacity-40 cursor-pointer"
                  >{t('common.next')}</button>
                </div>
              </div>
            )}
          </div>
        )}
    </>
  );
}
