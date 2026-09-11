'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

function AniListCallbackContent() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [userData, setUserData] = useState<any | null>(null);

  useEffect(() => {
    handleCallback();
  }, []);

  const handleCallback = async () => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error_description') || searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(`AniList reportó un error: ${errorParam}`);
      return;
    }

    const savedState = typeof window !== 'undefined' ? sessionStorage.getItem('anilist_oauth_state') : null;

    let tokenFromHash = '';
    if (typeof window !== 'undefined' && window.location.hash) {
      const hashParams = new URLSearchParams(window.location.hash.substring(1));
      tokenFromHash = hashParams.get('access_token') || '';
    }

    try {
      let res: any;
      if (code) {
        if (savedState && state && state !== savedState) {
          setStatus('error');
          setErrorMessage('El estado de autorización OAuth no coincide. Posible intento de manipulación.');
          return;
        }
        res = await api.anilist.handleOAuthCallback(code, state || undefined);
        if (typeof window !== 'undefined') sessionStorage.removeItem('anilist_oauth_state');
      } else if (tokenFromHash) {
        // S02: Rechazar vinculación arbitraria desde fragmento de URL sin intención previa de la sesión
        if (!savedState) {
          setStatus('error');
          setErrorMessage('No hay una solicitud de vinculación pendiente en esta sesión. Abre el modal de AniList para conectar.');
          return;
        }
        res = await api.anilist.connectToken(tokenFromHash);
        if (typeof window !== 'undefined') sessionStorage.removeItem('anilist_oauth_state');
      } else {
        setStatus('error');
        setErrorMessage(t('connections.noCodeOrToken'));
        return;
      }

      setUserData(res);
      setStatus('success');
      showToast(`¡Cuenta de AniList (@${res.remoteUsername || 'Usuario'}) vinculada con éxito!`, 'success');

      setTimeout(() => {
        router.push('/connections');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || t('connections.oauthErrorAniList'));
      showToast(`${t('connections.connectionErrorAniList')} ` + err.message, 'error');
    }
  };

  return (
    <div className="w-full max-w-md p-6 rounded-[6px] glass-card text-center space-y-5 text-[var(--text-primary)]">
      {status === 'loading' && (
        <div className="py-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)] mx-auto" />
          <h2 className="font-bold text-sm font-heading">{t('connections.completingAniList')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('connections.exchangingCredentials')}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-6 space-y-4 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full overflow-hidden mx-auto border-2 border-emerald-400">
            {userData?.avatarUrl ? (
              <img
                src={userData.avatarUrl}
                alt={userData.remoteUsername}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className="w-full h-full flex items-center justify-center font-bold text-sm bg-[#02a9ff] text-white"
              >
                AL
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5 font-bold text-base">
              <span>@{userData?.remoteUsername}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">{t('connections.accountLinkedRedirecting')}</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="py-6 space-y-4 animate-in fade-in">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto border border-rose-500/20">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div>
            <h2 className="font-bold text-sm text-rose-400 font-heading">{t('connections.linkingError')}</h2>
            <p className="text-xs mt-1 text-[var(--text-muted)]">
              {errorMessage}
            </p>
          </div>

          <button
            onClick={() => router.push('/connections')}
            className="btn-secondary mx-auto"
          >{t('connections.backToHub')}</button>
        </div>
      )}
    </div>
  );
}

export default function AniListCallbackPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)]">
      <Suspense
        fallback={
          <div className="text-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400 mx-auto" />
            <p className="text-xs mt-2 text-[var(--text-muted)]">{t('connections.loadingAuthData')}</p>
          </div>
        }
      >
        <AniListCallbackContent />
      </Suspense>
    </div>
  );
}
