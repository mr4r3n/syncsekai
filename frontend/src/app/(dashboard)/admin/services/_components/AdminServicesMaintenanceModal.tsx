'use client';

import React from 'react';
import Link from 'next/link';
import { Wrench, X, ExternalLink, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AdminServicesMaintenanceModalProps {
  propsMantenimiento: Record<string, any>;
  setShowMaintenanceModal: (val: boolean) => void;
  mEnabled: boolean;
  setMEnabled: (val: boolean) => void;
  mMessage: string;
  setMMessage: (val: string) => void;
  handleSaveMaintenance: () => Promise<void>;
  savingMaintenance: boolean;
}

export function AdminServicesMaintenanceModal({
  propsMantenimiento,
  setShowMaintenanceModal,
  mEnabled,
  setMEnabled,
  mMessage,
  setMMessage,
  handleSaveMaintenance,
  savingMaintenance,
}: AdminServicesMaintenanceModalProps) {
  const { t } = useI18n();

  return (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            {...propsMantenimiento}
            className="w-full max-w-lg p-6 sm:p-7 rounded-[8px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[var(--text-primary)] font-heading">{t('admin.maintenanceControl')}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">{t('admin.maintenanceControlDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Switch de Activación */}
              <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)] block">
                    {mEnabled ? '🟠 Modo Mantenimiento ACTIVADO' : '🟢 Modo Mantenimiento DESACTIVADO'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {mEnabled
                      ? t('admin.maintenanceActiveDesc')
                      : t('admin.platformOpenDesc')}
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={mEnabled}
                    onChange={(e) => setMEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>

              {/* Mensaje Personalizado */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('admin.messageVisibleToUsers')}</label>
                <textarea
                  value={mMessage}
                  onChange={(e) => setMMessage(e.target.value)}
                  rows={3}
                  placeholder={t('admin.maintenanceDefaultMsg')}
                  className="w-full px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors resize-none"
                />
              </div>

              {/* Enlace para Previsualizar Pantalla */}
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                <span>{t('admin.wantToPreview')}</span>
                <Link
                  href="/maintenance"
                  target="_blank"
                  className="text-[var(--accent-text)] hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Previsualizar /maintenance</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="btn-secondary text-xs"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleSaveMaintenance}
                disabled={savingMaintenance}
                className="px-5 py-2 rounded-[6px] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] font-bold text-xs shadow-md shadow-[var(--accent-primary)]/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {savingMaintenance && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingMaintenance ? 'Guardando...' : t('admin.saveState')}</span>
              </button>
            </div>
          </div>
        </div>
  );
}
