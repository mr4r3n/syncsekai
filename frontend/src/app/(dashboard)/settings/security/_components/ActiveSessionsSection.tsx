'use client';

import {
  Laptop,
  Loader2,
  LogOut,
} from 'lucide-react';
import { renderDeviceBrandIcon } from './BrandIcons';
import { formatRelativeTime } from './utils';

interface ActiveSessionsSectionProps {
  sessions: any[];
  handleRevokeOtherSessions: () => void;
  revokingOthers: boolean;
  handleRevokeSession: (sessionId: string, deviceName: string) => void;
  revokingId: string | null;
  t: (key: string, values?: any) => string;
}

export function ActiveSessionsSection({
  sessions,
  handleRevokeOtherSessions,
  revokingOthers,
  handleRevokeSession,
  revokingId,
  t,
}: ActiveSessionsSectionProps) {
  return (
    <>
            {/* SECCIÓN COMPLETA: DISPOSITIVOS & SESIONES ACTIVAS (100% DINÁMICO & CON ICONOS DE MARCA) */}
            <div className="col-span-full glass-card p-6 sm:p-7 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--glass-border)] pb-4">
                <div className="flex items-center gap-3.5">
                  <div className="w-10 h-10 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold">
                    <Laptop className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('security.activeSessions')}</h2>
                    <p className="text-xs text-[var(--text-secondary)]">{t('security.sessionsDesc')}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleRevokeOtherSessions}
                  disabled={revokingOthers || sessions.filter((s) => !s.isCurrent).length === 0}
                  className="btn-danger self-start sm:self-auto shrink-0 disabled:opacity-40"
                  title={t('security.revokeAllOtherSessions')}
                >
                  {revokingOthers ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogOut className="w-3.5 h-3.5" />}
                  <span>{t('security.closeOtherSessions')}</span>
                </button>
              </div>

              {/* Lista Dinámica de Sesiones */}
              {sessions.length === 0 ? (
                <div className="p-8 text-center text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] rounded-[6px] border border-[var(--border-subtle)]">{t('security.noSessionsFound')}</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
                  {sessions.map((sess) => (
                    <div
                      key={sess.id}
                      className={`p-4 rounded-[6px] bg-[var(--bg-surface)] border ${
                        sess.isCurrent ? 'border-[var(--border-strong)] shadow-sm' : 'border-[var(--border-subtle)]'
                      } space-y-3 relative overflow-hidden transition-all hover:border-[var(--border-strong)]`}
                    >
                      <div className="flex items-center justify-between gap-2.5">
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          {/* Icono directo sin caja contenedora */}
                          <div className="shrink-0 flex items-center justify-center">
                            {renderDeviceBrandIcon(sess.iconType, sess.browser, sess.os)}
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="text-xs font-bold text-[var(--text-primary)] truncate" title={sess.deviceName}>
                              {sess.deviceName || t('security.webDevice')}
                            </div>
                            <div className="text-[10.5px] text-[var(--text-muted)] font-mono truncate">
                              {sess.browser || 'Plex Web'} • {sess.os || 'Desconocido'}
                            </div>
                          </div>
                        </div>

                        {/* Indicador Actual o Botón Revocar Individual */}
                        {sess.isCurrent ? (
                          <span className="badge-status-success shrink-0 text-[10px] px-2 py-0.5 whitespace-nowrap">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            {t('security.currentSession')}
                          </span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleRevokeSession(sess.id, sess.deviceName || t('security.thisDevice'))}
                            disabled={revokingId === sess.id}
                            className="text-[var(--text-muted)] hover:text-red-400 hover:bg-red-500/10 p-1.5 rounded-[4px] transition-colors shrink-0 cursor-pointer"
                            title={t('security.closeThisSession')}
                          >
                            {revokingId === sess.id ? (
                              <Loader2 className="w-4 h-4 animate-spin text-red-400" />
                            ) : (
                              <span className="text-sm font-bold text-red-400/80 hover:text-red-400 leading-none">✕</span>
                            )}
                          </button>
                        )}
                      </div>

                      {/* Footer con IP y Fecha Relativa */}
                      <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--glass-border)]">
                        <span>IP: {sess.ipAddress}</span>
                        <span className={sess.isCurrent ? 'text-emerald-400 font-semibold' : 'text-[var(--text-secondary)]'}>
                          {formatRelativeTime(t, sess.lastActiveAt)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
    </>
  );
}
