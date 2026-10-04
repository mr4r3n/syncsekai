'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Loader2 } from 'lucide-react';

import { useI18n } from '@/i18n/I18nProvider';

/** Codes the backend sends (social-auth.controller.ts, oauthErrorCode); anything else reads as the generic one. */
const OAUTH_ERRORS = [
  'ACCESS_DENIED',
  'GOOGLE_NOT_CONFIGURED',
  'DISCORD_NOT_CONFIGURED',
  'IDENTITY_NOT_VERIFIED',
  'ACCOUNT_DEACTIVATED',
  'ACCOUNT_SUSPENDED',
  'REGISTRATION_CLOSED',
  'EMAIL_DOMAIN_NOT_ALLOWED',
];

/**
 * A path on this site, or the fallback. Resolving it is what catches "/\t/evil.example":
 * browsers drop tabs and newlines from URLs and read it as "//evil.example".
 */
function sanitizeTarget(raw: string | null, fallback: string) {
  if (!raw?.startsWith('/')) return fallback;
  try {
    const url = new URL(raw, window.location.origin);
    return url.origin === window.location.origin ? url.pathname + url.search + url.hash : fallback;
  } catch {
    return fallback;
  }
}

export default function AuthCallbackPage() {
  const { t } = useI18n();
  const { showToast } = useToast();
  const router = useRouter();
  const executedRef = useRef(false);

  useEffect(() => {
    if (executedRef.current || typeof window === 'undefined') return;
    executedRef.current = true;

    // Nothing from the URL is shown as text: anyone can write a link to this page.
    const params = new URLSearchParams(window.location.search);
    const returnTo = params.get('return_to');
    const error = params.get('error');

    history.replaceState(null, '', window.location.pathname);
    // Errors navigate inside the app so their notice survives (a full page load wiped it
    // before anyone could read it). A successful sign-in still reloads the page, so the
    // whole app starts with the new session.
    if (error) {
      showToast(t(`auth.oauthErrors.${OAUTH_ERRORS.includes(error) ? error : 'SOCIAL_AUTH_FAILED'}`), 'error');
      router.replace(sanitizeTarget(returnTo, '/login'));
      return;
    }

    api.auth.me()
      .then((me) => {
        showToast(t('auth.welcomeBack', { username: me?.username || t('common.user') }), 'success');
        window.location.replace(sanitizeTarget(returnTo, '/connections'));
      })
      .catch(() => {
        showToast(t('auth.socialSessionInvalid'), 'error');
        router.replace('/login');
      });
  }, [showToast, router]);

  return (
    <div className="min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] flex flex-col items-center justify-center gap-4">
      <Loader2 className="w-9 h-9 animate-spin text-[#FF634A]" />
      <span className="text-xs font-mono text-[var(--text-muted)]">{t('auth.signingIn')}</span>
    </div>
  );
}
