'use client';

import React from 'react';
import { Mail, Send, Loader2, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SetupStepSmtpProps {
  formData: any;
  setFormData: (val: any) => void;
  setCurrentStep: (step: number) => void;
  handleTestSmtp: () => Promise<void>;
  testingSmtp: boolean;
}

export function SetupStepSmtp({
  formData,
  setFormData,
  setCurrentStep,
  handleTestSmtp,
  testingSmtp,
}: SetupStepSmtpProps) {
  const { t } = useI18n();

  return (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <Mail className="w-4 h-4 text-emerald-400" />{t('setup.step2Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step2Desc')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">Host SMTP:</label>
                      <input
                        type="text"
                        placeholder={t('setup.smtpHostPlaceholder')}
                        value={formData.smtpHost}
                        onChange={(e) => setFormData({ ...formData, smtpHost: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.port')}</label>
                      <input
                        type="number"
                        placeholder={t('setup.smtpPortPlaceholder')}
                        value={formData.smtpPort}
                        onChange={(e) => setFormData({ ...formData, smtpPort: Number(e.target.value) || 587 })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.smtpUser')}</label>
                      <input
                        type="text"
                        placeholder={t('setup.smtpUserPlaceholder')}
                        value={formData.smtpUser}
                        onChange={(e) => setFormData({ ...formData, smtpUser: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.smtpPassword')}</label>
                      <input
                        type="password"
                        placeholder="••••••••••••"
                        value={formData.smtpPassword}
                        onChange={(e) => setFormData({ ...formData, smtpPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.officialSender')}</label>
                    <input
                      type="text"
                      placeholder="SyncSekai <noreply@tudominio.com>"
                      value={formData.smtpFrom}
                      onChange={(e) => setFormData({ ...formData, smtpFrom: e.target.value })}
                      className="glass-input text-xs"
                    />
                  </div>

                  {/* Prueba en Vivo de SMTP */}
                  {formData.smtpHost && (
                    <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] space-y-2.5 mt-2">
                      <span className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                        <Send className="w-3.5 h-3.5 text-sky-400" />{t('setup.testLiveEmail')}</span>
                      <div className="flex items-center gap-2">
                        <input
                          type="email"
                          placeholder={t('setup.testEmailPlaceholder')}
                          value={formData.testRecipient}
                          onChange={(e) => setFormData({ ...formData, testRecipient: e.target.value })}
                          className="glass-input text-xs flex-1"
                        />
                        <button
                          type="button"
                          onClick={handleTestSmtp}
                          disabled={testingSmtp || !formData.testRecipient}
                          className="btn-secondary shrink-0"
                        >
                          {testingSmtp ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                          <span>{t('setup.sendTest')}</span>
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t('auth.back')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="btn-primary"
                    >
                      <span>{t('setup.nextApiKeys')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
  );
}
