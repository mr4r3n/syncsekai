'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Flame } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface HeatmapDay {
  date: string;
  dayOfWeek: number; // 0 = Dom, 1 = Lun … 6 = Sáb
  month: number;
  scrobbles: number;
  mappings: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityHeatmapProps {
  days?: HeatmapDay[];
  /** Día de la semana (0 = domingo) × hora, en UTC. */
  hourly?: number[][];
  totalYearActivity?: number;
  currentStreak?: number;
  maxStreak?: number;
  loading?: boolean;
}

/** Modo: columnas por mes, o columnas por semana con el detalle de cada día. */
type Modo = 'horas' | 'meses' | 'dias';

/** Claves de los días, de lunes a domingo. */
const DIAS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const;

/**
 * Mapa de actividad: siete filas, una por día de la semana.
 *
 * ## Por qué las filas mandan
 *
 * Cada fila es un día de la semana y **su etiqueta va dentro de la propia
 * fila**. No pueden descuadrarse: son la misma caja. Y caben las siete.
 *
 * ## Dos modos
 *
 * - **Meses**: doce columnas, una por mes. Responde a «qué días de la semana se
 *   usa y en qué épocas del año».
 * - **Días**: el último año, una columna por semana y una celda por día, con
 *   el mes en el eje. Es para mirar un día concreto.
 *
 * Las celdas sin actividad se pintan en gris, como el resto. Dejarlas
 * transparentes hacía que el mapa pareciera roto, cuando «ese día no hubo
 * nada» es justamente un dato.
 */
export function ActivityHeatmap({
  days = [],
  hourly,
  currentStreak = 0,
  loading = false,
}: ActivityHeatmapProps) {
  const { t } = useI18n();
  const [modo, setModo] = useState<Modo>('horas');
  const [activa, setActiva] = useState<{ etiqueta: string; valor: number } | null>(null);
  const [posicion, setPosicion] = useState<{ x: number; y: number } | null>(null);
  const [montado, setMontado] = useState(false);

  useEffect(() => setMontado(true), []);

  /**
   * Rejilla de siete filas.
   *
   * En los dos modos la fila es el día de la semana; lo que cambia es qué
   * representa cada columna. Devolviéndolas con la misma forma, el dibujado es
   * uno solo.
   */
  const { filas, columnas, pico, total } = useMemo(() => {
    const vacia = {
      filas: [] as { valor: number; etiqueta: string }[][],
      columnas: [] as string[],
      pico: 0,
      total: 0,
    };
    if (!days.length) return vacia;

    // getDay() da 0 al domingo; se rota para que la semana empiece en lunes.
    const aFila = (d: HeatmapDay) => (d.dayOfWeek + 6) % 7;

    // Modo por horas: la matriz llega en UTC y se desplaza a la hora local.
    // El desfase se redondea a horas enteras; las zonas de media hora quedan
    // media hora corridas, que para este mapa da igual.
    if (modo === 'horas') {
      const desfase = Math.round(-new Date().getTimezoneOffset() / 60);
      const rejilla = Array.from({ length: 7 }, (_, f) =>
        Array.from({ length: 24 }, (_, h) => ({
          valor: 0,
          etiqueta: `${t(`admin.${DIAS[f]}`)} · ${String(h).padStart(2, '0')}:00`,
        })),
      );
      for (let diaUtc = 0; diaUtc < 7; diaUtc++) {
        for (let horaUtc = 0; horaUtc < 24; horaUtc++) {
          const n = hourly?.[diaUtc]?.[horaUtc] || 0;
          if (!n) continue;
          const totalHoras = diaUtc * 24 + horaUtc + desfase;
          const local = ((totalHoras % 168) + 168) % 168;
          const diaLocal = Math.floor(local / 24);
          rejilla[(diaLocal + 6) % 7][local % 24].valor += n;
        }
      }
      const valores = rejilla.flat().map((c) => c.valor);
      return {
        filas: rejilla,
        columnas: Array.from({ length: 24 }, (_, h) =>
          h % 6 === 0 || h === 23 ? `${String(h).padStart(2, '0')}:00` : '',
        ),
        pico: Math.max(0, ...valores),
        total: valores.reduce((a, b) => a + b, 0),
      };
    }

    if (modo === 'meses') {
      const meses = Array.from({ length: 12 }, (_, m) =>
        new Date(2024, m, 1).toLocaleDateString([], { month: 'short' }).toUpperCase(),
      );
      const rejilla = Array.from({ length: 7 }, (_, f) =>
        Array.from({ length: 12 }, (_, c) => ({
          valor: 0,
          etiqueta: `${t(`admin.${DIAS[f]}`)} · ${meses[c]}`,
        })),
      );
      for (const d of days) rejilla[aFila(d)][d.month].valor += d.count || 0;

      const valores = rejilla.flat().map((c) => c.valor);
      return {
        filas: rejilla,
        columnas: meses,
        pico: Math.max(0, ...valores),
        total: valores.reduce((a, b) => a + b, 0),
      };
    }

    // Modo por días: una columna por semana. La primera se rellena por delante
    // con huecos para que no empiece a media semana.
    const rejilla = Array.from({ length: 7 }, () => [] as { valor: number; etiqueta: string }[]);

    const relleno = aFila(days[0]);
    for (let f = 0; f < relleno; f++) rejilla[f].push({ valor: -1, etiqueta: '' });

    // Mes al que pertenece la primera celda de cada columna, para el eje.
    const mesDeColumna: number[] = [];
    days.forEach((d, i) => {
      const col = Math.floor((relleno + i) / 7);
      if (mesDeColumna[col] === undefined) mesDeColumna[col] = d.month;
      rejilla[aFila(d)].push({
        valor: d.count || 0,
        etiqueta: `${d.date} · ${t('admin.activityEvents', { n: d.count || 0 })}`,
      });
    });

    // Se igualan los largos para que todas las filas tengan las mismas columnas.
    const ancho = Math.max(...rejilla.map((f) => f.length));
    for (const f of rejilla) while (f.length < ancho) f.push({ valor: -1, etiqueta: '' });

    // El mes se rotula en la columna donde empieza; la primera solo si el mes
    // arranca ahí, para no pegar dos rótulos.
    const nombreMes = (m: number) => new Date(2024, m, 1).toLocaleDateString([], { month: 'short' }).toUpperCase();
    const columnas = mesDeColumna.map((m, i) => (i > 0 && m !== mesDeColumna[i - 1] ? nombreMes(m) : ''));

    const valores = rejilla
      .flat()
      .filter((c) => c.valor >= 0)
      .map((c) => c.valor);
    return {
      filas: rejilla,
      columnas,
      pico: Math.max(0, ...valores),
      total: valores.reduce((a, b) => a + b, 0),
    };
  }, [days, hourly, modo, t]);

  /**
   * Cinco pasos proporcionales al pico, no umbrales fijos: con umbrales fijos
   * un servidor tranquilo sale todo apagado y uno con mucho tráfico sale todo
   * al máximo, y en los dos casos el mapa deja de decir nada.
   */
  const color = (valor: number) => {
    if (valor < 0) return 'bg-transparent border-transparent pointer-events-none';
    if (valor === 0) return 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]';
    if (pico <= 0) return 'bg-violet-500/40 border-violet-500/50';
    const proporcion = valor / pico;
    if (proporcion > 0.9)
      return 'bg-[var(--accent-primary)] border-[var(--accent-primary)] shadow-[0_0_8px_var(--btn-primary-glow)]';
    if (proporcion > 0.6) return 'bg-violet-400 border-violet-400';
    if (proporcion > 0.3) return 'bg-violet-500/70 border-violet-500/80';
    return 'bg-violet-500/40 border-violet-500/50';
  };

  // Lado de cada celda: cuantas más columnas, más pequeña; siempre cuadrada.
  const ancho = 'minmax(0, 1.75rem)';

  const LEYENDA = [
    'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]',
    'bg-violet-500/40 border-violet-500/50',
    'bg-violet-500/70 border-violet-500/80',
    'bg-violet-400 border-violet-400',
    'bg-[var(--accent-primary)] border-[var(--accent-primary)]',
  ];

  const claseSelector = (activo: boolean) =>
    `px-2 py-0.5 rounded-[var(--radius-xs)] text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
      activo
        ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-text)] border-[var(--accent-primary)]/30'
        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] border-transparent'
    }`;

  return (
    <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-3 py-4 sm:p-5 h-full flex flex-col justify-between gap-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="w-8 h-8 rounded-[var(--radius-md)] bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading truncate">
              {t('admin.activityHistory')}{' '}
              <span className="text-[var(--text-muted)] font-mono font-normal">
                ({modo === 'horas' ? '24×7' : modo === 'meses' ? '12×7' : '365d'})
              </span>
            </h2>
            <p className="text-[11px] text-[var(--text-muted)] truncate">
              {t('admin.activityEvents', { n: total.toLocaleString() })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 text-[11px] shrink-0 flex-wrap">
          <div
            role="group"
            aria-label={t('admin.activityRange')}
            className="flex items-center bg-[var(--bg-surface)] p-0.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)]"
          >
            <button
              type="button"
              onClick={() => setModo('horas')}
              aria-pressed={modo === 'horas'}
              className={claseSelector(modo === 'horas')}
            >
              {t('admin.byHour')}
            </button>
            <button
              type="button"
              onClick={() => setModo('meses')}
              aria-pressed={modo === 'meses'}
              className={claseSelector(modo === 'meses')}
            >
              {t('admin.byMonth')}
            </button>
            <button
              type="button"
              onClick={() => setModo('dias')}
              aria-pressed={modo === 'dias'}
              className={claseSelector(modo === 'dias')}
            >
              {t('admin.byDay')}
            </button>
          </div>

          <span className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono">
            <span className="text-[var(--text-muted)]">{t('admin.streak')}: </span>
            <span className="font-bold text-[var(--status-warning)]">{currentStreak}d</span>
          </span>
          <span className="px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] font-mono">
            <span className="text-[var(--text-muted)]">{t('admin.peak')}: </span>
            <span className="font-bold text-[var(--accent-text)]">{pico}</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)] animate-pulse">
          {t('admin.loadingActivityMatrix')}
        </div>
      ) : (
        <div className="space-y-1 pt-1">
          {filas.map((fila, iFila) => (
            <div key={iFila} className="flex items-center gap-2">
              {/* La etiqueta va DENTRO de la fila: por eso no puede
                  descuadrarse, y por eso caben las siete. */}
              <span className="w-3.5 shrink-0 text-center font-mono text-[10px] font-bold text-[var(--text-muted)] select-none">
                {t(`admin.${DIAS[iFila]}`).charAt(0)}
              </span>
              {/* Celdas cuadradas de tamaño fijo repartidas a lo ancho: con
                  flex-1 se estiraban en rectángulos tan anchos como la tarjeta. */}
              <div
                className="grid flex-1 min-w-0 justify-between gap-x-1"
                style={{ gridTemplateColumns: `repeat(${fila.length}, ${ancho})` }}
              >
                {fila.map((celda, iCol) => (
                  <div
                    key={iCol}
                    onMouseEnter={(e) => {
                      if (celda.valor < 0) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      setActiva({ etiqueta: celda.etiqueta, valor: celda.valor });
                      setPosicion({ x: r.left + r.width / 2, y: r.top - 6 });
                    }}
                    onMouseLeave={() => {
                      setActiva(null);
                      setPosicion(null);
                    }}
                    className={`aspect-square w-full rounded-[4px] border cursor-pointer transition-[filter] duration-100 hover:brightness-125 ${color(
                      celda.valor,
                    )}`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Eje inferior, por horas y por meses: en el modo por días las
              columnas son semanas sueltas y rotularlas no dice nada. */}
          {columnas.length > 0 && (
            <div className="flex items-center gap-2 pt-1 text-[9px] font-mono text-[var(--text-muted)] select-none">
              <span className="w-3.5 shrink-0" aria-hidden="true" />
              <div
                className="grid flex-1 min-w-0 justify-between"
                style={{ gridTemplateColumns: `repeat(${columnas.length}, ${ancho})` }}
              >
                {columnas.map((m, i) =>
                  modo === 'horas' && i >= 21 ? null : (
                    <span key={i} className={`whitespace-nowrap ${modo === 'meses' ? 'text-center' : 'text-left'}`}>
                      {m}
                    </span>
                  ),
                )}
                {modo === 'horas' && (
                  <span className="whitespace-nowrap text-right" style={{ gridColumn: '22 / span 3' }}>
                    {columnas[23]}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)] font-mono">
        <span className="truncate">
          {modo === 'horas' ? t('admin.activityByHourFooter') : modo === 'meses' ? t('admin.activityByMonthFooter') : t('admin.dailyServerActivity')}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <span>{t('admin.less')}</span>
          {LEYENDA.map((c, i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-[2px] border ${c}`} />
          ))}
          <span>{t('admin.more')}</span>
        </span>
      </div>

      {montado && activa && posicion && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ left: posicion.x, top: posicion.y, transform: 'translate(-50%, -100%)' }}
            className="fixed z-[100] px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--popover-solid-bg)] border border-[var(--border-strong)] text-[11px] font-mono text-[var(--text-primary)] shadow-lg pointer-events-none whitespace-nowrap"
          >
            {activa.etiqueta}
            {modo !== 'dias' && <span className="font-bold"> · {activa.valor}</span>}
          </div>,
          document.body,
        )}
    </div>
  );
}
