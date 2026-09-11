'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, Server, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface PlexServerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  currentServerName?: string;
  currentServerUrl?: string;
}

export function PlexServerModal({
  isOpen,
  onClose,
  onSuccess,
  currentServerName,
  currentServerUrl,
}: PlexServerModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [servers, setServers] = useState<any[]>([]);
  const [selectedServerName, setSelectedServerName] = useState(currentServerName || '');
  const [selectedServerUrl, setSelectedServerUrl] = useState(currentServerUrl || '');
  const [customMode, setCustomMode] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customUrl, setCustomUrl] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedServerName(currentServerName || '');
      setSelectedServerUrl(currentServerUrl || '');
      fetchServers();
    }
  }, [isOpen, currentServerName, currentServerUrl]);

  const fetchServers = async () => {
    setLoading(true);
    try {
      const data = await api.plex.getServers();
      setServers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      showToast(`${t('modalPlexServer.getServersError')} ` + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectServer = async (name: string, url: string) => {
    setSelectedServerName(name);
    setSelectedServerUrl(url);
  };

  const handleSave = async () => {
    const finalName = customMode ? customName.trim() : selectedServerName;
    const finalUrl = customMode ? customUrl.trim() : selectedServerUrl;

    if (!finalName || !finalUrl) {
      showToast(t('modalPlexServer.selectOrEnterServer'), 'error');
      return;
    }

    setSaving(true);
    try {
      const res = await api.plex.selectServer(finalName, finalUrl);
      showToast(`¡Servidor "${res.serverName}" activado! (${res.libraries?.length || 0} categorías detectadas)`, 'success');
      window.dispatchEvent(new CustomEvent('plexsync:connections-updated'));
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`${t('modalPlexServer.changeServerError')} ` + err.message, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Foco dentro al abrir, Tab acotado al diálogo y foco devuelto al cerrar.
  const { dialogProps } = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div
        {...dialogProps}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-plex)]/15 flex items-center justify-center text-[var(--brand-plex)] border border-[var(--brand-plex)]/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)] flex items-center gap-2">{t('modalPlexServer.title')}</h3>
              <p className="text-xs text-[var(--text-muted)]">{t('modalPlexServer.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('modalPlexServer.close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-3 text-[var(--text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--brand-plex)]" />
              <span className="text-sm">{t('modalPlexServer.loading')}</span>
            </div>
          ) : (
            <>
              {/* Toggle Modos */}
              <div className="flex items-center justify-between p-1 bg-[var(--bg-surface)] rounded-xl border border-[var(--glass-border)]">
                <button
                  type="button"
                  onClick={() => setCustomMode(false)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    !customMode
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  Servidores Detectados ({servers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setCustomMode(true)}
                  className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all ${
                    customMode
                      ? 'bg-[var(--bg-card)] text-[var(--text-primary)] shadow-sm'
                      : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >{t('modalPlexServer.customUrl')}</button>
              </div>

              {!customMode ? (
                <div className="space-y-2.5">
                  {servers.length === 0 ? (
                    <div className="py-8 text-center text-sm text-[var(--text-muted)] border border-dashed border-[var(--glass-border)] rounded-xl p-4">{t('modalPlexServer.noServersDetected')}</div>
                  ) : (
                    servers.map((srv, idx) => {
                      const isOwned = Boolean(srv.owned);
                      const bestConn = srv.connections?.[0]?.uri || 'http://localhost:32400';
                      const isSelected = selectedServerName === srv.name && selectedServerUrl === bestConn;

                      return (
                        <div
                          key={srv.clientIdentifier || idx}
                          onClick={() => handleSelectServer(srv.name, bestConn)}
                          className={`p-3.5 rounded-xl border cursor-pointer transition-all flex items-center justify-between gap-3 ${
                            isSelected
                              ? 'bg-[var(--brand-plex)]/10 border-[var(--brand-plex)] text-[var(--text-primary)] shadow-sm'
                              : 'bg-[var(--bg-surface)] border-[var(--glass-border)] hover:border-[var(--glass-border-hover)] text-[var(--text-secondary)]'
                          }`}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                                isSelected ? 'bg-[var(--brand-plex)] text-black font-bold' : 'bg-[var(--bg-card)] text-[var(--text-muted)]'
                              }`}
                            >
                              <Server className="w-4 h-4" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-semibold text-sm text-[var(--text-primary)] truncate">{srv.name}</span>
                                <span
                                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider ${
                                    isOwned
                                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                      : 'bg-blue-500/15 text-blue-400 border border-blue-500/20'
                                  }`}
                                >
                                  {isOwned ? 'Propio' : 'Compartido'}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--text-muted)] truncate font-mono mt-0.5">
                                {bestConn}
                              </p>
                            </div>
                          </div>

                          <div className="shrink-0">
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center ${
                                isSelected
                                  ? 'border-[var(--brand-plex)] bg-[var(--brand-plex)] text-black'
                                  : 'border-[var(--glass-border)] bg-transparent'
                              }`}
                            >
                              {isSelected && <CheckCircle2 className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-3.5 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--glass-border)]">
                  <div>
                    <label htmlFor="custom-server-name" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{t('modalPlexServer.serverName')}</label>
                    <input
                      id="custom-server-name"
                      name="customServerName"
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder={t('modalPlexServer.namePlaceholder')}
                      className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-plex)]"
                    />
                  </div>

                  <div>
                    <label htmlFor="custom-server-url" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{t('modalPlexServer.serverUrl')}</label>
                    <input
                      id="custom-server-url"
                      name="customServerUrl"
                      type="text"
                      value={customUrl}
                      onChange={(e) => setCustomUrl(e.target.value)}
                      placeholder="http://192.168.1.50:32400 o https://plex.midominio.com"
                      className="w-full px-3 py-2 bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-plex)] font-mono"
                    />
                    <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('modalPlexServer.portHint')}</p>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] flex items-center justify-between">
          <button
            type="button"
            onClick={fetchServers}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] py-2 px-3 rounded-lg hover:bg-[var(--bg-card)] transition-colors"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>{t('modalPlexServer.refresh')}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="py-2 px-4 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
            >{t('modalPlexServer.cancel')}</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || (!customMode && !selectedServerName)}
              className="py-2 px-5 rounded-xl text-xs font-semibold text-black bg-[var(--brand-plex)] hover:bg-[var(--brand-plex-hover)] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm font-medium"
            >
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('modalPlexServer.saveSync')}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
