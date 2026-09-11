'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  LifeBuoy,
  Search,
  MessageSquare,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Loader2,
  RefreshCw,
  Send,
  User,
  ShieldCheck,
  Lock,
  Trash2,
  AlertTriangle,
  ChevronRight,
  Filter,
  Users,
  Eye,
  X,
  ExternalLink,
  ShieldAlert,
  Paperclip,
  Image as ImageIcon,
  Maximize2,
} from 'lucide-react';
import { CustomSelect, SelectOption } from '@/components/CustomSelect';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';

interface AdminTicketItem {
  id: string;
  ticketNumber: number;
  subject: string;
  category: string;
  priority: string;
  status: string;
  lastReplyAt: string;
  createdAt: string;
  user: {
    id: string;
    username: string;
    email: string;
    avatarUrl?: string | null;
    role: string;
  };
  assignedAdmin?: {
    id: string;
    username: string;
    avatarUrl?: string | null;
  } | null;
  _count?: {
    messages: number;
  };
}

interface TicketStats {
  total: number;
  open: number;
  waitingUser: number;
  inProgress: number;
  resolved: number;
  closed: number;
  pendingStaff: number;
  urgent: number;
  todayResolved: number;
}

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'tickets.catTechnical',
  SCROBBLE_SYNC: 'tickets.catScrobble',
  MAPPINGS: 'tickets.catMapping',
  ACCOUNT: 'tickets.catAccount',
  FEATURE_REQUEST: 'tickets.catFeature',
  OTHER: 'tickets.catOther',
};

const PRIORITY_STYLES: Record<string, { label: string; class: string }> = {
  LOW: { label: 'tickets.prioLow', class: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20' },
  NORMAL: { label: 'tickets.prioNormal', class: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25' },
  HIGH: { label: 'tickets.prioHigh', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25' },
  URGENT: { label: 'tickets.prioUrgent', class: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25' },
};

const STATUS_STYLES: Record<string, { label: string; class: string; icon: any }> = {
  OPEN: { label: 'tickets.statusOpen', class: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25', icon: AlertCircle },
  WAITING_USER: { label: 'admin.waitingUser', class: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/25', icon: MessageSquare },
  IN_PROGRESS: { label: 'tickets.underReview', class: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25', icon: Clock },
  RESOLVED: { label: 'tickets.statusResolved', class: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/25', icon: CheckCircle2 },
  CLOSED: { label: 'tickets.statusClosed', class: 'bg-zinc-500/10 text-zinc-600 dark:text-zinc-400 border-zinc-500/20', icon: XCircle },
};

export default function AdminTicketsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();

  const [tickets, setTickets] = useState<AdminTicketItem[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filtros
  const [search, setSearch] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedPriority, setSelectedPriority] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Ticket Seleccionado (Drawer / Modal de Gestión)
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [activeTicket, setActiveTicket] = useState<any>(null);
  const [loadingTicketDetail, setLoadingTicketDetail] = useState(false);
  const [isDrawerClosing, setIsDrawerClosing] = useState(false);
  const [showDiscardPrompt, setShowDiscardPrompt] = useState(false);

  // Formulario de respuesta de staff
  const [replyContent, setReplyContent] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [replyStatus, setReplyStatus] = useState<string>('WAITING_USER');
  const [sendingReply, setSendingReply] = useState(false);

  // Semántica de diálogo y gestión de foco del modal de esta vista.
  const { dialogProps: propsDrawer } = useModalA11y(Boolean(selectedTicketId), () => handleAttemptCloseDrawer());

  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeDrawerWithAnimation = useCallback(() => {
    setIsDrawerClosing(true);
    setTimeout(() => {
      setSelectedTicketId(null);
      setActiveTicket(null);
      setReplyContent('');
      setAttachments([]);
      setIsInternalNote(false);
      setIsDrawerClosing(false);
    }, 220);
  }, []);

  const handleAttemptCloseDrawer = useCallback(() => {
    if (replyContent.trim().length > 0 || attachments.length > 0) {
      setShowDiscardPrompt(true);
    } else {
      closeDrawerWithAnimation();
    }
  }, [replyContent, attachments, closeDrawerWithAnimation]);

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
        setAttachments((prev) => [...prev, res.attachment]);
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
    setAttachments((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const loadStats = async () => {
    try {
      const s = await api.admin.tickets.getStats();
      setStats(s);
    } catch {
      // stats fallback
    }
  };

  const loadTickets = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.admin.tickets.list({
        status: selectedStatus === 'ALL' ? undefined : selectedStatus,
        category: selectedCategory === 'ALL' ? undefined : selectedCategory,
        priority: selectedPriority === 'ALL' ? undefined : selectedPriority,
        search: search.trim() || undefined,
        page,
        limit: 20,
      });

      setTickets(res.tickets || []);
      setTotalPages(res.totalPages || 1);
      setTotalCount(res.total || 0);
    } catch (err: any) {
      showToast(err.message || t('admin.loadAdminTicketsError'), 'error');
    } finally {
      setLoading(false);
    }
  }, [selectedStatus, selectedCategory, selectedPriority, search, page, showToast]);

  useEffect(() => {
    loadTickets();
    loadStats();
  }, [loadTickets]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.allSettled([loadTickets(), loadStats()]);
    setIsRefreshing(false);
    showToast(t('admin.ticketsAndMetricsUpdated'), 'success');
  };

  // Abrir detalle del ticket
  const handleOpenTicketDetail = async (ticketId: string) => {
    setSelectedTicketId(ticketId);
    try {
      setLoadingTicketDetail(true);
      const ticket = await api.admin.tickets.get(ticketId);
      setActiveTicket(ticket);
      setReplyStatus(ticket.status === 'OPEN' ? 'WAITING_USER' : ticket.status);
    } catch (err: any) {
      showToast(err.message || t('admin.loadTicketDetailError'), 'error');
    } finally {
      setLoadingTicketDetail(false);
    }
  };

  const handleSendAdminReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!replyContent.trim() && attachments.length === 0) || !selectedTicketId || sendingReply) return;

    try {
      setSendingReply(true);
      const newMsg = await api.admin.tickets.reply(selectedTicketId, {
        content: replyContent.trim() || (isInternalNote ? t('admin.attachedForInternalNote') : t('admin.attachedForReply')),
        isInternalNote,
        status: isInternalNote ? undefined : replyStatus,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      setActiveTicket((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: isInternalNote ? prev.status : replyStatus,
          lastReplyAt: isInternalNote ? prev.lastReplyAt : new Date().toISOString(),
          messages: [...(prev.messages || []), newMsg],
        };
      });

      setReplyContent('');
      setAttachments([]);
      showToast(
        isInternalNote ? t('admin.internalNoteSaved') : t('admin.officialReplySent'),
        'success',
      );
      loadStats();
      loadTickets();
    } catch (err: any) {
      showToast(err.message || t('tickets.sendReplyError'), 'error');
    } finally {
      setSendingReply(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicketId) return;
    try {
      await api.admin.tickets.updateStatus(selectedTicketId, { status: newStatus });
      setActiveTicket((prev: any) => prev ? { ...prev, status: newStatus } : null);
      showToast(`Estado actualizado a ${STATUS_STYLES[newStatus]?.label || newStatus}`, 'info');
      loadStats();
      loadTickets();
    } catch (err: any) {
      showToast(err.message || t('admin.updateStatusError'), 'error');
    }
  };

  const handleUpdatePriority = async (newPriority: string) => {
    if (!selectedTicketId) return;
    try {
      await api.admin.tickets.updateStatus(selectedTicketId, { priority: newPriority });
      setActiveTicket((prev: any) => prev ? { ...prev, priority: newPriority } : null);
      showToast(`Prioridad actualizada a ${PRIORITY_STYLES[newPriority]?.label || newPriority}`, 'info');
      loadTickets();
    } catch (err: any) {
      showToast(err.message || t('admin.updatePriorityError'), 'error');
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicketId) return;
    if (!confirm(t('admin.confirmDeleteTicket'))) return;
    try {
      await api.admin.tickets.delete(selectedTicketId);
      showToast(t('admin.ticketDeleted'), 'info');
      setSelectedTicketId(null);
      setActiveTicket(null);
      loadStats();
      loadTickets();
    } catch (err: any) {
      showToast(err.message || t('admin.deleteTicketError'), 'error');
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

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.ticketsTitle')} isAdmin />

      {/* HEADER */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <LifeBuoy className="w-4 h-4 text-[#FF634A]" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.ticketsTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.ticketsSubtitle')}</p>
            </div>

            <button
              type="button"
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-2 cursor-pointer shadow-sm self-start sm:self-auto"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t('admin.refreshAction')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* MAIN BODY */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0 flex-1">
        {/* KPI CARDS */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('admin.pendingStaff')}</span>
              <div className="w-7 h-7 rounded-[4px] bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                <AlertCircle className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-heading text-[var(--text-primary)]">
              {stats?.pendingStaff ?? 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)]">
              {stats?.open ?? 0} abiertos • {stats?.inProgress ?? 0} en curso
            </span>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('admin.waitingUser')}</span>
              <div className="w-7 h-7 rounded-[4px] bg-sky-500/15 text-sky-400 flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-heading text-[var(--text-primary)]">
              {stats?.waitingUser ?? 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)]">{t('admin.replySentLabel')}</span>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">{t('admin.criticalUrgent')}</span>
              <div className="w-7 h-7 rounded-[4px] bg-rose-500/15 text-rose-400 flex items-center justify-center">
                <ShieldAlert className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-heading text-rose-400">
              {stats?.urgent ?? 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)]">{t('admin.maxPriorityActive')}</span>
          </div>

          <div className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-1 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs text-[var(--text-muted)] font-medium">Resueltos Hoy</span>
              <div className="w-7 h-7 rounded-[4px] bg-indigo-500/15 text-indigo-400 flex items-center justify-center">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold font-heading text-[var(--text-primary)]">
              {stats?.todayResolved ?? 0}
            </p>
            <span className="text-[11px] text-[var(--text-muted)]">
              {stats?.resolved ?? 0} resueltos histórico
            </span>
          </div>
        </div>

        {/* FILTROS DE TABLERO */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3.5 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            {[
              { key: 'ALL', label: 'Todos' },
              { key: 'OPEN', label: 'Abiertos' },
              { key: 'WAITING_USER', label: 'Esperando Usuario' },
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

          <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
            {/* Buscador */}
            <div className="relative flex-1 sm:w-64 min-w-[200px]">
              <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder={t('admin.searchTicketsPlaceholder')}
                className="w-full h-9 pl-9 pr-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:border-[#FF634A] outline-none"
              />
            </div>

            {/* Categoría */}
            <div className="w-48 shrink-0">
              <CustomSelect
                value={selectedCategory}
                onChange={(val) => {
                  setSelectedCategory(val);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: t('admin.categoryAll') },
                  ...Object.entries(CATEGORY_LABELS).map(([key, val]) => ({
                    value: key,
                    label: val,
                  })),
                ]}
                accentColor="cinnabar"
              />
            </div>

            {/* Prioridad */}
            <div className="w-40 shrink-0">
              <CustomSelect
                value={selectedPriority}
                onChange={(val) => {
                  setSelectedPriority(val);
                  setPage(1);
                }}
                options={[
                  { value: 'ALL', label: t('admin.priorityAll') },
                  { value: 'LOW', label: 'Baja' },
                  { value: 'NORMAL', label: 'Normal' },
                  { value: 'HIGH', label: 'Alta' },
                  { value: 'URGENT', label: 'Urgente' },
                ]}
                accentColor="cinnabar"
              />
            </div>
          </div>
        </div>

        {/* TABLA DE TICKETS */}
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
      </main>

      {/* DRAWER / MODAL DE GESTIÓN DE TICKET SELECCIONADO */}
      {selectedTicketId && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm transition-opacity duration-220 ${
            isDrawerClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'
          }`}
          onClick={handleAttemptCloseDrawer}
        >
          <div
            {...propsDrawer}
            className={`w-full max-w-3xl h-full bg-[var(--bg-app)] border-l border-[var(--border-strong)] flex flex-col shadow-2xl transition-transform duration-250 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              isDrawerClosing ? 'translate-x-full' : 'translate-x-0 animate-in slide-in-from-right duration-250'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header del Ticket */}
            <div className="p-4 sm:p-5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)] flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-mono font-bold text-[#FF634A]">
                    #{activeTicket?.ticketNumber}
                  </span>
                  {activeTicket && (
                    <>
                      <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold border ${STATUS_STYLES[activeTicket.status]?.class}`}>
                        {t(STATUS_STYLES[activeTicket.status]?.label || '')}
                      </span>
                      <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold border ${PRIORITY_STYLES[activeTicket.priority]?.class}`}>
                        {t(PRIORITY_STYLES[activeTicket.priority]?.label || '')}
                      </span>
                      <span className="text-xs text-[var(--text-muted)] font-medium">
                        {t(CATEGORY_LABELS[activeTicket.category] || activeTicket.category)}
                      </span>
                    </>
                  )}
                </div>
                <h2 className="text-base font-bold font-heading text-[var(--text-primary)] mt-1">
                  {activeTicket?.subject || 'Cargando...'}
                </h2>
                <span className="text-xs text-[var(--text-secondary)]">{t('admin.fromLabel')}{' '}<strong>{activeTicket?.user?.username}</strong> ({activeTicket?.user?.email})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleDeleteTicket}
                  className="p-2 rounded-[6px] text-zinc-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors cursor-pointer"
                  title="Eliminar ticket"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={handleAttemptCloseDrawer}
                  className="p-2 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* CONTROLES RÁPIDOS DE ESTADO & PRIORIDAD */}
            {activeTicket && (
              <div className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">Estado:</span>
                  <div className="w-44">
                    <CustomSelect
                      value={activeTicket.status}
                      onChange={(val) => handleUpdateStatus(val)}
                      options={[
                        { value: 'OPEN', label: 'Abierto' },
                        { value: 'WAITING_USER', label: 'Esperando Usuario' },
                        { value: 'IN_PROGRESS', label: t('tickets.underReview') },
                        { value: 'RESOLVED', label: 'Resuelto' },
                        { value: 'CLOSED', label: 'Cerrado' },
                      ]}
                      accentColor="cinnabar"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs text-[var(--text-secondary)] font-medium">{t('admin.priorityLabel')}</span>
                  <div className="w-36">
                    <CustomSelect
                      value={activeTicket.priority}
                      onChange={(val) => handleUpdatePriority(val)}
                      options={[
                        { value: 'LOW', label: 'Baja' },
                        { value: 'NORMAL', label: 'Normal' },
                        { value: 'HIGH', label: 'Alta' },
                        { value: 'URGENT', label: 'Urgente' },
                      ]}
                      accentColor="cinnabar"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* HILO DE CONVERSACIÓN + NOTAS INTERNAS */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              {loadingTicketDetail ? (
                <div className="p-12 flex flex-col items-center justify-center gap-2">
                  <Loader2 className="w-7 h-7 animate-spin text-[#FF634A]" />
                  <span className="text-xs text-[var(--text-muted)] font-mono">{t('admin.loadingMessages')}</span>
                </div>
              ) : (
                activeTicket?.messages?.map((msg: any, idx: number) => {
                  const isInternal = msg.isInternalNote;
                  const isStaff = msg.isStaff;
                  const sender = msg.sender || {};
                  const avatarSrc = sender.avatarUrl
                    ? (sender.avatarUrl.startsWith('http') || sender.avatarUrl.startsWith('/')
                        ? sender.avatarUrl
                        : `/api/auth/avatar/${sender.avatarUrl}`)
                    : null;

                  if (isInternal) {
                    return (
                      <div
                        key={msg.id || idx}
                        className="p-4 rounded-[12px] border border-amber-500/40 bg-gradient-to-b from-amber-950/35 to-amber-950/15 text-amber-100 shadow-sm space-y-1.5 animate-in fade-in duration-150"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <div className="w-6 h-6 rounded-full bg-amber-500/20 text-amber-300 flex items-center justify-center">
                              <Lock className="w-3 h-3" />
                            </div>
                            <span className="text-xs font-bold text-amber-300">{t('admin.internalNote')}</span>
                            <span className="text-[11px] text-amber-200/70 font-mono">
                              por {sender.username || 'Admin'}
                            </span>
                          </div>
                          <span className="text-[11px] text-amber-200/60 font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm whitespace-pre-wrap leading-relaxed pl-8 text-amber-100 font-body">
                          {msg.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={msg.id || idx}
                      className="flex items-start gap-3 w-full animate-in fade-in slide-in-from-bottom-1 duration-200"
                    >
                      {/* Avatar del Remitente (Icono anterior) */}
                      <div className="shrink-0 pt-0.5">
                        {isStaff ? (
                          <div className="w-8 h-8 rounded-[6px] flex items-center justify-center font-bold text-xs shrink-0 bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-xs">
                            <ShieldCheck className="w-4 h-4" />
                          </div>
                        ) : avatarSrc ? (
                          <div className="w-8 h-8 rounded-[6px] overflow-hidden border border-[var(--border-subtle)] shadow-xs bg-[var(--bg-surface-elevated)]">
                            <img
                              src={avatarSrc}
                              alt={sender.username || 'Usuario'}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] font-bold text-xs flex items-center justify-center shadow-xs">
                            {sender.username ? sender.username.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                          </div>
                        )}
                      </div>

                      {/* Burbuja de Mensaje */}
                      <div className="flex flex-col space-y-1.5 max-w-[90%] sm:max-w-[82%]">
                        <div className="flex items-center gap-2 pl-1 flex-wrap">
                          <span className="text-xs font-bold text-[var(--text-primary)]">
                            {isStaff ? 'SyncSekai Staff' : sender.username || 'Usuario'}
                          </span>
                          {isStaff && (
                            <>
                              <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                                STAFF
                              </span>
                              <span className="text-[11px] text-[var(--text-muted)] font-mono">
                                ({sender.username})
                              </span>
                            </>
                          )}
                          <span className="text-[11px] text-[var(--text-muted)] font-mono">
                            {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} •{' '}
                            {new Date(msg.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        {/* Cuerpo de la Burbuja (Sin bordes duros) */}
                        <div
                          className={`p-3.5 sm:p-4 rounded-[12px] shadow-sm text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-body transition-colors ${
                            isStaff
                              ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] rounded-tl-xs'
                              : 'bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-tl-xs'
                          }`}
                        >
                          {msg.content}

                          {/* Fotos / Archivos Adjuntos en el Mensaje */}
                          {msg.attachments && msg.attachments.length > 0 && (
                            <div className="flex flex-wrap gap-2 pt-2.5 mt-2 border-t border-[var(--border-subtle)]">
                              {msg.attachments.map((att: any, attIdx: number) => (
                                <div
                                  key={att.id || attIdx}
                                  onClick={() => setPreviewImageUrl(att.fileUrl)}
                                  className="group relative cursor-pointer overflow-hidden rounded-[8px] border border-[var(--border-subtle)] bg-black/25 hover:border-[#FF634A]/50 transition-all max-w-[200px]"
                                  title={t('tickets.clickFullSize')}
                                >
                                  <img
                                    src={att.fileUrl}
                                    alt={att.fileName || 'Foto adjunta'}
                                    className="max-h-36 w-auto object-cover rounded-[7px] transition-transform duration-200 group-hover:scale-105"
                                  />
                                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-2 text-center backdrop-blur-[2px]">
                                    <Maximize2 className="w-4 h-4 text-[#FF634A]" />
                                    <span className="text-[10px] font-medium truncate max-w-[130px]">{att.fileName}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* FORMULARIO DE RESPUESTA COMPACTO / NOTA INTERNA */}
            <div className="p-3 sm:p-3.5 border-t border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2.5">
              {/* Input oculto para adjuntar fotos */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileSelect}
                accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                className="hidden"
              />

              {/* Selector de Modo: Respuesta vs Nota Interna */}
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(false)}
                    className={`h-7 px-2.5 rounded-[4px] text-[11px] font-semibold transition-all cursor-pointer border ${
                      !isInternalNote
                        ? 'bg-sky-500/15 text-sky-400 border-sky-500/40 font-bold shadow-xs'
                        : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    Respuesta Oficial
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsInternalNote(true)}
                    className={`h-7 px-2.5 rounded-[4px] text-[11px] font-semibold transition-all cursor-pointer border flex items-center gap-1 ${
                      isInternalNote
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold shadow-xs'
                        : 'bg-[var(--bg-surface-elevated)] text-[var(--text-muted)] border-[var(--border-subtle)]'
                    }`}
                  >
                    <Lock className="w-3 h-3" />
                    <span>Nota Interna</span>
                  </button>
                </div>

                {!isInternalNote && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] text-[var(--text-muted)]">Estado:</span>
                    <div className="w-40">
                      <CustomSelect
                        value={replyStatus}
                        onChange={(val) => setReplyStatus(val)}
                        options={[
                          { value: 'WAITING_USER', label: 'Esperando Usuario' },
                          { value: 'IN_PROGRESS', label: t('tickets.underReview') },
                          { value: 'RESOLVED', label: t('admin.markResolved') },
                        ]}
                        accentColor="sky"
                        triggerClassName="h-7 text-xs py-0"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Previsualización de Fotos Adjuntas */}
              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 px-1 pb-1 pt-0.5 border-b border-[var(--border-subtle)]">
                  {attachments.map((att, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 px-2.5 py-1 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] shadow-xs animate-in fade-in zoom-in-95 duration-150"
                    >
                      <img
                        src={att.fileUrl}
                        alt={att.fileName}
                        className="w-5 h-5 rounded-[4px] object-cover"
                      />
                      <span className="max-w-[120px] truncate text-[11px] font-mono">{att.fileName}</span>
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

              {/* Barra de Entrada Compacta */}
              <div
                className={`flex items-center gap-1.5 p-1.5 rounded-[8px] border transition-colors ${
                  isInternalNote
                    ? 'border-amber-500/40 bg-amber-950/10 focus-within:border-amber-400'
                    : 'border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] focus-within:border-[#FF634A]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAttachment || sendingReply}
                  className="p-1.5 text-[var(--text-muted)] hover:text-[#FF634A] hover:bg-[var(--bg-surface-hover)] rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                  title={t('admin.attachScreenshotAdmin')}
                >
                  {uploadingAttachment ? (
                    <Loader2 className="w-4 h-4 animate-spin text-[#FF634A]" />
                  ) : (
                    <Paperclip className="w-4 h-4" />
                  )}
                </button>

                <textarea
                  rows={1}
                  value={replyContent}
                  onChange={(e) => setReplyContent(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSendAdminReply();
                    }
                  }}
                  placeholder={
                    isInternalNote
                      ? t('admin.internalNotePlaceholder')
                      : t('admin.officialReplyPlaceholder')
                  }
                  className="w-full py-1.5 px-2 bg-transparent text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none font-body max-h-28 min-h-[36px]"
                />

                <button
                  type="button"
                  onClick={handleSendAdminReply}
                  disabled={sendingReply || uploadingAttachment || (!replyContent.trim() && attachments.length === 0)}
                  className={`h-8 sm:h-9 px-3 sm:px-4 rounded-[6px] text-xs sm:text-sm font-bold text-white shadow-md transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0 ${
                    isInternalNote ? 'bg-amber-600 hover:bg-amber-500' : 'bg-[#FF634A] hover:bg-[#ff4d30]'
                  }`}
                >
                  {sendingReply ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{isInternalNote ? 'Guardar' : 'Enviar'}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* LIGHTBOX MODAL PARA VER FOTO EN TAMAÑO COMPLETO */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-end gap-2 pb-1">
              <a
                href={previewImageUrl}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-[6px] text-zinc-300 hover:text-white bg-black/50 hover:bg-black/80 transition-colors flex items-center gap-1 text-xs"
                title={t('tickets.openOriginalImage')}
              >
                <ExternalLink className="w-4 h-4" />
                <span>Original</span>
              </a>
              <button
                type="button"
                onClick={() => setPreviewImageUrl(null)}
                className="p-1.5 rounded-[6px] text-zinc-300 hover:text-white bg-black/50 hover:bg-black/80 transition-colors cursor-pointer"
                title={t('tickets.closePreview')}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <img
              src={previewImageUrl}
              alt="Vista previa ampliada"
              className="max-h-[80vh] w-auto max-w-full object-contain rounded-[8px] shadow-2xl border border-zinc-700"
            />
          </div>
        </div>
      )}

      {/* CONFIRMACIÓN DE DESCARTAR BORRADOR DEL DRAWER */}
      <ConfirmModal
        isOpen={showDiscardPrompt}
        title="Descartar borrador"
        description="Tienes una respuesta o nota escrita sin enviar en este ticket. ¿Deseas descartar el texto y cerrar el panel de gestión?"
        confirmText="Descartar y Cerrar"
        cancelText="Continuar redactando"
        variant="warning"
        onConfirm={() => {
          setShowDiscardPrompt(false);
          closeDrawerWithAnimation();
        }}
        onClose={() => setShowDiscardPrompt(false)}
      />
    </div>
  );
}
