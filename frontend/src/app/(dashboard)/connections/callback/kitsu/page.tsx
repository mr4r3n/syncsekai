'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

function KitsuCallbackContent() {
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
      setErrorMessage(`Kitsu reportó un error: ${errorParam}`);
      return;
    }

    try {
      if (!code) {
        setStatus('error');
        setErrorMessage(t('connections.noAuthCode'));
        return;
      }

      const res = await api.kitsu.handleOAuthCallback(code);
      setUserData(res);
      setStatus('success');
      showToast(`¡Cuenta de Kitsu (@${res.username || 'Usuario'}) vinculada con éxito!`, 'success');

      setTimeout(() => {
        router.push('/connections');
      }, 1500);
    } catch (err: any) {
      setStatus('error');
      setErrorMessage(err.message || t('connections.oauthErrorKitsu'));
      showToast(`${t('connections.connectionErrorKitsu')} ` + err.message, 'error');
    }
  };

  return (
    <div className="w-full max-w-md p-6 rounded-[6px] glass-card text-center space-y-5 text-[var(--text-primary)]">
      {status === 'loading' && (
        <div className="py-8 space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-[#FF634A] mx-auto" />
          <h2 className="font-bold text-sm font-heading">{t('connections.completingKitsu')}</h2>
          <p className="text-xs text-[var(--text-muted)]">{t('connections.exchangingKitsu')}</p>
        </div>
      )}

      {status === 'success' && (
        <div className="py-6 space-y-4 animate-in zoom-in-95">
          <div className="w-16 h-16 rounded-full overflow-hidden mx-auto border-2 border-emerald-400">
            {userData?.avatarUrl ? (
              <img
                src={userData.avatarUrl}
                alt={userData.username}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center font-bold text-sm bg-[#fd755c] text-white">
                KT
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-center gap-1.5 font-bold text-base">
              <span>@{userData?.username}</span>
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            </div>
            <p className="text-xs text-emerald-400 font-mono mt-0.5">{t('connections.accountLinkedRedirecting')}</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="py-6 space-y-4">
          <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-500 flex items-center justify-center mx-auto">
            <AlertCircle className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="font-bold text-sm text-rose-400">{t('connections.linkError')}</h2>
            <p className="text-xs text-[var(--text-muted)]">{errorMessage}</p>
          </div>
          <button
            onClick={() => router.push('/connections')}
            className="btn-secondary text-xs px-4 py-2 mt-2"
          >{t('connections.backToConnections')}</button>
        </div>
      )}
    </div>
  );
}

export default function KitsuCallbackPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)]">
      <Suspense fallback={<Loader2 className="w-8 h-8 animate-spin text-[#FF634A]" />}>
        <KitsuCallbackContent />
      </Suspense>
    </div>
  );
}
