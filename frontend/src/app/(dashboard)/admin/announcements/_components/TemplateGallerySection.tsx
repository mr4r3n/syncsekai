'use client';

import React from 'react';
import {
  Sliders,
  BookmarkPlus,
  Trash2,
} from 'lucide-react';

interface TemplateGallerySectionProps {
  t: (key: string, values?: any) => string;
  setIsSavePresetModalOpen: (open: boolean) => void;
  selectedCategory: 'ALL' | 'FESTIVE' | 'PROMO' | 'INFO' | 'CUSTOM';
  setSelectedCategory: (category: 'ALL' | 'FESTIVE' | 'PROMO' | 'INFO' | 'CUSTOM') => void;
  presets: any[];
  customPresets: any[];
  handleApplyPreset: (presetId: string) => void;
  handleDeleteCustomPreset: (id: string, name: string, e: React.MouseEvent) => void;
}

export function TemplateGallerySection({
  t,
  setIsSavePresetModalOpen,
  selectedCategory,
  setSelectedCategory,
  presets,
  customPresets,
  handleApplyPreset,
  handleDeleteCustomPreset,
}: TemplateGallerySectionProps) {
  return (
    <>
        {/* PRESET TEMPLATES GALLERY */}
        <section className="space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sliders className="w-4 h-4 text-[var(--text-secondary)]" />
              <span className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.templateGallery')}</span>
            </div>

            <button
              type="button"
              onClick={() => setIsSavePresetModalOpen(true)}
              className="text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
            >
              <BookmarkPlus className="w-4 h-4" />
              <span>{t('announcements.saveCurrentAsTemplate')}</span>
            </button>
          </div>

          {/* Filter Categories */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'ALL'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.categoryAll')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)]">
                {presets.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('FESTIVE')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'FESTIVE'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.categoryFestive')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-amber-500/20 text-amber-300">
                {presets.filter((p) => p.category === 'FESTIVE').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('PROMO')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'PROMO'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.promotions')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-cyan-500/20 text-cyan-300">
                {presets.filter((p) => p.category === 'PROMO').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('INFO')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'INFO'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.categoryInfo')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-blue-500/20 text-blue-300">
                {presets.filter((p) => p.category === 'INFO').length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSelectedCategory('CUSTOM')}
              className={`h-9 sm:h-10 px-3.5 sm:px-4 rounded-[6px] text-xs sm:text-sm font-semibold transition-all cursor-pointer whitespace-nowrap flex items-center gap-2 border shrink-0 ${
                selectedCategory === 'CUSTOM'
                  ? 'bg-[#FF634A]/10 text-[#FF634A] border-[#FF634A]/40 font-bold shadow-xs'
                  : 'bg-[var(--bg-surface)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-[var(--border-subtle)] hover:border-[var(--border-strong)]'
              }`}
            >
              <span>{t('announcements.myTemplates')}</span>
              <span className="px-2 py-0.5 rounded-[4px] text-[11px] font-mono font-bold bg-rose-500/20 text-rose-300">
                {customPresets.length}
              </span>
            </button>
          </div>

          {/* FILTERED SYSTEM TEMPLATES LIST */}
          {selectedCategory !== 'CUSTOM' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-3">
              {(selectedCategory === 'ALL'
                ? presets
                : presets.filter((p) => p.category === selectedCategory)
              ).map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleApplyPreset(preset.id)}
                  className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-left transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 shadow-sm cursor-pointer flex flex-col justify-between gap-3 group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-bold block truncate text-[var(--text-primary)] group-hover:text-[var(--color-brand-primary)] transition-colors">
                        {preset.name}
                      </span>
                      {preset.enableGlobalAtmosphere && (
                        <span className="text-[11px] px-2 py-0.5 rounded-[4px] bg-amber-500/15 text-amber-400 font-mono font-bold shrink-0">{t('announcements.atmosphere')}</span>
                      )}
                    </div>
                    <span className="text-xs text-[var(--text-muted)] block truncate">
                      {preset.badgeText || t('announcements.noBadge')} • {preset.effectType}
                    </span>
                  </div>

                  <div
                    className="h-2 w-full rounded-full"
                    style={{ background: preset.backgroundValue }}
                  />
                </button>
              ))}
            </div>
          )}

          {/* LISTADO DE MIS PLANTILLAS PERSONALIZADAS */}
          {selectedCategory === 'CUSTOM' && (
            <div>
              {customPresets.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-[var(--border-subtle)] rounded-[8px] bg-[var(--bg-surface)] space-y-3">
                  <BookmarkPlus className="w-8 h-8 mx-auto text-[var(--text-muted)]" />
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('announcements.noCustomTemplates')}</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-1 max-w-md mx-auto">
                      {t('announcements.noCustomTemplatesDesc')}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsSavePresetModalOpen(true)}
                    className="h-10 px-4 rounded-[6px] text-xs sm:text-sm font-semibold border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-colors inline-flex items-center gap-2 cursor-pointer shadow-sm mt-1"
                  >
                    <BookmarkPlus className="w-4 h-4 text-amber-400" />
                    <span>{t('announcements.saveCurrentDesign')}</span>
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-4 gap-3">
                  {customPresets.map((preset) => (
                    <div
                      key={preset.id}
                      onClick={() => handleApplyPreset(preset.id)}
                      className="p-4 rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-left transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 shadow-sm cursor-pointer flex flex-col justify-between gap-3 group relative"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0 pr-6">
                          <span className="text-sm font-bold block truncate text-[var(--text-primary)] group-hover:text-amber-400 transition-colors">
                            {preset.name}
                          </span>
                          <span className="text-xs text-[var(--text-muted)] block truncate">
                            {preset.badgeText || t('announcements.noBadge')} • {preset.effectType}
                          </span>
                        </div>

                        {/* Delete Template Button */}
                        <button
                          type="button"
                          onClick={(e) => handleDeleteCustomPreset(preset.id, preset.name, e)}
                          className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-colors absolute top-3 right-3 cursor-pointer"
                          title={t('announcements.deleteThisTemplate')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      <div
                        className="h-2 w-full rounded-full"
                        style={{ background: preset.backgroundValue }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
    </>
  );
}
