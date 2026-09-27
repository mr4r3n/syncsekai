'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { CheckCircle2, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { useI18n } from '@/i18n/I18nProvider';
export default function ActivateAccountPage() {
  const { t } = useI18n();
  const params = useParams();
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const token = params?.token as string;

  useEffect(() => {
    if (token) {
      handleActivation(token);
    }
  }, [token]);

  const handleActivation = async (actToken: string) => {
    try {
      setLoading(true);
      const res = await api.auth.activateAccount(actToken);
      setSuccess(true);
      showToast(res.message || t('auth.accountActivatedToast'), 'success');
    } catch (err: any) {
      setErrorMsg(err.message || t('auth.activationTokenInvalid'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-app)]">
      <div
        className="w-full max-w-[420px] p-8 rounded-2xl border space-y-6 shadow-2xl text-center"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderColor: 'var(--border-subtle)',
        }}
      >
        <div className="space-y-2">
          <div
            className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center font-bold text-lg shadow-md"
            style={{ backgroundColor: 'var(--text-primary)', color: 'var(--bg-app)' }}
          >
            P
          </div>
          <h1 className="text-xl font-bold text-[var(--text-primary)]">{t('auth.activationTitle')}</h1>
        </div>

        {loading ? (
          <div className="py-8 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <p className="text-xs text-zinc-400">{t('auth.verifyingActivation')}</p>
          </div>
        ) : success ? (
          <div className="space-y-5 py-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 mx-auto flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-white">{t('auth.accountActivated')}</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">{t('auth.canSignInNow')}</p>
            </div>
            <Link
              href="/login"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold bg-sky-500 text-black hover:bg-sky-400 transition-all flex items-center justify-center gap-2 shadow-md block"
            >
              <span>{t('auth.goToLogin')}</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        ) : (
          <div className="space-y-5 py-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 mx-auto flex items-center justify-center">
              <AlertCircle className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h2 className="text-base font-bold text-rose-300">{t('auth.activationError')}</h2>
              <p className="text-xs text-zinc-400 leading-relaxed">{errorMsg}</p>
            </div>
            <Link
              href="/register"
              className="w-full py-2.5 px-4 rounded-xl text-xs font-bold border border-white/10 bg-white/5 text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2 block"
            >
              <span>{t('auth.backToRegister')}</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
