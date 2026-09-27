'use client';

import React from 'react';
import { AnnouncementData } from '@/components/AnnouncementBanner';

interface ContentTabProps {
  activeTab: string;
  formData: AnnouncementData;
  setFormData: React.Dispatch<React.SetStateAction<AnnouncementData>>;
  t: (key: string, values?: any) => string;
}

export function ContentTab({
  activeTab,
  formData,
  setFormData,
  t,
}: ContentTabProps) {
  if (activeTab !== 'content') return null;

  return (
    <>
            {/* TAB 1: CONTENIDO & TEXTOS */}
            {activeTab === 'content' && (
              <div className="space-y-5">
                {/* Mensaje Principal */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.mainMessage')}</label>
                  <input
                    type="text"
                    value={formData.message || ''}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    placeholder={t('announcements.messagePlaceholder')}
                    className="w-full h-10 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                  />
                  <p className="text-[11px] text-[var(--text-muted)]">{t('announcements.mainMessageDesc')}</p>
                </div>

                {/* Insignia / Badge */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-3 border-t border-[var(--border-subtle)]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.badgeText')}</label>
                    <input
                      type="text"
                      value={formData.badgeText || ''}
                      onChange={(e) => setFormData({ ...formData, badgeText: e.target.value })}
                      placeholder={t('announcements.badgePlaceholder')}
                      className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.badgeBackground')}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.badgeBgColor || '#ff4d4f'}
                        onChange={(e) => setFormData({ ...formData, badgeBgColor: e.target.value })}
                        className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.badgeBgColor || '#ff4d4f'}
                        onChange={(e) => setFormData({ ...formData, badgeBgColor: e.target.value })}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.badgeTextColour')}</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={formData.badgeTextColor || '#ffffff'}
                        onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                        className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                      />
                      <input
                        type="text"
                        value={formData.badgeTextColor || '#ffffff'}
                        onChange={(e) => setFormData({ ...formData, badgeTextColor: e.target.value })}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Call to Action (CTA) Button */}
                <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.ctaButton')}</h3>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.buttonText')}</label>
                      <input
                        type="text"
                        value={formData.ctaText || ''}
                        onChange={(e) => setFormData({ ...formData, ctaText: e.target.value })}
                        placeholder={t('announcements.buttonPlaceholder')}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.destinationUrl')}</label>
                      <input
                        type="text"
                        value={formData.ctaUrl || ''}
                        onChange={(e) => setFormData({ ...formData, ctaUrl: e.target.value })}
                        placeholder={t('announcements.urlPlaceholder')}
                        className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.buttonBackground')}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.ctaBgColor || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, ctaBgColor: e.target.value })}
                          className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={formData.ctaBgColor || '#ffffff'}
                          onChange={(e) => setFormData({ ...formData, ctaBgColor: e.target.value })}
                          className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.buttonText')}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color"
                          value={formData.ctaTextColor || '#0ba360'}
                          onChange={(e) => setFormData({ ...formData, ctaTextColor: e.target.value })}
                          className="w-9 h-9 rounded-[6px] border border-[var(--border-subtle)] cursor-pointer bg-transparent"
                        />
                        <input
                          type="text"
                          value={formData.ctaTextColor || '#0ba360'}
                          onChange={(e) => setFormData({ ...formData, ctaTextColor: e.target.value })}
                          className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
