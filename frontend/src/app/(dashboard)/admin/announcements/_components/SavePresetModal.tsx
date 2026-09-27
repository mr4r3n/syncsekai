'use client';

import React from 'react';
import { BookmarkPlus, X, Bookmark, Loader2 } from 'lucide-react';
import { AnnouncementData } from '@/components/AnnouncementBanner';

interface SavePresetModalProps {
  isSavePresetModalOpen: boolean;
  isSavePresetModalClosing: boolean;
  handleAttemptCloseSavePresetModal: () => void;
  propsPreset: React.HTMLAttributes<HTMLElement>;
  formData: AnnouncementData;
  handleSaveCustomPreset: (e: React.FormEvent) => Promise<void>;
  newPresetName: string;
  setNewPresetName: React.Dispatch<React.SetStateAction<string>>;
  savingPreset: boolean;
  t: (key: string, values?: any) => string;
}

export function SavePresetModal({
  isSavePresetModalOpen,
  isSavePresetModalClosing,
  handleAttemptCloseSavePresetModal,
  propsPreset,
  formData,
  handleSaveCustomPreset,
  newPresetName,
  setNewPresetName,
  savingPreset,
  t,
}: SavePresetModalProps) {
  return (
    <>
      {/* MODAL: GUARDAR PLANTILLA PERSONALIZADA */}
      {isSavePresetModalOpen && (
        <div
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm transition-opacity duration-200 ${
            isSavePresetModalClosing ? 'opacity-0' : 'opacity-100 animate-in fade-in duration-200'
          }`}
          onClick={handleAttemptCloseSavePresetModal}
        >
          <div
            {...propsPreset}
            className={`w-full max-w-md rounded-[8px] border border-[var(--border-strong)] bg-[var(--popover-solid-bg)] text-[var(--text-primary)] shadow-2xl p-6 space-y-5 transition-all duration-200 ${
              isSavePresetModalClosing ? 'scale-95 opacity-0' : 'scale-100 opacity-100 animate-in zoom-in-95 duration-150'
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-[6px] bg-amber-500/15 text-amber-400 border border-amber-500/30 flex items-center justify-center">
                  <BookmarkPlus className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-bold font-heading">{t('announcements.saveCustomTemplate')}</h3>
                  <p className="text-xs text-[var(--text-muted)]">{t('announcements.saveCustomTemplateDesc')}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAttemptCloseSavePresetModal}
                className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mini Vista Previa de la Configuración Actual */}
            <div className="p-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)] block">{t('announcements.designSummary')}</span>
              <div
                className="p-3 rounded-[5px] text-xs sm:text-sm flex items-center gap-2 overflow-hidden shadow-xs"
                style={{
                  background: formData.backgroundValue || '#18181b',
                  color: formData.textColor || '#ffffff',
                }}
              >
                {formData.badgeText && (
                  <span
                    className="px-2 py-0.5 rounded-[4px] text-[11px] font-bold shrink-0"
                    style={{
                      backgroundColor: formData.badgeBgColor || '#ff4d4f',
                      color: formData.badgeTextColor || '#ffffff',
                    }}
                  >
                    {formData.badgeText}
                  </span>
                )}
                <span className="truncate flex-1 font-medium">{formData.message}</span>
              </div>
            </div>

            <form onSubmit={handleSaveCustomPreset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.templateName')}{' '}<span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newPresetName}
                  onChange={(e) => setNewPresetName(e.target.value)}
                  placeholder="Ej. Oferta Especial Black Friday, Anuncio Anime Verano..."
                  className="w-full h-10 sm:h-11 px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs sm:text-sm text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
                <button
                  type="button"
                  onClick={handleAttemptCloseSavePresetModal}
                  className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
                >{t('common.cancel')}</button>
                <button
                  type="submit"
                  disabled={savingPreset || !newPresetName.trim()}
                  className="h-10 px-5 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {savingPreset ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Bookmark className="w-4 h-4" />
                  )}
                  <span>{t('announcements.saveTemplate')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
