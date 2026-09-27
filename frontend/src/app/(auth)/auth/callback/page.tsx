'use client';

import { useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Loader2 } from 'lucide-react';

import { useI18n } from '@/i18n/I18nProvider';
export default function AuthCallbackPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current || typeof window === 'undefined') return;
    executedRef.current = true;

    const params = new URLSearchParams(window.location.search);
    const username = params.get('username');
    const returnTo = params.get('return_to');
    const error = params.get('error');
    const sanitizeTarget = (raw: string | null, fallback: string) =>
      raw && raw.startsWith('/') && !raw.startsWith('//') && !raw.includes(':') && !raw.includes('\\')
        ? raw
        : fallback;

    history.replaceState(null, '', window.location.pathname);
    if (error) {
      showToast(`${t('auth.authError')} ` + error, 'error');
      window.location.replace(sanitizeTarget(returnTo, '/login'));
      return;
    }

    api.auth.me()
      .then(() => {
        showToast(`¡Bienvenido de nuevo, ${username || 'usuario'}!`, 'success');
        window.location.replace(sanitizeTarget(returnTo, '/connections'));
      })
      .catch(() => {
        showToast(t('auth.socialSessionInvalid'), 'error');
        window.location.replace('/login');
      });
  }, [showToast]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-9 h-9 animate-spin text-[#FF634A]" />
      <span className="text-xs font-mono text-[var(--text-muted)]">{t('auth.signingIn')}</span>
    </div>
  );
}
