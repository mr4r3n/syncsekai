'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import { Clock, Loader2, XCircle, ShieldCheck, ArrowRight } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export default function ConfirmDeletePage() {
  const { t } = useI18n();
  const params = useParams<{ token: string }>();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState(t('auth.verifyingDeletion'));
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.token) return;
    const token = Array.isArray(params.token) ? params.token[0] : params.token;

    api.auth
      .confirmAccountDeletion(token)
      .then((result) => {
        setMessage(result.message || t('auth.accountScheduledForDeletion'));
        if (result.scheduledAt) {
          const date = new Date(result.scheduledAt);
          setScheduledDate(
            date.toLocaleString('es-ES', {
              dateStyle: 'full',
              timeStyle: 'short',
            })
          );
        }
        setState('success');
      })
      .catch((error) => {
        setMessage(error.message || t('auth.confirmLinkInvalid'));
        setState('error');
      });
  }, [params?.token]);

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-app)] p-6">
      <section className="glass-card max-w-lg w-full p-8 text-center space-y-6 border border-rose-500/20 bg-rose-500/[0.02] shadow-2xl">
        {state === 'loading' && (
          <div className="space-y-4">
            <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <Loader2 className="w-7 h-7 animate-spin" />
            </div>
            <h1 className="text-lg font-bold text-[var(--text-primary)] font-heading">
              Verificando Enlace Seguro
            </h1>
            <p className="text-xs text-[var(--text-secondary)]">{t('auth.pleaseWaitValidating')}</p>
          </div>
        )}

        {state === 'success' && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
              <Clock className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-bold text-[var(--text-primary)] font-heading">{t('auth.gracePeriodTitle')}</h1>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('auth.gracePeriodDesc')}</p>
            </div>

            {scheduledDate && (
              <div className="p-4 rounded-[8px] bg-[var(--bg-surface)] border border-amber-500/30 text-center space-y-1">
                <span className="text-[10.5px] uppercase font-mono tracking-wider text-amber-400 font-semibold block">{t('auth.cancelDeadline')}</span>
                <p className="text-sm font-bold font-mono text-[var(--text-primary)]">
                  {scheduledDate}
                </p>
              </div>
            )}

            <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[11.5px] text-[var(--text-muted)] text-left space-y-1">
              <p>
                <strong className="text-[var(--text-primary)]">{t('auth.changedYourMind')}</strong>
              </p>
              <p>{t('auth.changedYourMindDesc')}{' '}<strong className="text-emerald-400">"Cancelar eliminación"</strong> en la pantalla de inicio o en Ajustes &gt; Seguridad para reactivar tu cuenta inmediatamente.
              </p>
            </div>

            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/login"
                className="btn-primary w-full py-2.5 text-xs font-semibold flex items-center justify-center gap-2"
              >
                <span>{t('auth.goToLogin')}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {state === 'error' && (
          <div className="space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="w-14 h-14 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/10">
              <XCircle className="w-7 h-7" />
            </div>
            <div className="space-y-2">
              <h1 className="text-lg font-bold text-[var(--text-primary)] font-heading">{t('auth.linkInvalidOrExpired')}</h1>
              <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                {message}
              </p>
            </div>

            <div className="pt-2">
              <Link
                href="/login"
                className="btn-secondary w-full py-2.5 text-xs font-semibold inline-flex items-center justify-center gap-2"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>{t('auth.backToLoginLong')}</span>
              </Link>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
