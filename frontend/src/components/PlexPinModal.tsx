'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, ExternalLink, Loader2, ShieldCheck, Server, CheckCircle2, RefreshCw } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface PlexPinModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function PlexPinModal({ isOpen, onClose, onSuccess }: PlexPinModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [tab, setTab] = useState<'pin' | 'manual'>('pin');

  // PIN state
  const [pinData, setPinData] = useState<{ id: number; code: string; authUrl: string; clientIdentifier?: string } | null>(null);
  const [loadingPin, setLoadingPin] = useState(false);
  const [polling, setPolling] = useState(false);

  // Manual token state
  const [manualToken, setManualToken] = useState('');
  const [serverUrl, setServerUrl] = useState('http://localhost:32400');
  const [serverName, setServerName] = useState('Plex Home Server');
  const [savingManual, setSavingManual] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  useEffect(() => {
    if (isOpen && tab === 'pin') {
      fetchPin();
    }
  }, [isOpen, tab]);

  // Polling for PIN verification
  useEffect(() => {
    let interval: any = null;
    if (isOpen && pinData && polling) {
      interval = setInterval(async () => {
        try {
          const res = await api.plex.verifyPin(pinData.id, pinData.clientIdentifier);
          if (res.verified) {
            setPolling(false);
            const count = res.libraries ? res.libraries.length : 0;
            showToast(
              `¡Plex vinculado! Servidor "${res.serverName || 'Plex'}" con ${count} categorías detectadas.`,
              'success',
            );
            onSuccess();
            onClose();
          }
        } catch (err) {
          // continue polling until approved or closed
        }
      }, 2500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isOpen, pinData, polling]);

  const fetchPin = async () => {
    setLoadingPin(true);
    try {
      // Solicitar el PIN directamente desde el navegador del cliente a plex.tv
      // para que la IP del creador del PIN coincida con la del navegador del usuario
      // y Plex NO dispare la advertencia de seguridad con la IP del servidor.
      const clientIdentifier =
        (typeof window !== 'undefined' && localStorage.getItem('plexsync_client_id')) ||
        (() => {
          const id = 'SyncSekai-' + Math.random().toString(36).substring(2, 12);
          if (typeof window !== 'undefined') localStorage.setItem('plexsync_client_id', id);
          return id;
        })();

      const res = await fetch('https://plex.tv/api/v2/pins?strong=true', {
        method: 'POST',
        headers: {
          'X-Plex-Product': 'SyncSekai',
          'X-Plex-Version': '1.0.0',
          'X-Plex-Client-Identifier': clientIdentifier,
          'X-Plex-Platform': 'Web',
          'X-Plex-Device': 'Browser',
          'X-Plex-Device-Name': 'SyncSekai Web App',
          Accept: 'application/json',
        },
      });

      if (res.ok) {
        const data = await res.json();
        const authUrl = `https://app.plex.tv/auth#?clientID=${encodeURIComponent(
          clientIdentifier,
        )}&code=${encodeURIComponent(data.code)}&context%5Bdevice%5D%5Bproduct%5D=SyncSekai`;

        setPinData({
          id: data.id,
          code: data.code,
          authUrl,
          clientIdentifier,
        });
        setPolling(true);
      } else {
        throw new Error('Plex API error');
      }
    } catch (err: any) {
      // Fallback transparente al backend en caso de bloqueo de red local / adblock
      try {
        const data = await api.plex.requestPin();
        setPinData(data);
        setPolling(true);
      } catch (fallbackErr: any) {
        showToast(`${t('modalPlex.pinRequestError')} ` + fallbackErr.message, 'error');
      }
    } finally {
      setLoadingPin(false);
    }
  };

  const handleTestConnection = async () => {
    if (!serverUrl || !manualToken) {
      showToast(t('modalPlex.enterUrlAndToken'), 'info');
      return;
    }
    setTestingConnection(true);
    try {
      const res = await api.plex.testConnection(serverUrl, manualToken);
      if (res.success) {
        showToast(`¡Conexión exitosa! Se encontraron ${res.librariesCount} categorías en tu Plex.`, 'success');
      } else {
        showToast(t('modalPlex.couldNotReadLibraries'), 'error');
      }
    } catch (err: any) {
      showToast(`Error de conexión: ${err.message}`, 'error');
    } finally {
      setTestingConnection(false);
    }
  };

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualToken) return;
    setSavingManual(true);
    try {
      const res = await api.plex.connectManual(manualToken, serverUrl, serverName);
      const count = res.availableLibraries ? res.availableLibraries.length : 0;
      showToast(`¡Servidor Plex conectado! (${count} categorías disponibles)`, 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`${t('modalPlex.tokenConnectError')} ` + err.message, 'error');
    } finally {
      setSavingManual(false);
    }
  };

  // Foco dentro al abrir, Tab acotado al diálogo y foco devuelto al cerrar.
  const { dialogProps } = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div
        {...dialogProps}
        className="w-full max-w-md rounded-[var(--radius-lg,10px)] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--glass-shadow-lg)] space-y-5 text-[var(--text-primary)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-[var(--radius-md,6px)] flex items-center justify-center text-xs font-bold bg-[var(--brand-plex)] text-black"
            >
              ▶
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] font-heading">{t('modalPlex.title')}</h3>
              <p className="text-[11px] text-[var(--text-muted)]">{t('modalPlex.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('modalPlex.close')}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md,6px)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
          <button
            onClick={() => setTab('pin')}
            className={`flex-1 py-1.5 rounded-[4px] font-semibold transition-all cursor-pointer ${
              tab === 'pin'
                ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >{t('modalPlex.tabPin')}</button>
          <button
            onClick={() => setTab('manual')}
            className={`flex-1 py-1.5 rounded-[4px] font-semibold transition-all cursor-pointer ${
              tab === 'manual'
                ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] shadow-sm'
                : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
            }`}
          >{t('modalPlex.tabManual')}</button>
        </div>

        {tab === 'pin' && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs text-[var(--text-secondary)] space-y-1.5">
              <p className="font-semibold text-[var(--text-primary)]">{t('modalPlex.howTitle')}</p>
              <ol className="list-decimal list-inside space-y-1 text-[11.5px] leading-relaxed text-[var(--text-muted)]">
                <li>{t('modalPlex.step1')}{' '}<strong>"Abrir Autorización en Plex.tv"</strong></li>
                <li>{t('modalPlex.step2')}</li>
                <li>{t('modalPlex.step3')}</li>
              </ol>
            </div>

            <div className="text-center py-4 space-y-4 border border-[var(--border-subtle)] rounded-[6px] bg-[var(--bg-surface-elevated)]">
              {loadingPin ? (
                <div className="flex flex-col items-center gap-2 py-4">
                  <Loader2 className="w-6 h-6 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
                  <span className="text-xs text-[var(--text-muted)]">{t('modalPlex.generating')}</span>
                </div>
              ) : pinData ? (
                <div className="space-y-3">
                  <div className="text-xs text-[var(--text-muted)] font-mono">{t('modalPlex.codeLabel')}</div>
                  {/*
                    El código de un PIN "strong" son 25 caracteres y viaja en la URL de
                    autorización, no se teclea. Con inline-block y tracking-widest se salía
                    de la tarjeta. Ahora se ajusta al ancho disponible y parte por caracteres.
                  */}
                  <div className="w-full max-w-full break-all text-center text-base sm:text-xl font-mono font-extrabold tracking-wide text-amber-400 bg-amber-400/10 py-2 px-4 rounded-[6px] border border-amber-400/20 select-all">
                    {pinData.code}
                  </div>

                  {polling && (
                    <div className="flex items-center justify-center gap-2 text-xs text-emerald-400 font-mono pt-1">
                      <Loader2 className="w-3 h-3 animate-spin text-[var(--accent-text)]" aria-hidden="true" />
                      <span>{t('modalPlex.waiting')}</span>
                    </div>
                  )}

                  <div className="pt-2">
                    <a
                      href={pinData.authUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-primary w-full py-2.5 text-xs font-bold flex items-center justify-center gap-2"
                    >
                      <span>{t('modalPlex.openAuth')}</span>
                      <ExternalLink className="w-3.5 h-3.5" aria-hidden="true" />
                    </a>
                  </div>
                </div>
              ) : (
                <button
                  onClick={fetchPin}
                  className="btn-secondary py-2 px-4 text-xs font-semibold"
                >{t('modalPlex.retryPin')}</button>
              )}
            </div>

            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-1">
              <span>{t('modalPlex.noWindow')}</span>
              <button
                onClick={fetchPin}
                className="text-amber-400 hover:underline flex items-center gap-1 cursor-pointer font-medium"
              >
                <RefreshCw className="w-3 h-3" aria-hidden="true" />
                <span>{t('modalPlex.newCode')}</span>
              </button>
            </div>
          </div>
        )}

        {tab === 'manual' && (
          <form onSubmit={handleManualConnect} className="space-y-4 text-xs">
            <div className="space-y-1.5">
              <label htmlFor="plex-server-url" className="font-bold text-[var(--text-primary)]">{t('modalPlex.serverUrl')}</label>
              <input
                id="plex-server-url"
                name="serverUrl"
                type="text"
                value={serverUrl}
                onChange={(e) => setServerUrl(e.target.value)}
                placeholder="http://localhost:32400 o http://192.168.1.50:32400"
                required
                className="glass-input font-mono text-xs"
              />
              <p className="text-[10.5px] text-[var(--text-muted)]">
                Usa <code className="font-mono">http://localhost:32400</code>{' '}{t('modalPlex.localHint')}</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="plex-manual-token" className="font-bold text-[var(--text-primary)]">{t('modalPlex.authToken')}</label>
              <input
                id="plex-manual-token"
                name="manualToken"
                type="password"
                value={manualToken}
                onChange={(e) => setManualToken(e.target.value)}
                placeholder={t('modalPlex.tokenPlaceholder')}
                required
                className="glass-input font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="plex-server-name" className="font-bold text-[var(--text-primary)]">{t('modalPlex.serverName')}</label>
              <input
                id="plex-server-name"
                name="serverName"
                type="text"
                value={serverName}
                onChange={(e) => setServerName(e.target.value)}
                placeholder={t('modalPlex.namePlaceholder2')}
                className="glass-input text-xs"
              />
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={handleTestConnection}
                disabled={testingConnection || !manualToken}
                className="btn-secondary flex-1 justify-center"
              >
                {testingConnection && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{t('modalPlex.testConnection')}</span>
              </button>

              <button
                type="submit"
                disabled={savingManual || !manualToken}
                className="btn-primary flex-1 justify-center"
              >
                {savingManual && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{t('modalPlex.saveConnect')}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
