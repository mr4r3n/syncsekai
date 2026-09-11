'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { I18nProvider, useI18n } from '@/i18n/I18nProvider';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('SyncSekai Global Root Error:', error);
  }, [error]);

  // Este boundary sustituye al layout raiz, asi que se queda fuera del I18nProvider
  // que vive en layout.tsx: sin este proveedor propio, t() devolveria la clave en crudo.
  return (
    <html lang="en" data-theme="dark">
      <body className="min-h-screen bg-[#0d0f12] text-[#f0f2f5] flex flex-col items-center justify-center p-4 font-sans antialiased">
        <I18nProvider>
          <GlobalErrorContent reset={reset} />
        </I18nProvider>
      </body>
    </html>
  );
}

function GlobalErrorContent({ reset }: { reset: () => void }) {
  const { t } = useI18n();

  return (
    <div className="w-full max-w-md p-8 rounded-[12px] bg-[#161a20]/90 border border-white/10 shadow-2xl text-center space-y-6 backdrop-blur-xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-[6px] text-xs font-mono font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <span className="w-2 h-2 rounded-full bg-rose-400 animate-pulse" />
            <span>{t('errors.globalTitle')}</span>
          </div>

          <div className="space-y-2">
            <h1 className="text-xl font-bold font-heading">{t('errors.globalSubtitle')}</h1>
            <p className="text-xs text-gray-400 leading-relaxed">{t('errors.rootBoundary')}</p>
          </div>

          <div className="pt-2 flex justify-center">
            <button
              onClick={() => reset()}
              className="px-5 py-2.5 rounded-[6px] text-xs font-bold text-white bg-[#FF634A] hover:bg-[#e0533c] transition-all flex items-center gap-2 shadow-lg shadow-rose-500/20 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{t('errors.restart')}</span>
            </button>
          </div>
    </div>
  );
}
