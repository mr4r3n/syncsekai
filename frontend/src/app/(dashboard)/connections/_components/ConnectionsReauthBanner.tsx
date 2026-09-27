'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { AlertCircle } from 'lucide-react';

interface ConnectionsReauthBannerProps {
  hubData: any;
}

export function ConnectionsReauthBanner({ hubData }: ConnectionsReauthBannerProps) {
  const { t } = useI18n();

  return (
    <div className="p-4 sm:p-5 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-in fade-in">
      <div className="flex items-start gap-3.5 min-w-0">
        <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
          <AlertCircle className="w-5 h-5 animate-pulse" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
            <span>{t('connections.reauthRequiredHeading')}</span>
            <span className="bg-rose-500 text-white text-[10.5px] font-extrabold px-2 py-0.5 rounded-full animate-pulse shadow-sm tracking-tight">
              {hubData.reconnectionRequiredCount} servicio(s)
            </span>
          </h3>
          <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
            Detectamos que tus conexiones ({hubData.servicesNeedingReauth?.join(', ')}) fueron creadas en una versión previa. Para sincronizar tu avatar oficial, tu ID de usuario y disfrutar de todas las nuevas funciones, haz clic en <strong>&quot;Reconectar&quot;</strong>{' '}{t('connections.onCardsBelow')}</p>
        </div>
      </div>
    </div>
  );
}
