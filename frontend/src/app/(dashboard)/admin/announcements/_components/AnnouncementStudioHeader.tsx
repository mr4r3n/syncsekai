'use client';

import React from 'react';
import {
  Megaphone,
  Power,
  BookmarkPlus,
  Save,
  Loader2,
} from 'lucide-react';
import { AnnouncementData } from '@/components/AnnouncementBanner';

interface AnnouncementStudioHeaderProps {
  formData: AnnouncementData;
  handleToggleActive: () => Promise<void>;
  setIsSavePresetModalOpen: (open: boolean) => void;
  handleSave: () => Promise<void>;
  saving: boolean;
  isDirty: boolean;
  t: (key: string, values?: any) => string;
}

export function AnnouncementStudioHeader({
  formData,
  handleToggleActive,
  setIsSavePresetModalOpen,
  handleSave,
  saving,
  isDirty,
  t,
}: AnnouncementStudioHeaderProps) {
  return (
    <>
      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Megaphone className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('announcements.studioTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('announcements.studioSubtitle')}</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Toggle Switch Maestro */}
              <button
                type="button"
                onClick={handleToggleActive}
                className={`h-10 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-bold transition-all duration-180 flex items-center gap-2 cursor-pointer shadow-sm border ${
                  formData.isActive
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/25'
                    : 'bg-[var(--bg-surface)] text-[var(--text-muted)] border-[var(--border-subtle)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]'
                }`}
              >
                <Power className="w-4 h-4" />
                <span>{formData.isActive ? t('announcements.alertActive') : 'Desactivada'}</span>
              </button>

              {/* Guardar como Nueva Plantilla */}
              <button
                type="button"
                onClick={() => setIsSavePresetModalOpen(true)}
                className="h-10 px-4 sm:px-5 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                title={t('announcements.saveAsTemplateTooltip')}
              >
                <BookmarkPlus className="w-4 h-4 text-amber-400" />
                <span>{t('announcements.saveAsTemplate')}</span>
              </button>

              {/* Guardar Cambios con Indicador de Cambios Sin Guardar */}
              <div className="relative flex items-center">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="h-10 px-5 sm:px-6 rounded-[6px] text-xs sm:text-sm font-bold bg-[#FF634A] text-white hover:bg-[#ff4d30] shadow-md shadow-[#FF634A]/20 transition-all flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  <span>{t('announcements.saveChanges')}</span>
                  {isDirty && (
                    <span className="w-2 h-2 rounded-full bg-white animate-ping ml-1" />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
