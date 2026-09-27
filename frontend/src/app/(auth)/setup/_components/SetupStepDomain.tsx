'use client';

import React from 'react';
import { Globe, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SetupStepDomainProps {
  formData: any;
  setFormData: (val: any) => void;
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  setCurrentStep: (step: number) => void;
}

export function SetupStepDomain({
  formData,
  setFormData,
  showToast,
  setCurrentStep,
}: SetupStepDomainProps) {
  const { t } = useI18n();

  return (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <Globe className="w-4 h-4 text-sky-400" />{t('setup.step1Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step1Desc')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.bootstrapToken')}</label>
                    <input
                      type="password"
                      required
                      autoComplete="off"
                      value={formData.bootstrapToken}
                      onChange={(e) => setFormData({ ...formData, bootstrapToken: e.target.value })}
                      className="glass-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('setup.bootstrapTokenDesc')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.appUrl')}</label>
                    <input
                      type="url"
                      required
                      placeholder="https://sync.tudominio.com"
                      value={formData.appDomain}
                      onChange={(e) => setFormData({ ...formData, appDomain: e.target.value })}
                      className="glass-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('setup.appUrlDesc')}</p>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.webhookUrl')}</label>
                    <input
                      type="url"
                      placeholder="https://sync.tudominio.com/api/plex/webhook"
                      value={formData.webhookPublicUrl}
                      onChange={(e) => setFormData({ ...formData, webhookPublicUrl: e.target.value })}
                      className="glass-input text-xs font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)]">{t('setup.webhookUrlDesc')}</p>
                  </div>

                  <div className="flex justify-end pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        if (!formData.appDomain.trim()) {
                          showToast(t('setup.enterAppDomain'), 'error');
                          return;
                        }
                        setCurrentStep(2);
                      }}
                      className="btn-primary"
                    >
                      <span>{t('setup.nextSmtp')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
  );
}
