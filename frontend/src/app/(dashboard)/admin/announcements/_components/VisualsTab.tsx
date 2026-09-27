'use client';

import React from 'react';
import {
  Globe,
} from 'lucide-react';
import { AnnouncementData } from '@/components/AnnouncementBanner';
import { EFFECT_OPTIONS, PRESET_GRADIENTS } from './constants';

interface VisualsTabProps {
  activeTab: string;
  formData: AnnouncementData;
  setFormData: React.Dispatch<React.SetStateAction<AnnouncementData>>;
  t: (key: string, values?: any) => string;
}

export function VisualsTab({
  activeTab,
  formData,
  setFormData,
  t,
}: VisualsTabProps) {
  if (activeTab !== 'visuals') return null;

  return (
    <>
            {/* TAB 2: FONDOS & EFECTOS FESTIVOS */}
            {activeTab === 'visuals' && (
              <div className="space-y-5">
                {/* Selector de Efectos de Temporada */}
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.seasonalEffect')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                    {EFFECT_OPTIONS.map((eff) => (
                      <button
                        key={eff.id}
                        type="button"
                        onClick={() => setFormData({ ...formData, effectType: eff.id })}
                        className={`p-3 rounded-[6px] border text-left transition-all duration-180 cursor-pointer flex flex-col justify-between gap-1 ${
                          formData.effectType === eff.id
                            ? 'bg-[#FF634A]/10 border-[#FF634A] text-[#FF634A] shadow-xs'
                            : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-[var(--text-primary)]'
                        }`}
                      >
                        <span className="text-xs font-bold block truncate">{t(eff.label)}</span>
                        <span className="text-[10px] text-[var(--text-muted)] block truncate">{t(eff.desc)}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Site-Wide Global Atmosphere Switch */}
                <div className="flex items-center justify-between p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)]">
                  <div className="space-y-0.5 pr-4">
                    <div className="flex items-center gap-2">
                      <Globe className="w-4 h-4 text-amber-400" />
                      <span className="text-xs font-bold text-[var(--text-primary)]">{t('announcements.extendEffectSiteWide')}</span>
                    </div>
                    <p className="text-[11px] text-[var(--text-muted)]">{t('announcements.extendEffectDesc')}</p>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      setFormData({
                        ...formData,
                        enableGlobalAtmosphere: formData.enableGlobalAtmosphere === false ? true : false,
                      })
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                      formData.enableGlobalAtmosphere !== false ? 'bg-amber-500' : 'bg-zinc-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        formData.enableGlobalAtmosphere !== false ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>

                {/* Tipo de Fondo */}
                <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                  <label className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)] font-mono">{t('announcements.presetGradients')}</label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
                    {PRESET_GRADIENTS.map((grad) => (
                      <button
                        key={grad.name}
                        type="button"
                        onClick={() =>
                          setFormData({
                            ...formData,
                            backgroundType: 'GRADIENT',
                            backgroundValue: grad.value,
                          })
                        }
                        className="p-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-[var(--border-strong)] text-left space-y-1.5 transition-all cursor-pointer"
                      >
                        <div
                          className="h-5 w-full rounded-[4px] shadow-xs"
                          style={{ background: grad.value }}
                        />
                        <span className="text-[11px] font-medium block truncate text-[var(--text-secondary)]">
                          {t(grad.name)}
                        </span>
                      </button>
                    ))}
                  </div>

                  <div className="space-y-1.5 pt-2">
                    <label className="text-[11px] font-semibold text-[var(--text-muted)]">{t('announcements.backgroundCss')}</label>
                    <input
                      type="text"
                      value={formData.backgroundValue || ''}
                      onChange={(e) => setFormData({ ...formData, backgroundValue: e.target.value })}
                      placeholder={t('announcements.cssPlaceholder')}
                      className="w-full h-9 px-3 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] font-mono text-xs text-[var(--text-primary)] focus:border-[#FF634A] outline-none"
                    />
                  </div>
                </div>
              </div>
            )}
    </>
  );
}
