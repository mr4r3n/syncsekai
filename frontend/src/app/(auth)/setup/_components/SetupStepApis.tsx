'use client';

import React from 'react';
import { Key, Sparkles, Globe, Zap, ArrowLeft, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface SetupStepApisProps {
  formData: any;
  setFormData: (val: any) => void;
  setCurrentStep: (step: number) => void;
}

export function SetupStepApis({
  formData,
  setFormData,
  setCurrentStep,
}: SetupStepApisProps) {
  const { t } = useI18n();

  return (
                <div className="space-y-4 animate-in fade-in duration-200">
                  <div className="border-b border-[var(--glass-border)] pb-3">
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading flex items-center gap-2">
                      <Key className="w-4 h-4 text-purple-400" />{t('setup.step3Title')}</h2>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('setup.step3Desc')}</p>
                  </div>

                  {/* AniList */}
                  <div className="p-4 rounded-[6px] border border-sky-500/20 bg-sky-500/5 space-y-3">
                    <span className="text-xs font-bold text-sky-400 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5" /> AniList OAuth 2.0 Client (GraphQL)
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="AniList Client ID"
                        value={formData.anilistClientId}
                        onChange={(e) => setFormData({ ...formData, anilistClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="AniList Client Secret"
                        value={formData.anilistClientSecret}
                        onChange={(e) => setFormData({ ...formData, anilistClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* MyAnimeList */}
                  <div className="p-4 rounded-[6px] border border-indigo-500/20 bg-indigo-500/5 space-y-3">
                    <span className="text-xs font-bold text-indigo-400 flex items-center gap-2">
                      <Key className="w-3.5 h-3.5" /> MyAnimeList REST API v2 Client
                    </span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="MAL Client ID"
                        value={formData.malClientId}
                        onChange={(e) => setFormData({ ...formData, malClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="MAL Client Secret"
                        value={formData.malClientSecret}
                        onChange={(e) => setFormData({ ...formData, malClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Google OAuth */}
                  <div className="p-4 rounded-[6px] border border-rose-500/20 bg-rose-500/5 space-y-3">
                    <span className="text-xs font-bold text-rose-400 flex items-center gap-2">
                      <Globe className="w-3.5 h-3.5" />{t('setup.googleOauth')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Google Client ID (.apps.googleusercontent.com)"
                        value={formData.googleClientId}
                        onChange={(e) => setFormData({ ...formData, googleClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Google Client Secret"
                        value={formData.googleClientSecret}
                        onChange={(e) => setFormData({ ...formData, googleClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  {/* Discord OAuth */}
                  <div className="p-4 rounded-[6px] border border-indigo-500/20 bg-[#5865F2]/5 space-y-3">
                    <span className="text-xs font-bold text-[#5865F2] flex items-center gap-2">
                      <Zap className="w-3.5 h-3.5" />{t('setup.discordOauth')}</span>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Discord Client ID"
                        value={formData.discordClientId}
                        onChange={(e) => setFormData({ ...formData, discordClientId: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                      <input
                        type="password"
                        placeholder="Discord Client Secret"
                        value={formData.discordClientSecret}
                        onChange={(e) => setFormData({ ...formData, discordClientSecret: e.target.value })}
                        className="glass-input text-xs font-mono"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-4">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(2)}
                      className="btn-secondary"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      <span>{t('auth.back')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setCurrentStep(4)}
                      className="btn-primary"
                    >
                      <span>{t('setup.nextSuperAdmin')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
  );
}
