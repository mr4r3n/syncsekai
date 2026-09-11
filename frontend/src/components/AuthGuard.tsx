'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { api } from '@/lib/api';
import { useI18n } from '@/i18n/I18nProvider';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Rutas públicas dentro del dashboard que no deben bloquearse
    if (pathname === '/docs' || pathname.startsWith('/docs')) {
      setIsAuthenticated(true);
      return;
    }

    const verifySession = async () => {
      try {
        const me = await api.auth.me();
        if (isMounted) {
          if (me && (me.id || me.user?.id || me.username)) {
            setIsAuthenticated(true);
          } else {
            setIsAuthenticated(false);
            if (typeof window !== 'undefined') {
              window.location.replace('/login?expired=true');
            }
          }
        }
      } catch {
        if (isMounted) {
          setIsAuthenticated(false);
          if (typeof window !== 'undefined') {
            window.location.replace('/login?expired=true');
          }
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, [pathname]);

  if (isAuthenticated === null) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center space-y-3"
      >
        <div
          className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        <span className="text-xs font-mono text-[var(--text-muted)] animate-pulse">{t('auth.verifyingSession')}</span>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="min-h-screen bg-[var(--bg-app)] flex flex-col items-center justify-center space-y-3"
      >
        <div
          className="w-8 h-8 border-2 border-[var(--accent-primary)] border-t-transparent rounded-full animate-spin"
          aria-hidden="true"
        />
        <span className="text-xs font-mono text-[var(--text-muted)]">{t('auth.sessionExpiredRedirect')}</span>
      </div>
    );
  }

  return <>{children}</>;
}
