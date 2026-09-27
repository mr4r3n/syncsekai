'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';
import { AdminTicketItem, TicketStats } from './_components/types';
import { PRIORITY_STYLES, STATUS_STYLES } from './_components/constants';
import { AdminTicketsPageHeader } from './_components/AdminTicketsPageHeader';
import { AdminTicketsKpis } from './_components/AdminTicketsKpis';
import { AdminTicketsFilters } from './_components/AdminTicketsFilters';
import { AdminTicketsTable } from './_components/AdminTicketsTable';
import { AdminTicketDrawer } from './_components/AdminTicketDrawer';
import { AdminTicketImagePreviewModal } from './_components/AdminTicketImagePreviewModal';

export default function AdminTicketsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
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

  const handleDeleteTicket = () => {
    if (!selectedTicketId) return;
    const id = selectedTicketId;
    const ticket = tickets.find((tk) => tk.id === id);
    setSelectedTicketId(null);
    setActiveTicket(null);
    setTickets((prev) => prev.filter((tk) => tk.id !== id));
    showUndoToast(t('common.deletingItem', { name: ticket?.subject || `#${id.slice(0, 8)}` }), {
      alDeshacer: () => loadTickets(),
      alExpirar: async () => {
        try {
          await api.admin.tickets.delete(id);
          showToast(t('admin.ticketDeleted'), 'info');
        } catch (err: any) {
          showToast(err.message || t('admin.deleteTicketError'), 'error');
        }
        loadStats();
        loadTickets();
      },
    });
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.ticketsTitle')} isAdmin />

      {/* HEADER */}
      <AdminTicketsPageHeader
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
      />

      {/* MAIN BODY */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0 flex-1">
        {/* KPI CARDS */}
        <AdminTicketsKpis stats={stats} />

        {/* FILTROS DE TABLERO */}
        <AdminTicketsFilters
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
          selectedPriority={selectedPriority}
          setSelectedPriority={setSelectedPriority}
        />

        {/* TABLA DE TICKETS */}
        <AdminTicketsTable
          loading={loading}
          tickets={tickets}
          handleOpenTicketDetail={handleOpenTicketDetail}
          totalPages={totalPages}
          page={page}
          setPage={setPage}
          totalCount={totalCount}
        />
      </main>

      {/* DRAWER / MODAL DE GESTIÓN DE TICKET SELECCIONADO */}
      {selectedTicketId && (
        <AdminTicketDrawer
          isDrawerClosing={isDrawerClosing}
          handleAttemptCloseDrawer={handleAttemptCloseDrawer}
          propsDrawer={propsDrawer}
          activeTicket={activeTicket}
          handleDeleteTicket={handleDeleteTicket}
          handleUpdateStatus={handleUpdateStatus}
          handleUpdatePriority={handleUpdatePriority}
          loadingTicketDetail={loadingTicketDetail}
          setPreviewImageUrl={setPreviewImageUrl}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          isInternalNote={isInternalNote}
          setIsInternalNote={setIsInternalNote}
          replyStatus={replyStatus}
          setReplyStatus={setReplyStatus}
          attachments={attachments}
          removeAttachment={removeAttachment}
          uploadingAttachment={uploadingAttachment}
          sendingReply={sendingReply}
          replyContent={replyContent}
          setReplyContent={setReplyContent}
          handleSendAdminReply={handleSendAdminReply}
          messagesEndRef={messagesEndRef}
        />
      )}

      {/* LIGHTBOX MODAL PARA VER FOTO EN TAMAÑO COMPLETO */}
      {previewImageUrl && (
        <AdminTicketImagePreviewModal
          previewImageUrl={previewImageUrl}
          setPreviewImageUrl={setPreviewImageUrl}
        />
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
