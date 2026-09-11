'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  LifeBuoy,
  Plus,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  HelpCircle,
  Loader2,
  Filter,
  X,
  ChevronRight,
  ArrowRight,
  ShieldAlert,
  Send,
  User,
  ExternalLink,
  Paperclip,
  Image as ImageIcon,
} from 'lucide-react';
import { CustomSelect, SelectOption } from '@/components/CustomSelect';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';

interface TicketItem {
  id: string;
  ticketNumber: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  lastReplyAt: string;
  createdAt: string;
  _count?: {
    messages: number;
  };
  assignedAdmin?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
}

// Estos mapas viven a nivel de modulo, donde no existe el hook: guardan la CLAVE
// y se traducen en el render con t(). Un valor desconocido se devuelve tal cual,
// asi que las categorias que no esten en el mapa siguen mostrandose.
const CATEGORY_LABELS: Record<string, { label: string; desc: string }> = {
  TECHNICAL: { label: 'tickets.catTechnical', desc: 'tickets.catTechnicalDesc' },
  SCROBBLE_SYNC: { label: 'tickets.catScrobble', desc: 'tickets.catScrobbleDesc' },
  MAPPINGS: { label: 'tickets.catMapping', desc: 'tickets.catMappingDesc' },
  ACCOUNT: { label: 'tickets.catAccount', desc: 'tickets.catAccountDesc' },
  FEATURE_REQUEST: { label: 'tickets.catFeature', desc: 'tickets.catFeatureDesc' },
  OTHER: { label: 'tickets.catOther', desc: 'tickets.catOtherDesc' },
};

const PRIORITY_STYLES: Record<string, { label: string; class: string }> = {
  LOW: { label: 'tickets.prioLow', class: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  NORMAL: { label: 'tickets.prioNormal', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  HIGH: { label: 'tickets.prioHigh', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  URGENT: { label: 'tickets.prioUrgent', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25' },
};

const STATUS_STYLES: Record<string, { label: string; class: string; icon: any }> = {
  OPEN: { label: 'tickets.statusOpen', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', icon: AlertCircle },
  WAITING_USER: { label: 'tickets.staffReply', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25', icon: MessageSquare },
  IN_PROGRESS: { label: 'tickets.underReview', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25', icon: Clock },
  RESOLVED: { label: 'tickets.statusResolved', class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25', icon: CheckCircle2 },
  CLOSED: { label: 'tickets.statusClosed', class: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20', icon: XCircle },
};

export default function TicketsPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [tickets, setTickets] = useState<TicketItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Modal Crear Ticket
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isModalClosing, setIsModalClosing] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);
  const [modalAttachments, setModalAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formData, setFormData] = useState({
    subject: '',
    category: 'TECHNICAL',
    priority: 'NORMAL',
    message: '',
  });

  // Semántica de diálogo y gestión de foco del modal de esta vista.
  const { dialogProps: propsCrear } = useModalA11y(Boolean(isCreateModalOpen), () => handleAttemptCloseModal());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeModalWithAnimation = useCallback(() => {
    setIsModalClosing(true);
    setTimeout(() => {
      setIsCreateModalOpen(false);
      setFormData({
        subject: '',
        category: 'TECHNICAL',
        priority: 'NORMAL',
        message: '',
      });
      setModalAttachments([]);
      setIsModalClosing(false);
    }, 200);
  }, []);

  const handleAttemptCloseModal = useCallback(() => {
    if (formData.subject.trim().length > 0 || formData.message.trim().length > 0 || modalAttachments.length > 0) {
      setShowDiscardPrompt(true);
    } else {
      closeModalWithAnimation();
    }
  }, [formData.subject, formData.message, modalAttachments, closeModalWithAnimation]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      showToast(t('tickets.imageTooLarge'), 'error');
      return;
    }
    try {
      setUploadingAttachment(true);
      const res = await api.tickets.uploadAttachment(file);
      if (res?.attachment) {
        setModalAttachments((prev) => [...prev, res.attachment]);
        showToast(t('tickets.photoAttached'), 'success');
      }
    } catch (err: any) {
      showToast(err.message || t('tickets.uploadImageError'), 'error');
    } finally {
      setUploadingAttachment(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (indexToRemove: number) => {
    setModalAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.tickets.list({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        search: search.trim() || undefined,
        page,
        limit: 15,
      });

      setTickets(res.tickets || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      showToast(err.message || t('tickets.loadTicketsError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedCategory, search, page, showToast]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subject.trim() || !formData.message.trim()) {
      showToast(t('tickets.fillSubjectAndMessage'), 'error');
      return;
    }

    try {
      setCreating(true);
      const newTicket = await api.tickets.create({
        ...formData,
        attachments: modalAttachments.length > 0 ? modalAttachments : undefined,
      });
      showToast(t('tickets.ticketCreated'), 'success');
      setIsCreateModalOpen(false);
      setFormData({
        subject: '',
        category: 'TECHNICAL',
        priority: 'NORMAL',
        message: '',
      });
      setModalAttachments([]);
      // Navegar directamente al nuevo ticket
      if (newTicket?.id) {
        router.push(`/tickets/${newTicket.id}`);
      } else {
        loadTickets();
      }
    } catch (err: any) {
      showToast(err.message || t('tickets.createTicketError'), 'error');
    } finally {
      setCreating(false);
    }
  };

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

  const activeTicketsCount = tickets.filter(
    (t) => t.status === 'OPEN' || t.status === 'WAITING_USER' || t.status === 'IN_PROGRESS',
  ).length;

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.preferences')} currentLabel={t('tickets.title')} />

      {/* TOP HEADER */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4 text-[#FF634A]" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                  {t('tickets.title')}
                </h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('tickets.subtitle')}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="h-10 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>{t('tickets.newTicket')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0 flex-1">
        {/* RESUMEN RÁPIDO */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-[6px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('tickets.activeTickets')}</span>
              <p className="text-lg font-bold font-heading text-[var(--text-primary)] mt-0.5">
                {activeTicketsCount}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-[6px] bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">Total Registrados</span>
              <p className="text-lg font-bold font-heading text-[var(--text-primary)] mt-0.5">
                {totalCount}
              </p>
            </div>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-center gap-3.5 shadow-sm">
            <div className="w-10 h-10 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('tickets.officialDocs')}</span>
              <Link
                href="/docs"
                className="text-xs font-semibold text-[var(--color-brand-primary)] hover:underline flex items-center gap-1 mt-0.5"
              >
                <span>{t('tickets.viewGuide')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* FILTROS Y BÚSQUEDA */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
          {/* Selector de Estados */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'OPEN', label: 'Abiertos' },
              { key: 'WAITING_USER', label: t('tickets.withReply') },
              { key: 'IN_PROGRESS', label: t('tickets.underReview') },
              { key: 'RESOLVED', label: 'Resueltos' },
              { key: 'CLOSED', label: 'Cerrados' },
            ].map((st) => (
              <button
                key={st.key}
                type="button"
                onClick={() => {
                  setSelectedStatus(st.key);
                  setPage(1);
                }}
                className={`h-9 px-3.5 rounded-[6px] text-xs font-semibold transition-all cursor-pointer whitespace-nowrap border shrink-0 ${
                  selectedStatus === st.key
                    ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold'
                    : 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)]'
                }`}
              >
                {t(st.label)}
              </button>
            ))}
          </div>

          {/* Buscador de Asunto o # de Ticket */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1 md:w-64">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('tickets.searchPlaceholderTickets')}
                className="w-full h-9 pl-9 pr-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#FF634A] outline-none"
              />
            </div>

            {/* Filtro de Categoría */}
            <div className="w-48 shrink-0">
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: t('tickets.allCategories') },
                  ...Object.entries(CATEGORY_LABELS).map(([key, val]) => ({
                    value: key,
                    label: t(val.label),
                  })),
                ]}
                accentColor="cinnabar"
              />
            </div>
          </div>
        </div>

        {/* LISTADO DE TICKETS */}
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
                          <span>{ticket._count?.messages || 1} mensaje{(ticket._count?.messages || 1) > 1 ? 's' : ''}</span>
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

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4 border-t border-[var(--border-subtle)]">
                <span className="text-xs text-[var(--text-muted)]">
                  Página {page} de {totalPages} ({totalCount} tickets)
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
      </main>

      {/* MODAL CREAR TICKET */}
      {isCreateModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-200 ${
            isModalClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'
          }`}
          onClick={handleAttemptCloseModal}
        >
          <div
            {...propsCrear}
            className={`w-full max-w-xl rounded-[8px] border border-[var(--border-strong)] bg-[var(--popover-solid-bg)] text-[var(--text-primary)] shadow-2xl p-6 space-y-5 overflow-visible transition-all duration-200 ${
              isModalClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-in zoom-in-95 duration-150'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[6px] bg-[#FF634A]/15 text-[#FF634A] border border-[#FF634A]/30 flex items-center justify-center">
                  <LifeBuoy className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold font-heading">{t('tickets.newTicket')}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{t('tickets.newTicketDesc')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAttemptCloseModal}
                className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-4">
              {/* Asunto */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('tickets.subject')}{' '}<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder={t('tickets.subjectPlaceholder')}
                  className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                />
              </div>

              {/* Categoría y Prioridad */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('tickets.category')}</label>
                  <CustomSelect
                    value={formData.category}
                    onChange={(val) => setFormData({ ...formData, category: val })}
                    options={Object.entries(CATEGORY_LABELS).map(([key, val]) => ({
                      value: key,
                      label: t(val.label),
                    }))}
                    accentColor="cinnabar"
                    triggerClassName="h-10 sm:h-11"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('tickets.priority')}</label>
                  <CustomSelect
                    value={formData.priority}
                    onChange={(val) => setFormData({ ...formData, priority: val })}
                    options={[
                      { value: 'LOW', label: 'Baja (Consultas menores)' },
                      { value: 'NORMAL', label: 'Normal (Uso habitual)' },
                      { value: 'HIGH', label: 'Alta (Problema recurrente)' },
                      { value: 'URGENT', label: 'Urgente (Bloqueo total)' },
                    ]}
                    accentColor="cinnabar"
                    triggerClassName="h-10 sm:h-11"
                  />
                </div>
              </div>

              {/* Mensaje Descriptivo */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('tickets.detailedDescription')}{' '}<span className="text-rose-500">*</span>
                </label>
                <textarea
                  required
                  rows={4}
                  value={formData.message}
                  onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                  placeholder={t('tickets.descriptionPlaceholder')}
                  className="w-full p-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none resize-y font-body"
                />
              </div>

              {/* Adjuntar Fotos / Capturas */}
              <div className="space-y-2">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                />
                
                <div className="flex items-center justify-between">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment}
                    className="h-8 px-3 rounded-[6px] text-xs font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    {uploadingAttachment ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-[#FF634A]" />
                    ) : (
                      <Paperclip className="w-3.5 h-3.5 text-[#FF634A]" />
                    )}
                    <span>{uploadingAttachment ? 'Subiendo foto...' : 'Adjuntar captura / foto'}</span>
                  </button>

                  <span className="text-[11px] text-[var(--text-muted)]">{t('tickets.fileHint')}</span>
                </div>

                {/* Previsualización de Fotos en el modal */}
                {modalAttachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {modalAttachments.map((att, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] shadow-xs animate-in fade-in duration-150"
                      >
                        <img src={att.fileUrl} alt={att.fileName} className="w-5 h-5 rounded-[3px] object-cover" />
                        <span className="max-w-[130px] truncate text-[11px] font-mono">{att.fileName}</span>
                        <button
                          type="button"
                          onClick={() => removeAttachment(idx)}
                          className="text-[var(--text-muted)] hover:text-rose-400 p-0.5 rounded-full hover:bg-rose-500/10 transition-colors cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={handleAttemptCloseModal}
                  className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={creating || uploadingAttachment || !formData.subject.trim() || !formData.message.trim()}
                  className="h-10 px-5 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  <span>{t('tickets.sendTicket')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE DESCARTAR NUEVO TICKET */}
      <ConfirmModal
        isOpen={showDiscardPrompt}
        title={t('tickets.discardDraft')}
        description="Has escrito datos en el formulario del nuevo ticket. ¿Deseas descartar los datos y cerrar?"
        confirmText="Descartar y Cerrar"
        cancelText="Continuar editando"
        variant="warning"
        onConfirm={() => {
          setShowDiscardPrompt(false);
          closeModalWithAnimation();
        }}
        onClose={() => setShowDiscardPrompt(false)}
      />
    </div>
  );
}
