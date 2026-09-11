'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

function MalCallbackContent() {
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
    const errorParam = searchParams.get('error_description') || searchParams.get('error');

    if (errorParam) {
      setStatus('error');
      setErrorMessage(`MyAnimeList reportó un error: ${errorParam}`);
      return;
    }

    if (!code) {
      setStatus('error');
      setErrorMessage(t('connections.noAuthCode'));
      return;
    }

    const codeVerifier = typeof window !== 'undefined' ? sessionStorage.getItem('mal_code_verifier') || '' : '';

    try {
      const res = await api.mal.handleOAuthCallback({ code, codeVerifier });
      setUserData(res);
      setStatus('success');
      showToast(`¡Cuenta de MyAnimeList (@${res.remoteUsername || 'Usuario'}) vinculada con éxito!`, 'success');

      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('mal_code_verifier');
      }

      setTimeout(() => {
        router.push('/connections');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || t('connections.oauthErrorMal'));
      showToast(`${t('connections.connectionErrorMal')} ` + err.message, 'error');
    }
  };

  return (
    <div className="w-full max-w-md p-6 rounded-[6px] glass-card text-center space-y-5 text-[var(--text-primary)]">
      {status === 'loading' && (
        <div className="py-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#2e51a2] mx-auto" />
          <h2 className="font-bold text-sm font-heading">{t('connections.completingMal')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('connections.exchangingPkce')}</p>
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
              <div className="w-full h-full flex items-center justify-center font-bold text-sm bg-[#2e51a2] text-white">
                MAL
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
        <div className="py-6 space-y-4 animate-in zoom-in-95">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>

          <div className="space-y-1">
            <h2 className="font-bold text-sm text-rose-400">{t('connections.authFailed')}</h2>
            <p className="text-xs text-[var(--text-muted)]">{errorMessage}</p>
          </div>

          <button
            onClick={() => router.push('/connections')}
            className="btn-secondary w-full justify-center text-xs py-2"
          >{t('connections.backToConnections')}</button>
        </div>
      )}
    </div>
  );
}

export default function MalCallbackPage() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-[var(--bg-app)] flex items-center justify-center p-4">
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[#2e51a2]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('connections.loadingMalReturn')}</span>
          </div>
        }
      >
        <MalCallbackContent />
      </Suspense>
    </div>
  );
}
