'use client';

import {
  History,
  Film,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

interface HistoryStatsProps {
  total: number;
  resumen: any;
  t: (key: string, values?: any) => string;
}

export function HistoryStats({
  total,
  resumen,
  t,
}: HistoryStatsProps) {
  return (
    <>
      {/* 4 TARJETAS KPI SUPERIORES */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* KPI 1: SCROBBLES */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              Scrobbles
            </span>
            <div className="w-7 h-7 rounded-[6px] bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/20 flex items-center justify-center">
              <History className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text-primary)] my-1">
            {total}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            {typeof resumen?.variacionMensual === 'number' ? (
              <>
                <span
                  className={`font-semibold flex items-center gap-0.5 ${
                    resumen.variacionMensual >= 0 ? 'text-emerald-400' : 'text-[var(--status-danger)]'
                  }`}
                >
                  <TrendingUp
                    className={`w-3 h-3 ${resumen.variacionMensual < 0 ? 'rotate-180' : ''}`}
                    aria-hidden="true"
                  />
                  {resumen.variacionMensual >= 0 ? '+' : ''}
                  {resumen.variacionMensual}%
                </span>
                <span className="text-[var(--text-muted)]">{t('history.vsLastMonth')}</span>
              </>
            ) : (
              <span className="text-[var(--text-muted)]">
                {resumen ? t('history.firstMonth') : t('history.noData')}
              </span>
            )}
          </div>
        </div>

        {/* KPI 2: EPISODIOS */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
              {t('history.episodes')}
            </span>
            <div className="w-7 h-7 rounded-[6px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
              <Film className="w-3.5 h-3.5" />
            </div>
          </div>
          {/* Episodios distintos, contados. La duracion real no se guarda,
              asi que no hay "tiempo visto". */}
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-[var(--text-primary)] my-1">
            {typeof resumen?.episodios === 'number' ? resumen.episodios : t('history.noData')}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-[var(--text-muted)]">{t('history.episodesDistinct')}</span>
          </div>
        </div>

        {/* KPI 3: PRECISIÓN */}
        <div className="glass-card p-4 sm:p-5 flex flex-col justify-between min-h-[110px] relative">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-muted)]">{t('history.accuracy')}</span>
            <div className="w-7 h-7 rounded-[6px] bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <div className="text-2xl sm:text-3xl font-extrabold font-mono tracking-tight text-emerald-400 my-1">
            {typeof resumen?.tasaExito === 'number' ? `${resumen.tasaExito}%` : t('history.noData')}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <span className="text-emerald-400 font-semibold">{resumen?.correctos ?? 0}</span>
            <span className="text-[var(--text-muted)]">{t('history.syncedOk')}</span>
          </div>
        </div>

        {/* La cuarta tarjeta era "Latencia media: 164 ms", un numero fijo.
            No hay nada que mida el tiempo de cada envio -no se guarda-, asi
            que la tarjeta desaparece en vez de seguir inventandolo. Las
            otras tres se reparten el ancho. */}
      </div>
    </>
  );
}
