'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';
import { TicketItem } from './_components/constants';
import { TicketsPageHeader } from './_components/TicketsPageHeader';
import { TicketsStatsCards } from './_components/TicketsStatsCards';
import { TicketsFilters } from './_components/TicketsFilters';
import { TicketsList } from './_components/TicketsList';
import { TicketCreateModal } from './_components/TicketCreateModal';

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

  // Dialog semantics and focus management for this view's modal.
  const { dialogProps: createProps } = useModalA11y(Boolean(isCreateModalOpen), () => handleAttemptCloseModal());

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
      // Navigate directly to new ticket
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
      <TicketsPageHeader setIsCreateModalOpen={setIsCreateModalOpen} />

      {/* MAIN CONTENT */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0 flex-1">
        {/* QUICK SUMMARY */}
        <TicketsStatsCards
          activeTicketsCount={activeTicketsCount}
          totalCount={totalCount}
        />

        {/* FILTERS AND SEARCH */}
        <TicketsFilters
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          setPage={setPage}
          search={search}
          setSearch={setSearch}
          selectedCategory={selectedCategory}
          setSelectedCategory={setSelectedCategory}
        />

        {/* LISTADO DE TICKETS */}
        <TicketsList
          loading={loading}
          tickets={tickets}
          search={search}
          selectedStatus={selectedStatus}
          selectedCategory={selectedCategory}
          setIsCreateModalOpen={setIsCreateModalOpen}
          totalPages={totalPages}
          page={page}
          totalCount={totalCount}
          setPage={setPage}
        />
      </main>

      {/* MODAL CREAR TICKET */}
      {isCreateModalOpen && (
        <TicketCreateModal
          createProps={createProps}
          isModalClosing={isModalClosing}
          handleAttemptCloseModal={handleAttemptCloseModal}
          handleCreateTicket={handleCreateTicket}
          formData={formData}
          setFormData={setFormData}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
          uploadingAttachment={uploadingAttachment}
          modalAttachments={modalAttachments}
          removeAttachment={removeAttachment}
          creating={creating}
        />
      )}

      {/* DISCARD NEW TICKET CONFIRMATION */}
      <ConfirmModal
        isOpen={showDiscardPrompt}
        title={t('tickets.discardDraft')}
        description={t('tickets.discardPromptDesc')}
        confirmText={t('tickets.discardAndClose')}
        cancelText={t('tickets.continueEditing')}
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
