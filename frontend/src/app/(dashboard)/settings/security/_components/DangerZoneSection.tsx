'use client';

import {
  Clock,
  Loader2,
  CheckCircle2,
  Trash2,
  Lock,
  Mail,
} from 'lucide-react';

interface DangerZoneSectionProps {
  userProfile: any;
  handleCancelDeletion: () => void;
  cancellingDeletion: boolean;
  setDeletePasswordInput: (val: string) => void;
  setDelete2FaInput: (val: string) => void;
  setShowDeletionModal: (show: boolean) => void;
  t: (key: string, values?: any) => string;
}

export function DangerZoneSection({
  userProfile,
  handleCancelDeletion,
  cancellingDeletion,
  setDeletePasswordInput,
  setDelete2FaInput,
  setShowDeletionModal,
  t,
}: DangerZoneSectionProps) {
  return (
    <>
            {/* ZONA DE PELIGRO: ELIMINACIÓN DE CUENTA (FLUJO EN 2 FASES + GRACIA 24H) */}
            {userProfile?.deletionScheduledAt ? (
              /* ESTADO: CUENTA EN PERIODO DE GRACIA (24 HORAS) */
              <div className="col-span-full glass-card p-6 sm:p-7 border-amber-500/30 bg-amber-500/[0.04] space-y-4 animate-in fade-in duration-200">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-[8px] bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center shrink-0">
                      <Clock className="w-5 h-5 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-amber-300 font-heading">{t('security.accountScheduledDeletion')}</h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('security.gracePeriodNotice')}</p>
                      <p className="text-xs font-mono font-bold text-amber-400 mt-1">
                        {new Date(userProfile.deletionScheduledAt).toLocaleString('es-ES', {
                          dateStyle: 'full',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleCancelDeletion}
                    disabled={cancellingDeletion}
                    className="px-4 py-2.5 rounded-[6px] text-xs font-bold bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
                  >
                    {cancellingDeletion ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>{t('security.cancelDeletionKeepAccount')}</span>
                  </button>
                </div>

                <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-amber-500/20 text-[11px] text-[var(--text-muted)]">{t('security.cancelDeletionDesc')}</div>
              </div>
            ) : (
              /* ESTADO NORMAL: INICIAR SOLICITUD DE ELIMINACIÓN */
              <div className="col-span-full glass-card p-6 sm:p-7 space-y-4 border-rose-500/20 bg-rose-500/[0.02]">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-[6px] bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 shrink-0">
                    <Trash2 className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('security.dangerZone')}</h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('security.dangerZoneDesc')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5 pt-2">
                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                      <span>{t('security.phase1Title')}</span>
                    </span>
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.phase1Desc')}</p>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                      <span>{t('security.phase2Title')}</span>
                    </span>
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.phase2Desc')}</p>
                  </div>

                  <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1.5">
                    <span className="text-xs font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                      <span>{t('security.phase3Title')}</span>
                    </span>
                    <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.phase3Desc')}</p>
                  </div>
                </div>

                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-t border-rose-500/15">
                  <p className="text-[11.5px] text-[var(--text-muted)] leading-relaxed">{t('security.deletionGdprNotice')}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setDeletePasswordInput('');
                      setDelete2FaInput('');
                      setShowDeletionModal(true);
                    }}
                    className="px-3.5 py-2 rounded-[6px] text-xs font-semibold bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('security.startingDeletionRequest')}</span>
                  </button>
                </div>
              </div>
            )}
    </>
  );
}
