'use client';

import { useState, useMemo, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Flame } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface HeatmapDay {
  date: string;
  dayOfWeek: number; // 0 = Sun, 1 = Mon … 6 = Sat
  month: number;
  scrobbles: number;
  mappings: number;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface ActivityHeatmapProps {
  days?: HeatmapDay[];
  /** Day of the week (0 = Sunday) × hour, in UTC. */
  hourly?: number[][];
  totalYearActivity?: number;
  currentStreak?: number;
  maxStreak?: number;
  loading?: boolean;
}

/** Mode: columns by month, or columns by week with details for each day. */
type Mode = 'horas' | 'meses' | 'dias';

/** Day keys, from Monday to Sunday. */
const DAYS = ['dayMon', 'dayTue', 'dayWed', 'dayThu', 'dayFri', 'daySat', 'daySun'] as const;

/**
 * Activity heatmap: seven rows, one per day of the week.
 *
 * ## Why rows rule
 *
 * Each row is a day of the week and **its label goes inside the row
 * itself**. They cannot get misaligned: they are the same box. And all seven fit.
 *
 * ## Two modes
 *
 * - **Months**: twelve columns, one per month. Answers "which days of the week is
 *   it used and during which times of the year".
 * - **Days**: the last year, one column per week and one cell per day, with
 *   the month on the axis. It is for looking at a specific day.
 *
 * Cells without activity are painted in gray, like the rest. Leaving them
 * transparent made the map look broken, when "there was nothing that day"
 * is precisely data.
 */
export function ActivityHeatmap({
  days = [],
  hourly,
  currentStreak = 0,
  loading = false,
}: ActivityHeatmapProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<Mode>('horas');
  const [active, setActive] = useState<{ label: string; value: number } | null>(null);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  /**
   * Seven-row grid.
   *
   * In both modes the row is the day of the week; what changes is what
   * each column represents. Returning them with the same shape, the rendering is
   * just one.
   */
  const { rows, columns, peak, total } = useMemo(() => {
    const empty = {
      rows: [] as { value: number; label: string }[][],
      columns: [] as string[],
      peak: 0,
      total: 0,
    };
    if (!days.length) return empty;

    // getDay() gives 0 for Sunday; rotate so the week starts on Monday.
    const toRow = (d: HeatmapDay) => (d.dayOfWeek + 6) % 7;

    // Hourly mode: the matrix arrives in UTC and is shifted to local time.
    // The offset is rounded to whole hours; half-hour zones end up
    // shifted by half an hour, which doesn't matter for this map.
    if (mode === 'horas') {
      const offset = Math.round(-new Date().getTimezoneOffset() / 60);
      const grid = Array.from({ length: 7 }, (_, f) =>
        Array.from({ length: 24 }, (_, h) => ({
          value: 0,
          label: `${t(`admin.${DAYS[f]}`)} · ${String(h).padStart(2, '0')}:00`,
        })),
      );
      for (let utcDay = 0; utcDay < 7; utcDay++) {
        for (let utcHour = 0; utcHour < 24; utcHour++) {
          const n = hourly?.[utcDay]?.[utcHour] || 0;
          if (!n) continue;
          const totalHours = utcDay * 24 + utcHour + offset;
          const local = ((totalHours % 168) + 168) % 168;
          const localDay = Math.floor(local / 24);
          grid[(localDay + 6) % 7][local % 24].value += n;
        }
      }
      const values = grid.flat().map((c) => c.value);
      return {
        rows: grid,
        columns: Array.from({ length: 24 }, (_, h) =>
          h % 6 === 0 || h === 23 ? `${String(h).padStart(2, '0')}:00` : '',
        ),
        peak: Math.max(0, ...values),
        total: values.reduce((a, b) => a + b, 0),
      };
    }

    if (mode === 'meses') {
      const months = Array.from({ length: 12 }, (_, m) =>
        new Date(2024, m, 1).toLocaleDateString([], { month: 'short' }).toUpperCase(),
      );
      const rejilla = Array.from({ length: 7 }, (_, f) =>
        Array.from({ length: 12 }, (_, c) => ({
          value: 0,
          label: `${t(`admin.${DAYS[f]}`)} · ${months[c]}`,
        })),
      );
      for (const d of days) rejilla[toRow(d)][d.month].value += d.count || 0;

      const valores = rejilla.flat().map((c) => c.value);
      return {
        rows: rejilla,
        columns: months,
        peak: Math.max(0, ...valores),
        total: valores.reduce((a, b) => a + b, 0),
      };
    }

    // Day mode: one column per week. The first is padded at the front
    // with gaps so it doesn't start mid-week.
    const rejilla = Array.from({ length: 7 }, () => [] as { value: number; label: string }[]);

    const relleno = toRow(days[0]);
    for (let f = 0; f < relleno; f++) rejilla[f].push({ value: -1, label: '' });

    // Month to which the first cell of each column belongs, for the axis.
    const columnMonth: number[] = [];
    days.forEach((d, i) => {
      const col = Math.floor((relleno + i) / 7);
      if (columnMonth[col] === undefined) columnMonth[col] = d.month;
      rejilla[toRow(d)].push({
        value: d.count || 0,
        label: `${d.date} · ${t('admin.activityEvents', { n: d.count || 0 })}`,
      });
    });

    // Lengths are equalized so that all rows have the same columns.
    const width = Math.max(...rejilla.map((f) => f.length));
    for (const f of rejilla) while (f.length < width) f.push({ value: -1, label: '' });

    // The month is labeled in the column where it begins; the first only if the month
    // starts there, to avoid putting two labels adjacent.
    const monthName = (m: number) => new Date(2024, m, 1).toLocaleDateString([], { month: 'short' }).toUpperCase();
    const columns = columnMonth.map((m, i) => (i > 0 && m !== columnMonth[i - 1] ? monthName(m) : ''));

    const valores = rejilla
      .flat()
      .filter((c) => c.value >= 0)
      .map((c) => c.value);
    return {
      rows: rejilla,
      columns,
      peak: Math.max(0, ...valores),
      total: valores.reduce((a, b) => a + b, 0),
    };
  }, [days, hourly, mode, t]);

  /**
   * Five steps proportional to the peak, not fixed thresholds: with fixed thresholds
   * a quiet server comes out completely dim and one with high traffic comes out all
   * at maximum, and in both cases the map ceases to convey anything.
   */
  const color = (value: number) => {
    if (value < 0) return 'bg-transparent border-transparent pointer-events-none';
    if (value === 0) return 'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]';
    if (peak <= 0) return 'bg-violet-500/40 border-violet-500/50';
    const ratio = value / peak;
    if (ratio > 0.9)
      return 'bg-[var(--accent-primary)] border-[var(--accent-primary)] shadow-[0_0_8px_var(--btn-primary-glow)]';
    if (ratio > 0.6) return 'bg-violet-400 border-violet-400';
    if (ratio > 0.3) return 'bg-violet-500/70 border-violet-500/80';
    return 'bg-violet-500/40 border-violet-500/50';
  };

  // Side of each cell: the more columns, the smaller; always square.
  const ancho = 'minmax(0, 1.75rem)';

  const LEGEND = [
    'bg-[var(--bg-surface-elevated)] border-[var(--border-subtle)]',
    'bg-violet-500/40 border-violet-500/50',
    'bg-violet-500/70 border-violet-500/80',
    'bg-violet-400 border-violet-400',
    'bg-[var(--accent-primary)] border-[var(--accent-primary)]',
  ];

  const selectorClass = (active: boolean) =>
    `px-2 py-0.5 rounded-[var(--radius-xs)] text-[11px] font-mono font-bold border transition-colors cursor-pointer ${
      active
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
                ({mode === 'horas' ? '24×7' : mode === 'meses' ? '12×7' : '365d'})
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
              onClick={() => setMode('horas')}
              aria-pressed={mode === 'horas'}
              className={selectorClass(mode === 'horas')}
            >
              {t('admin.byHour')}
            </button>
            <button
              type="button"
              onClick={() => setMode('meses')}
              aria-pressed={mode === 'meses'}
              className={selectorClass(mode === 'meses')}
            >
              {t('admin.byMonth')}
            </button>
            <button
              type="button"
              onClick={() => setMode('dias')}
              aria-pressed={mode === 'dias'}
              className={selectorClass(mode === 'dias')}
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
            <span className="font-bold text-[var(--accent-text)]">{peak}</span>
          </span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)] animate-pulse">
          {t('admin.loadingActivityMatrix')}
        </div>
      ) : (
        <div className="space-y-1 pt-1">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="flex items-center gap-2">
              {/* The label goes INSIDE the row: that's why it cannot
                  get misaligned, and that's why all seven fit. */}
              <span className="w-3.5 shrink-0 text-center font-mono text-[10px] font-bold text-[var(--text-muted)] select-none">
                {t(`admin.${DAYS[rowIndex]}`).charAt(0)}
              </span>
              {/* Fixed-size square cells distributed across the width: with
                  flex-1 they stretched into rectangles as wide as the card. */}
              <div
                className="grid flex-1 min-w-0 justify-between gap-x-1"
                style={{ gridTemplateColumns: `repeat(${row.length}, ${ancho})` }}
              >
                {row.map((cell, iCol) => (
                  <div
                    key={iCol}
                    onMouseEnter={(e) => {
                      if (cell.value < 0) return;
                      const r = e.currentTarget.getBoundingClientRect();
                      setActive({ label: cell.label, value: cell.value });
                      setPosition({ x: r.left + r.width / 2, y: r.top - 6 });
                    }}
                    onMouseLeave={() => {
                      setActive(null);
                      setPosition(null);
                    }}
                    className={`aspect-square w-full rounded-[4px] border cursor-pointer transition-[filter] duration-100 hover:brightness-125 ${color(
                      cell.value,
                    )}`}
                  />
                ))}
              </div>
            </div>
          ))}

          {/* Bottom axis, by hours and by months: in day mode the
              columns are individual weeks and labeling them conveys nothing. */}
          {columns.length > 0 && (
            <div className="flex items-center gap-2 pt-1 text-[9px] font-mono text-[var(--text-muted)] select-none">
              <span className="w-3.5 shrink-0" aria-hidden="true" />
              <div
                className="grid flex-1 min-w-0 justify-between"
                style={{ gridTemplateColumns: `repeat(${columns.length}, ${ancho})` }}
              >
                {columns.map((m, i) =>
                  mode === 'horas' && i >= 21 ? null : (
                    <span key={i} className={`whitespace-nowrap ${mode === 'meses' ? 'text-center' : 'text-left'}`}>
                      {m}
                    </span>
                  ),
                )}
                {mode === 'horas' && (
                  <span className="whitespace-nowrap text-right" style={{ gridColumn: '22 / span 3' }}>
                    {columns[23]}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)] font-mono">
        <span className="truncate">
          {mode === 'horas' ? t('admin.activityByHourFooter') : mode === 'meses' ? t('admin.activityByMonthFooter') : t('admin.dailyServerActivity')}
        </span>
        <span className="flex items-center gap-1 shrink-0">
          <span>{t('admin.less')}</span>
          {LEGEND.map((c, i) => (
            <span key={i} className={`w-2.5 h-2.5 rounded-[2px] border ${c}`} />
          ))}
          <span>{t('admin.more')}</span>
        </span>
      </div>

      {mounted && active && position && typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{ left: position.x, top: position.y, transform: 'translate(-50%, -100%)' }}
            className="fixed z-[100] px-2 py-1 rounded-[var(--radius-sm)] bg-[var(--popover-solid-bg)] border border-[var(--border-strong)] text-[11px] font-mono text-[var(--text-primary)] shadow-lg pointer-events-none whitespace-nowrap"
          >
            {active.label}
            {mode !== 'dias' && <span className="font-bold"> · {active.value}</span>}
          </div>,
          document.body,
        )}
    </div>
  );
}
