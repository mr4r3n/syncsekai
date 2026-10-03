import React from 'react';
import {
  Trash2,
  X,
  Lock,
  ShieldCheck,
  User,
  Maximize2,
  Loader2,
  Paperclip,
  Send,
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORY_LABELS, PRIORITY_STYLES, STATUS_STYLES } from './constants';

interface AdminTicketDrawerProps {
  isDrawerClosing: boolean;
  handleAttemptCloseDrawer: () => void;
  propsDrawer: Record<string, any>;
  activeTicket: any;
  handleDeleteTicket: () => void;
  handleUpdateStatus: (newStatus: string) => Promise<void>;
  handleUpdatePriority: (newPriority: string) => Promise<void>;
  loadingTicketDetail: boolean;
  setPreviewImageUrl: (url: string | null) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  isInternalNote: boolean;
  setIsInternalNote: (val: boolean) => void;
  replyStatus: string;
  setReplyStatus: (val: string) => void;
  attachments: any[];
  removeAttachment: (index: number) => void;
  uploadingAttachment: boolean;
  sendingReply: boolean;
  replyContent: string;
  setReplyContent: (val: string) => void;
  handleSendAdminReply: (e?: React.FormEvent) => Promise<void>;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export function AdminTicketDrawer({
  isDrawerClosing,
  handleAttemptCloseDrawer,
  propsDrawer,
  activeTicket,
  handleDeleteTicket,
  handleUpdateStatus,
  handleUpdatePriority,
  loadingTicketDetail,
  setPreviewImageUrl,
  fileInputRef,
  handleFileSelect,
  isInternalNote,
  setIsInternalNote,
  replyStatus,
  setReplyStatus,
  attachments,
  removeAttachment,
  uploadingAttachment,
  sendingReply,
  replyContent,
  setReplyContent,
  handleSendAdminReply,
  messagesEndRef,
}: AdminTicketDrawerProps) {
  const { t } = useI18n();

  return (
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
        {/* Ticket Header */}
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
              title={t('admin.deleteTicketTitle')}
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleAttemptCloseDrawer}
              aria-label={t('common.close')}
              className="p-2 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* QUICK STATUS & PRIORITY CONTROLS */}
        {activeTicket && (
          <div className="p-3.5 border-b border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">{t('admin.statusColon')}</span>
              <div className="w-44">
                <CustomSelect
                  value={activeTicket.status}
                  onChange={(val) => handleUpdateStatus(val)}
                  options={[
                    { value: 'OPEN', label: t('tickets.statusOpen') },
                    { value: 'WAITING_USER', label: t('admin.waitingUser') },
                    { value: 'IN_PROGRESS', label: t('tickets.underReview') },
                    { value: 'RESOLVED', label: t('tickets.statusResolved') },
                    { value: 'CLOSED', label: t('tickets.statusClosed') },
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
                    { value: 'LOW', label: t('tickets.prioLow') },
                    { value: 'NORMAL', label: t('tickets.prioNormal') },
                    { value: 'HIGH', label: t('tickets.prioHigh') },
                    { value: 'URGENT', label: t('tickets.prioUrgent') },
                  ]}
                  accentColor="cinnabar"
                />
              </div>
            </div>
          </div>
        )}

        {/* CONVERSATION THREAD + INTERNAL NOTES */}
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
                          {t('admin.byAuthor', { author: sender.username || 'Admin' })}
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
                  {/* Sender Avatar (Previous icon) */}
                  <div className="shrink-0 pt-0.5">
                    {isStaff ? (
                      <div className="w-8 h-8 rounded-[6px] flex items-center justify-center font-bold text-xs shrink-0 bg-sky-500/20 text-sky-400 border border-sky-500/30 shadow-xs">
                        <ShieldCheck className="w-4 h-4" />
                      </div>
                    ) : avatarSrc ? (
                      <div className="w-8 h-8 rounded-[6px] overflow-hidden border border-[var(--border-subtle)] shadow-xs bg-[var(--bg-surface-elevated)]">
                        <img
                          src={avatarSrc}
                          alt={sender.username || t('common.user')}
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
                        {isStaff ? 'SyncSekai Staff' : sender.username || t('common.user')}
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

                    {/* Bubble Body (No hard borders) */}
                    <div
                      className={`p-3.5 sm:p-4 rounded-[12px] shadow-sm text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-body transition-colors ${
                        isStaff
                          ? 'bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] rounded-tl-xs'
                          : 'bg-[var(--bg-surface)] text-[var(--text-primary)] rounded-tl-xs'
                      }`}
                    >
                      {msg.content}

                      {/* Photos / Attachments in Message */}
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
          {/* Hidden input to attach photos */}
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
                {t('admin.officialReply')}
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
                <span>{t('admin.internalNoteBtn')}</span>
              </button>
            </div>

            {!isInternalNote && (
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--text-muted)]">{t('admin.statusColon')}</span>
                <div className="w-40">
                  <CustomSelect
                    value={replyStatus}
                    onChange={(val) => setReplyStatus(val)}
                    options={[
                      { value: 'WAITING_USER', label: t('admin.waitingUser') },
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

          {/* Preview of Attached Photos */}
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
              <span className="hidden sm:inline">{isInternalNote ? t('common.save') : t('admin.send')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
