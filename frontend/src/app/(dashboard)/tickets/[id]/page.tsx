'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import {
  LifeBuoy,
  ArrowLeft,
  Send,
  Loader2,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  MessageSquare,
  ShieldCheck,
  User,
  RotateCcw,
  Paperclip,
  Image as ImageIcon,
  Trash2,
  Maximize2,
  ExternalLink,
  X,
} from 'lucide-react';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useModalA11y } from '@/components/useModalA11y';
import { useI18n } from '@/i18n/I18nProvider';

const CATEGORY_LABELS: Record<string, string> = {
  TECHNICAL: 'tickets.catTechnical',
  SCROBBLE_SYNC: 'tickets.catScrobble',
  MAPPINGS: 'tickets.catMapping',
  ACCOUNT: 'tickets.catAccount',
  FEATURE_REQUEST: 'tickets.catFeature',
  OTHER: 'tickets.catOther',
};

const PRIORITY_STYLES: Record<string, { label: string; class: string }> = {
  LOW: { label: 'Baja', class: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
  NORMAL: { label: 'Normal', class: 'bg-blue-500/15 text-blue-400 border-blue-500/30' },
  HIGH: { label: 'Alta', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  URGENT: { label: 'Urgente', class: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
};

const STATUS_STYLES: Record<string, { label: string; class: string; icon: any }> = {
  OPEN: { label: 'tickets.statusOpen', class: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: AlertCircle },
  WAITING_USER: { label: 'tickets.staffReply', class: 'bg-sky-500/15 text-sky-400 border-sky-500/30', icon: MessageSquare },
  IN_PROGRESS: { label: 'tickets.underReview', class: 'bg-amber-500/15 text-amber-400 border-amber-500/30', icon: Clock },
  RESOLVED: { label: 'tickets.statusResolved', class: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30', icon: CheckCircle2 },
  CLOSED: { label: 'tickets.statusClosed', class: 'bg-zinc-800 text-zinc-400 border-zinc-700', icon: XCircle },
};

export default function TicketDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const ticketId = params?.id as string;
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();

  const [ticket, setTicket] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [replyText, setReplyText] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [closing, setClosing] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Semántica de diálogo y gestión de foco del visor de imagen.
  const { dialogProps: propsVisor } = useModalA11y(Boolean(previewImageUrl), () => setPreviewImageUrl(null));

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTicket = useCallback(async () => {
    if (!ticketId) return;
    try {
      setLoading(true);
      const res = await api.tickets.get(ticketId);
      setTicket(res);
    } catch (err: any) {
      showToast(err.message || t('tickets.loadTicketError'), 'error');
      router.push('/tickets');
    } finally {
      setLoading(false);
    }
  }, [ticketId, showToast, router]);

  useEffect(() => {
    loadTicket();
  }, [loadTicket]);

  useEffect(() => {
    if (ticket?.messages?.length) {
      scrollToBottom();
    }
  }, [ticket?.messages]);

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

  const handleSendReply = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if ((!replyText.trim() && attachments.length === 0) || sending) return;

    try {
      setSending(true);
      const newMsg = await api.tickets.reply(ticketId, {
        content: replyText.trim() || t('tickets.attachedScreenshot'),
        attachments: attachments.length > 0 ? attachments : undefined,
      });
      setTicket((prev: any) => {
        if (!prev) return prev;
        return {
          ...prev,
          status: 'OPEN',
          lastReplyAt: new Date().toISOString(),
          messages: [...(prev.messages || []), newMsg],
        };
      });
      setReplyText('');
      setAttachments([]);
      showToast(t('tickets.replySent'), 'success');
    } catch (err: any) {
      showToast(err.message || t('tickets.sendReplyError'), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleCloseTicket = async () => {
    if (closing || ticket?.status === 'CLOSED') return;
    try {
      setClosing(true);
      await api.tickets.close(ticketId);
      setTicket((prev: any) => (prev ? { ...prev, status: 'CLOSED', closedAt: new Date().toISOString() } : null));
      showToast(t('tickets.ticketClosed'), 'info');
    } catch (err: any) {
      showToast(err.message || t('tickets.closeTicketError'), 'error');
    } finally {
      setClosing(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendReply();
    }
  };

  const statusCfg = ticket ? (STATUS_STYLES[ticket.status] || STATUS_STYLES.OPEN) : STATUS_STYLES.OPEN;
  const priorityCfg = ticket ? (PRIORITY_STYLES[ticket.priority] || PRIORITY_STYLES.NORMAL) : PRIORITY_STYLES.NORMAL;
  const StatusIcon = statusCfg.icon;

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel="Soporte" currentLabel={ticket ? `Ticket #${ticket.ticketNumber}` : t('tickets.ticketDetail')} />

      {/* TOP BAR / TICKET HEADER */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                if (replyText.trim().length > 0) {
                  setShowDiscardConfirm(true);
                } else {
                  router.push('/tickets');
                }
              }}
              className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              title={t('tickets.backToTicketList')}
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="text-xs font-mono font-bold text-[#FF634A]">
                  #{ticket?.ticketNumber || '...'}
                </span>
                {ticket && (
                  <>
                    <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold border flex items-center gap-1 ${statusCfg.class}`}>
                      <StatusIcon className="w-3 h-3" />
                      <span>{t(statusCfg.label)}</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold border ${priorityCfg.class}`}>
                      {priorityCfg.label}
                    </span>
                    <span className="text-xs text-[var(--text-muted)] font-medium">
                      {t(CATEGORY_LABELS[ticket.category] || ticket.category)}
                    </span>
                  </>
                )}
              </div>
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-[var(--text-primary)] font-heading mt-0.5 line-clamp-1">
                {ticket?.subject || t('tickets.loadingTicket')}
              </h1>
            </div>
          </div>

          {ticket && ticket.status !== 'CLOSED' && (
            <button
              type="button"
              onClick={handleCloseTicket}
              disabled={closing}
              className="h-9 px-3.5 rounded-[6px] text-xs font-semibold border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-800 text-zinc-300 transition-colors flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XCircle className="w-3.5 h-3.5" />}
              <span>{t('tickets.markAsClosed')}</span>
            </button>
          )}
        </div>
      </div>

      {/* MAIN CONVERSATION BODY */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 space-y-6 min-w-0 flex-1 flex flex-col justify-between max-w-5xl mx-auto">
        {loading ? (
          <div className="p-16 flex flex-col items-center justify-center gap-3 border border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)] my-auto">
            <Loader2 className="w-8 h-8 animate-spin text-[#FF634A]" />
            <p className="text-xs font-mono text-[var(--text-muted)]">{t('tickets.loadingConversation')}</p>
          </div>
        ) : (
          <div className="space-y-6 flex-1 py-2">
            {/* HILO DE MENSAJES ESTILO CHAT */}
            {ticket?.messages?.map((msg: any, idx: number) => {
              const isStaff = msg.isStaff;
              const sender = msg.sender || {};
              const senderName = isStaff ? 'SyncSekai Staff' : sender.username || 'Usuario';
              const avatarSrc = sender.avatarUrl
                ? (sender.avatarUrl.startsWith('http') || sender.avatarUrl.startsWith('/')
                    ? sender.avatarUrl
                    : `/api/auth/avatar/${sender.avatarUrl}`)
                : null;

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
                          alt={senderName}
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
                  <div className="flex flex-col space-y-1.5 max-w-[90%] sm:max-w-[78%]">
                    {/* Remitente y Fecha */}
                    <div className="flex items-center gap-2 pl-1 flex-wrap">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        {senderName}
                      </span>
                      {isStaff && (
                        <span className="px-1.5 py-0.2 rounded-[4px] text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                          STAFF
                        </span>
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
                              className="group relative cursor-pointer overflow-hidden rounded-[8px] border border-[var(--border-subtle)] bg-black/25 hover:border-[#FF634A]/50 transition-all max-w-[220px]"
                              title={t('tickets.clickFullSize')}
                            >
                              <img
                                src={att.fileUrl}
                                alt={att.fileName || 'Foto adjunta'}
                                className="max-h-40 w-auto object-cover rounded-[7px] transition-transform duration-200 group-hover:scale-105"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white p-2 text-center backdrop-blur-[2px]">
                                <Maximize2 className="w-4 h-4 text-[#FF634A]" />
                                <span className="text-[10px] font-medium truncate max-w-[150px]">{att.fileName}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* INPUT DE RESPUESTA COMPACTO */}
        {ticket && (
          <div className="pt-2 sticky bottom-3 z-10">
            {ticket.status === 'CLOSED' ? (
              <div className="p-3 sm:p-3.5 rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-lg backdrop-blur-md flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] text-center sm:text-left">
                  <XCircle className="w-4 h-4 text-zinc-400 shrink-0" />
                  <span>{t('tickets.ticketClosedNotice')}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTicket((prev: any) => ({ ...prev, status: 'OPEN' }));
                  }}
                  className="h-8 px-3 rounded-[6px] text-xs font-bold bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#FF634A]" />
                  <span>{t('tickets.writeToReopen')}</span>
                </button>
              </div>
            ) : (
              <form
                onSubmit={handleSendReply}
                className="rounded-[10px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-xl backdrop-blur-md p-2 space-y-2"
              >
                {/* Input oculto para adjuntar fotos */}
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileSelect}
                  accept="image/png,image/jpeg,image/jpg,image/webp,image/gif"
                  className="hidden"
                />

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
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAttachment || sending}
                    className="p-2 text-[var(--text-muted)] hover:text-[#FF634A] hover:bg-[var(--bg-surface-hover)] rounded-[6px] transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    title={t('tickets.attachScreenshot')}
                  >
                    {uploadingAttachment ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#FF634A]" />
                    ) : (
                      <Paperclip className="w-4 h-4" />
                    )}
                  </button>

                  <textarea
                    rows={1}
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={t('tickets.messagePlaceholder')}
                    className="w-full py-1.5 px-2 bg-transparent text-xs sm:text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none resize-none font-body max-h-28 min-h-[36px]"
                  />

                  <button
                    type="submit"
                    disabled={sending || uploadingAttachment || (!replyText.trim() && attachments.length === 0)}
                    className="h-8 sm:h-9 px-3 sm:px-4 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40 shrink-0"
                  >
                    {sending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{t('tickets.send')}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>

      {/* LIGHTBOX MODAL PARA VER FOTO EN TAMAÑO COMPLETO */}
      {previewImageUrl && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200"
          onClick={() => setPreviewImageUrl(null)}
        >
          <div
            {...propsVisor}
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

      {/* CONFIRMACIÓN DE DESCARTAR RESPUESTA */}
      <ConfirmModal
        isOpen={showDiscardConfirm}
        title="Descartar borrador"
        description="Tienes texto o archivos adjuntos en la respuesta sin enviar. Si sales ahora, el borrador se perderá. ¿Deseas salir de todas formas?"
        confirmText="Descartar y Salir"
        cancelText="Continuar escribiendo"
        variant="warning"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          router.push('/tickets');
        }}
        onClose={() => setShowDiscardConfirm(false)}
      />
    </div>
  );
}
