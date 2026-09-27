'use client';

import React from 'react';
import {
  LifeBuoy,
  X,
  Loader2,
  Paperclip,
  Send,
} from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import { useI18n } from '@/i18n/I18nProvider';
import { CATEGORY_LABELS } from './constants';

interface TicketCreateModalProps {
  createProps: any;
  isModalClosing: boolean;
  handleAttemptCloseModal: () => void;
  handleCreateTicket: (e: React.FormEvent) => Promise<void>;
  formData: {
    subject: string;
    category: string;
    priority: string;
    message: string;
  };
  setFormData: React.Dispatch<React.SetStateAction<{
    subject: string;
    category: string;
    priority: string;
    message: string;
  }>>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  uploadingAttachment: boolean;
  modalAttachments: any[];
  removeAttachment: (indexToRemove: number) => void;
  creating: boolean;
}

export function TicketCreateModal({
  createProps,
  isModalClosing,
  handleAttemptCloseModal,
  handleCreateTicket,
  formData,
  setFormData,
  fileInputRef,
  handleFileSelect,
  uploadingAttachment,
  modalAttachments,
  removeAttachment,
  creating,
}: TicketCreateModalProps) {
  const { t } = useI18n();

  return (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-200 ${
            isModalClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'
          }`}
          onClick={handleAttemptCloseModal}
        >
          <div
            {...createProps}
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

              {/* Category and Priority */}
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
                      { value: 'LOW', label: t('tickets.priorityLowDesc') },
                      { value: 'NORMAL', label: t('tickets.priorityNormalDesc') },
                      { value: 'HIGH', label: t('tickets.priorityHighDesc') },
                      { value: 'URGENT', label: t('tickets.priorityUrgentDesc') },
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
                    <span>{uploadingAttachment ? t('tickets.uploadingPhoto') : t('tickets.attachScreenshot')}</span>
                  </button>

                  <span className="text-[11px] text-[var(--text-muted)]">{t('tickets.fileHint')}</span>
                </div>

                {/* Photo Preview in modal */}
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
  );
}
