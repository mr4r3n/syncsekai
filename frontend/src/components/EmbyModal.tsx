'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, Server, CheckCircle2, Loader2, KeyRound, Users } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface EmbyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

interface DetectedUser {
  id: string;
  name: string;
}

export function EmbyModal({ isOpen, onClose, onSuccess }: EmbyModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();

  const [step, setStep] = useState<'form' | 'confirm'>('form');
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);

  const [serverUrl, setServerUrl] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [serverName, setServerName] = useState('');
  const [embyUsername, setEmbyUsername] = useState('');
  const [customUsername, setCustomUsername] = useState(false);

  const [detectedUsers, setDetectedUsers] = useState<DetectedUser[]>([]);
  const [librariesCount, setLibrariesCount] = useState(0);

  const { dialogProps } = useModalA11y(isOpen, onClose);

  const resetAndClose = () => {
    setStep('form');
    setServerUrl('');
    setApiKey('');
    setServerName('');
    setEmbyUsername('');
    setCustomUsername(false);
    setDetectedUsers([]);
    onClose();
  };

  const handleTestConnection = async () => {
    if (!serverUrl.trim() || !apiKey.trim()) {
      showToast(t('modalEmby.missingFields'), 'error');
      return;
    }
    setTesting(true);
    try {
      const res = await api.emby.testConnection(serverUrl.trim(), apiKey.trim());
      setServerName(res.serverName || '');
      setLibrariesCount(res.librariesCount || 0);
      const users: DetectedUser[] = Array.isArray(res.users) ? res.users : [];
      setDetectedUsers(users);
      setCustomUsername(users.length === 0);
      if (users.length > 0) setEmbyUsername(users[0].name);
      setStep('confirm');
      showToast(t('modalEmby.testSuccess'), 'success');
    } catch (err: any) {
      showToast(`${t('modalEmby.testError')} ` + err.message, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const res = await api.emby.connect(
        serverUrl.trim(),
        apiKey.trim(),
        serverName.trim() || undefined,
        embyUsername.trim() || undefined,
      );
      showToast(
        t('modalEmby.connectSuccess', {
          serverName: res.serverName,
          count: res.availableLibraries?.length || 0,
        }),
        'success',
      );
      window.dispatchEvent(new CustomEvent('plexsync:connections-updated'));
      onSuccess();
      resetAndClose();
    } catch (err: any) {
      showToast(`${t('modalEmby.connectError')} ` + err.message, 'error');
    } finally {
      setConnecting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in">
      <div
        {...dialogProps}
        className="bg-[var(--bg-card)] border border-[var(--glass-border)] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in zoom-in-95 flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[var(--glass-border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[var(--brand-emby)]/15 flex items-center justify-center text-[var(--brand-emby)] border border-[var(--brand-emby)]/20">
              <Server className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-[var(--text-primary)]">{t('modalEmby.title')}</h3>
              <p className="text-xs text-[var(--text-muted)]">{t('modalEmby.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={resetAndClose}
            aria-label={t('modalEmby.close')}
            className="text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1 rounded-lg hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {step === 'form' ? (
            <div className="space-y-3.5">
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('modalEmby.intro')}</p>

              <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-400 leading-relaxed">
                {t('modalEmby.premiereNotice')}
              </div>

              <div>
                <label htmlFor="emby-server-url" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {t('modalEmby.serverUrl')}
                </label>
                <input
                  id="emby-server-url"
                  name="embyServerUrl"
                  type="text"
                  value={serverUrl}
                  onChange={(e) => setServerUrl(e.target.value)}
                  placeholder="http://192.168.1.50:8096 o https://emby.midominio.com"
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-emby)] font-mono"
                />
                <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('modalEmby.portHint')}</p>
              </div>

              <div>
                <label htmlFor="emby-api-key" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {t('modalEmby.apiKey')}
                </label>
                <div className="relative">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="emby-api-key"
                    name="embyApiKey"
                    type="password"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={t('modalEmby.apiKeyPlaceholder')}
                    className="w-full pl-9 pr-3 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-emby)] font-mono"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] mt-1">{t('modalEmby.apiKeyHint')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3.5">
              <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 flex items-center gap-2.5 text-xs text-emerald-400 font-semibold">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{t('modalEmby.testSuccessDetail', { count: librariesCount })}</span>
              </div>

              <div>
                <label htmlFor="emby-server-name" className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {t('modalEmby.serverName')}
                </label>
                <input
                  id="emby-server-name"
                  name="embyServerName"
                  type="text"
                  value={serverName}
                  onChange={(e) => setServerName(e.target.value)}
                  placeholder={t('modalEmby.namePlaceholder')}
                  className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-emby)]"
                />
              </div>

              <div>
                <label className="flex items-center gap-1.5 text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  <Users className="w-3.5 h-3.5" />
                  {t('modalEmby.selectUser')}
                </label>
                <p className="text-[11px] text-[var(--text-muted)] mb-2">{t('modalEmby.selectUserHint')}</p>

                {detectedUsers.length > 0 && !customUsername ? (
                  <select
                    id="emby-username-select"
                    value={embyUsername}
                    onChange={(e) => setEmbyUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-emby)]"
                  >
                    {detectedUsers.map((u) => (
                      <option key={u.id} value={u.name}>{u.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    id="emby-username-input"
                    name="embyUsername"
                    type="text"
                    value={embyUsername}
                    onChange={(e) => setEmbyUsername(e.target.value)}
                    placeholder={t('modalEmby.usernamePlaceholder')}
                    className="w-full px-3 py-2 bg-[var(--bg-surface)] border border-[var(--glass-border)] rounded-lg text-sm text-[var(--text-primary)] focus:outline-none focus:border-[var(--brand-emby)]"
                  />
                )}

                {detectedUsers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setCustomUsername(!customUsername)}
                    className="text-[11px] text-[var(--accent-text)] hover:underline mt-1.5 cursor-pointer"
                  >
                    {customUsername ? t('modalEmby.useDetectedList') : t('modalEmby.typeManually')}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[var(--glass-border)] bg-[var(--bg-surface)] flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={step === 'confirm' ? () => setStep('form') : resetAndClose}
            className="py-2 px-4 rounded-xl text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-card)] transition-colors"
          >
            {step === 'confirm' ? t('modalEmby.back') : t('modalEmby.cancel')}
          </button>

          {step === 'form' ? (
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={testing || !serverUrl.trim() || !apiKey.trim()}
              className="py-2 px-5 rounded-xl text-xs font-semibold text-white bg-[var(--brand-emby)] hover:bg-[var(--brand-emby-hover)] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
            >
              {testing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('modalEmby.testConnection')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={handleConnect}
              disabled={connecting}
              className="py-2 px-5 rounded-xl text-xs font-semibold text-white bg-[var(--brand-emby)] hover:bg-[var(--brand-emby-hover)] disabled:opacity-50 transition-all flex items-center gap-2 shadow-sm"
            >
              {connecting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{t('modalEmby.connect')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
