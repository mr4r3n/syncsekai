'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export default function ConfirmEmailPage() {
  const { t } = useI18n();
  const params = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(t('auth.confirmingNewEmail'));

  useEffect(() => {
    if (!params.token) return;
    api.auth.confirmEmailChange(params.token)
      .then((result) => {
        setMessage(result.message || t('auth.emailConfirmed'));
        setState('success');
      })
      .catch((error) => {
        setMessage(error.message || t('auth.linkInvalidOrExpiredShort'));
        setState('error');
      });
  }, [params.token]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] p-6">
      <section className="glass-card max-w-md w-full p-8 text-center space-y-4">
        {state === 'loading' && <Loader2 className="w-10 h-10 animate-spin mx-auto text-[#FF634A]" />}
        {state === 'success' && <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />}
        {state === 'error' && <XCircle className="w-10 h-10 mx-auto text-red-400" />}
        <h1 className="text-lg font-bold">{t('auth.emailConfirmTitle')}</h1>
        <p className="text-sm text-[var(--text-secondary)]">{message}</p>
        {state !== 'loading' && <Link href="/login" className="btn-primary inline-flex">{t('auth.goToSignIn')}</Link>}
      </section>
    </main>
  );
}
