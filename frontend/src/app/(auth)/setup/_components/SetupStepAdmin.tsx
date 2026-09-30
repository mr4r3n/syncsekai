'use client';

import React from 'react';
import { ShieldCheck, Lock, ArrowLeft, Loader2, Sparkles } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SetupStepAdminProps {
  formData: any;
  setFormData: (val: any) => void;
  setCurrentStep: (step: number) => void;
  submitting: boolean;
}

export function SetupStepAdmin({
  formData,
  setFormData,
  setCurrentStep,
  submitting,
}: SetupStepAdminProps) {
  const { t } = useI18n();

  return (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-rose-400" />{t('setup.step4Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step4Desc')}</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.adminUsername')}</label>
                      <input
                        type="text"
                        required
                        placeholder={t('setup.adminNamePlaceholder')}
                        value={formData.adminUsername}
                        onChange={(e) => setFormData({ ...formData, adminUsername: e.target.value })}
                        className="glass-input text-xs font-bold"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('auth.emailLabel')}</label>
                      <input
                        type="email"
                        required
                        placeholder="admin@tudominio.com"
                        value={formData.adminEmail}
                        onChange={(e) => setFormData({ ...formData, adminEmail: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.masterPassword')}</label>
                      <input
                        type="password"
                        required
                        placeholder={t('security.minTwelveChars')}
                        value={formData.adminPassword}
                        onChange={(e) => setFormData({ ...formData, adminPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-[var(--text-secondary)]">{t('setup.confirmPassword')}</label>
                      <input
                        type="password"
                        required
                        placeholder={t('setup.repeatPasswordPlaceholder')}
                        value={formData.adminConfirmPassword}
                        onChange={(e) => setFormData({ ...formData, adminConfirmPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-rose-500/10 border border-rose-500/25 flex items-start gap-2.5 text-xs text-rose-300">
                    <Lock className="w-4 h-4 shrink-0 mt-0.5" />
                    <span>{t('setup.onPressing')}{' '}<strong>{t('setup.finishInstall')}</strong>{' '}{t('setup.sealNotice')}</span>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(3)}
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t('auth.back')}</span>
                    </button>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="btn-primary py-2.5 px-6 font-bold"
                    >
                      {submitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>Instalando SyncSekai...</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-4 h-4" />
                          <span>{t('setup.finishAndSeal')}</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
  );
}
