'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, ShieldCheck, Loader2, KeyRound, UserCheck, Lock, Mail } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface KitsuModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function KitsuModal({ isOpen, onClose, onSuccess }: KitsuModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [authMode, setAuthMode] = useState<'credentials' | 'token'>('credentials');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authMode === 'credentials') {
        if (!username.trim() || !password) {
          showToast(t('modalKitsu.enterUserAndPassword'), 'error');
          setLoading(false);
          return;
        }
        await api.kitsu.connectCredentials(username.trim(), password);
      } else {
        if (!token.trim()) {
          showToast(t('modalKitsu.enterValidToken'), 'error');
          setLoading(false);
          return;
        }
        await api.kitsu.connectToken(token.trim());
      }

      showToast(t('modalKitsu.linked'), 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`${t('modalKitsu.linkError')} ` + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  // Foco dentro al abrir, Tab acotado al diálogo y foco devuelto al cerrar.
  const { dialogProps } = useModalA11y(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-in fade-in">
      <div
        {...dialogProps}
        className="w-full max-w-md rounded-[6px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--glass-shadow-lg)] space-y-5 text-[var(--text-primary)] backdrop-blur-xl">
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-[4px] flex items-center justify-center text-xs font-bold bg-[var(--brand-kitsu)] text-white">
              KT
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] font-heading">{t('modalKitsu.title')}</h3>
              <p className="text-[11px] text-[var(--text-muted)]">{t('modalKitsu.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('modalKitsu.close')}
            className="p-1.5 min-w-[28px] min-h-[28px] flex items-center justify-center rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* SELECTOR DE MODO (Credenciales vs Token) */}
        <div className="flex rounded-[6px] bg-[var(--bg-surface)] p-1 border border-[var(--border-subtle)]">
          <button
            type="button"
            onClick={() => setAuthMode('credentials')}
            className={`flex-1 py-1.5 px-3 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'credentials'
                ? 'bg-[var(--brand-kitsu)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <UserCheck className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('modalKitsu.tabAccount')}</span>
          </button>
          <button
            type="button"
            onClick={() => setAuthMode('token')}
            className={`flex-1 py-1.5 px-3 rounded-[4px] text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
              authMode === 'token'
                ? 'bg-[var(--brand-kitsu)] text-white shadow-sm'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" aria-hidden="true" />
            <span>{t('modalKitsu.tabToken')}</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {authMode === 'credentials' ? (
            <>
              <div className="space-y-1.5">
                <label htmlFor="kitsu-username" className="text-xs font-semibold text-[var(--text-secondary)]">{t('modalKitsu.user')}</label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="kitsu-username"
                    name="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder={t('modalKitsu.userPlaceholder')}
                    spellCheck={false}
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[var(--brand-kitsu)] outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="kitsu-password" className="text-xs font-semibold text-[var(--text-secondary)]">{t('modalKitsu.password')}</label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
                  <input
                    id="kitsu-password"
                    name="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    required
                    className="w-full pl-9 pr-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[var(--brand-kitsu)] outline-none"
                  />
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-1.5">
              <label htmlFor="kitsu-token" className="text-xs font-semibold text-[var(--text-secondary)]">{t('modalKitsu.accessToken')}</label>
              <input
                id="kitsu-token"
                name="token"
                type="text"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('modalKitsu.tokenPlaceholder')}
                spellCheck={false}
                required
                className="w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:border-[var(--brand-kitsu)] outline-none font-mono"
              />
            </div>
          )}

          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
            <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
            <span>{t('modalKitsu.encrypted')}</span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-[6px] text-xs font-bold bg-[var(--brand-kitsu)] text-white hover:bg-[var(--brand-kitsu-hover)] transition-all flex items-center justify-center gap-2 shadow-lg shadow-[var(--brand-kitsu)]/20 disabled:opacity-50 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : t('modalKitsu.linkAccount')}
          </button>
        </form>
      </div>
    </div>
  );
}
