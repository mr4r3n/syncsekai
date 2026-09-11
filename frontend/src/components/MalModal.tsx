'use client';

import { useState } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, ExternalLink, ShieldCheck, Loader2, KeyRound, ChevronRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface MalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function MalModal({ isOpen, onClose, onSuccess }: MalModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [showManualInput, setShowManualInput] = useState(false);

  const handleOAuthClick = async () => {
    try {
      setOauthLoading(true);
      showToast(t('modalMal.gettingAuthLink'), 'info');
      const res = await api.mal.getOAuthUrl();
      const targetUrl = res.url || (res as any).authUrl;
      if (!targetUrl) {
        throw new Error(t('modalMal.noAuthLink'));
      }
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('mal_code_verifier', res.codeVerifier);
      }
      window.location.href = targetUrl;
    } catch (err: any) {
      showToast(err.message || t('modalMal.oauthStartError'), 'error');
      setOauthLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      await api.mal.connectToken(token);
      showToast(t('modalMal.linked'), 'success');
      onSuccess();
      onClose();
    } catch (err: any) {
      showToast(`${t('modalMal.linkError')} ` + err.message, 'error');
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
            <div className="w-7 h-7 rounded-[4px] flex items-center justify-center text-xs font-bold bg-[var(--brand-mal)] text-white">
              MAL
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] font-heading">{t('modalMal.title')}</h3>
              <p className="text-[11px] text-[var(--text-muted)]">{t('modalMal.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* MÉTODO 1: AUTORIZACIÓN OAUTH OFICIAL 1-CLIC */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleOAuthClick}
            disabled={oauthLoading || loading}
            className="w-full py-3 px-4 rounded-[6px] text-xs font-bold bg-[var(--brand-mal)] text-white hover:bg-[var(--brand-mal-hover)] transition-all flex items-center justify-between shadow-lg shadow-[var(--brand-mal)]/20 disabled:opacity-50 cursor-pointer hover:-translate-y-0.5 active:translate-y-0"
          >
            <div className="flex items-center gap-2.5">
              {oauthLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
              <span>{t('modalMal.authorize')}</span>
            </div>
            <ChevronRight className="w-4 h-4" />
          </button>
          <p className="text-[11px] text-[var(--text-muted)] text-center leading-relaxed">{t('modalMal.redirectNotice')}</p>
        </div>

        {/* DIVIDER */}
        <div className="relative flex items-center justify-center pt-1">
          <div className="border-t border-[var(--border-subtle)] w-full" />
          <button
            type="button"
            onClick={() => setShowManualInput((prev) => !prev)}
            className="bg-[var(--bg-surface-elevated)] px-3 py-1 rounded-[4px] border border-[var(--border-subtle)] text-[10px] font-mono text-[var(--text-muted)] hover:text-[var(--text-primary)] uppercase tracking-wider shrink-0 transition-colors cursor-pointer"
          >
            {showManualInput ? 'Ocultar Token Manual' : t('modalMal.orEnterTokenManually')}
          </button>
          <div className="border-t border-[var(--border-subtle)] w-full" />
        </div>

        {/* MÉTODO 2: ACCESS TOKEN MANUAL */}
        {showManualInput && (
          <form onSubmit={handleSubmit} className="space-y-3.5 text-xs animate-in slide-in-from-top-2">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                  <span>{t('modalMal.accessToken')}</span>
                </label>
                <a
                  href="https://myanimelist.net/apiconfig"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[11px] flex items-center gap-1 hover:underline text-[var(--brand-mal)]"
                >{t('modalMal.apiConfig')}<ExternalLink className="w-3 h-3" />
                </a>
              </div>
              <input
                type="password"
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder={t('modalMal.tokenPlaceholder')}
                required
                className="glass-input font-mono text-xs w-full px-3 py-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-primary)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-secondary w-full justify-center text-xs py-2.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>{loading ? t('modalMal.verifyingWithMal') : t('modalMal.saveManualToken')}</span>
            </button>
          </form>
        )}

        <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] flex items-start gap-2 text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-indigo-400 shrink-0 mt-0.5" />
          <span>{t('modalMal.credentialsEncrypted')}</span>
        </div>
      </div>
    </div>
  );
}
