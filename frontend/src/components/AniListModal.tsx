'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from './ToastProvider';
import { useModalA11y } from './useModalA11y';
import { X, ExternalLink, ShieldCheck, Loader2, CheckCircle2, ChevronDown, ChevronUp, KeyRound, Zap } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

interface AniListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export function AniListModal({ isOpen, onClose, onSuccess }: AniListModalProps) {
  const { t } = useI18n();
  const { showToast } = useToast();
  const [oauthUrl, setOauthUrl] = useState('');
  const [loadingOauth, setLoadingOauth] = useState(false);
  const [showManual, setShowManual] = useState(false);

  // Manual token state
  const [token, setToken] = useState('');
  const [loadingToken, setLoadingToken] = useState(false);
  const [verifiedUser, setVerifiedUser] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadOAuthUrl();
    }
  }, [isOpen]);

  const loadOAuthUrl = async () => {
    try {
      setLoadingOauth(true);
      const res = await api.anilist.getOAuthUrl();
      if (res.url) {
        setOauthUrl(res.url);
        if (res.state && typeof window !== 'undefined') {
          sessionStorage.setItem('anilist_oauth_state', res.state);
        }
      } else {
        // Fallback default redirect URL
        setOauthUrl(
          'https://anilist.co/api/v2/oauth/authorize?client_id=48583&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fconnections%2Fcallback%2Fanilist&response_type=code',
        );
      }
    } catch (e) {
      setOauthUrl(
        'https://anilist.co/api/v2/oauth/authorize?client_id=48583&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fconnections%2Fcallback%2Fanilist&response_type=code',
      );
    } finally {
      setLoadingOauth(false);
    }
  };

  const handleOAuthRedirect = () => {
    const targetUrl =
      oauthUrl ||
      'https://anilist.co/api/v2/oauth/authorize?client_id=48583&redirect_uri=http%3A%2F%2Flocalhost%3A3000%2Fconnections%2Fcallback%2Fanilist&response_type=code';
    window.location.href = targetUrl;
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) return;
    setLoadingToken(true);
    setVerifiedUser(null);
    try {
      const res = await api.anilist.connectToken(token.trim());
      setVerifiedUser(res);
      showToast(`¡Cuenta de AniList (@${res.remoteUsername || 'Usuario'}) vinculada exitosamente!`, 'success');
      setTimeout(() => {
        onSuccess();
        onClose();
        setVerifiedUser(null);
        setToken('');
      }, 1200);
    } catch (err: any) {
      showToast(`${t('modalAnilist.linkError')} ` + err.message, 'error');
    } finally {
      setLoadingToken(false);
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
        <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-3">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-[var(--radius-md,6px)] flex items-center justify-center text-xs font-bold bg-[var(--brand-anilist)] text-white"
            >
              AL
            </div>
            <div>
              <h3 className="font-bold text-sm text-[var(--text-primary)] font-heading">{t('modalAnilist.title')}</h3>
              <p className="text-[11px] text-[var(--text-muted)]">{t('modalAnilist.subtitle')}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label={t('common.close')}
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md,6px)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Opción 1: Botón OAuth 1-Click (Recomendado) */}
        <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-3">
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-sky-500/10 flex items-center justify-center text-sky-400 shrink-0">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <h4 className="font-bold text-xs text-[var(--text-primary)]">{t('modalAnilist.quickAuth')}</h4>
              <p className="text-[11px] mt-0.5 text-[var(--text-muted)]">{t('modalAnilist.oauthIntro')}</p>
            </div>
          </div>

          <button
            onClick={handleOAuthRedirect}
            disabled={loadingOauth}
            className="btn-primary w-full justify-center text-xs py-2.5"
          >
            {loadingOauth ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <ExternalLink className="w-3.5 h-3.5" />
            )}
            <span>{t('modalAnilist.connect')}</span>
          </button>
        </div>

        {/* Opción 2: Token Manual (Colapsable) */}
        <div className="border-t border-[var(--glass-border)] pt-3">
          <button
            type="button"
            onClick={() => setShowManual(!showManual)}
            className="flex items-center justify-between w-full text-[11px] text-[var(--text-muted)] hover:text-[var(--text-primary)] font-medium transition-colors cursor-pointer"
          >
            <span className="flex items-center gap-1.5">
              <KeyRound className="w-3 h-3" />{t('modalAnilist.preferManual')}</span>
            {showManual ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showManual && (
            <form onSubmit={handleManualSubmit} className="space-y-3 mt-3 text-xs animate-in fade-in">
              <div className="space-y-1">
                <input
                  type="password"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  placeholder={t('modalAnilist.tokenPlaceholder')}
                  className="glass-input font-mono text-xs"
                />
              </div>

              <button
                type="submit"
                disabled={loadingToken || !token.trim()}
                className="btn-secondary w-full justify-center"
              >
                {loadingToken && <Loader2 className="w-3 h-3 animate-spin" />}
                <span>{t('modalAnilist.verifySave')}</span>
              </button>
            </form>
          )}
        </div>

        <div className="p-3 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11px] flex items-start gap-2 text-[var(--text-secondary)]">
          <ShieldCheck className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
          <span>{t('modalAnilist.oauthSecurity')}</span>
        </div>
      </div>
    </div>
  );
}
