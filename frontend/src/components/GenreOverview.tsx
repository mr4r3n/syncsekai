'use client';

import { useState } from 'react';
import { Layers } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface GenreItem {
  name: string;
  count: number;
  percentage: number;
  color: string;
}

export interface GenreOverviewProps {
  genres?: GenreItem[];
  totalEntries?: number;
  loading?: boolean;
}

export function GenreOverview({
  genres = [],
  totalEntries = 0,
  loading = false,
}: GenreOverviewProps) {
  const { t } = useI18n();
  const [activeGenre, setActiveGenre] = useState<GenreItem | null>(null);

  const topGenres = genres.slice(0, 5);

  return (
    <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-3 py-4 sm:p-5 h-full flex flex-col justify-between gap-4">
      {/* HEADER */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.genreDistribution')}</h2>
            <p className="text-[11px] text-[var(--text-secondary)]">{t('admin.mostSyncedGenres')}</p>
          </div>
        </div>

        <div className="text-[11px] font-mono text-[var(--text-muted)] bg-[var(--bg-surface)] px-2.5 py-1 rounded-[5px] border border-[var(--border-subtle)] shrink-0">
          Total: <span className="font-bold text-[var(--text-primary)]">{totalEntries}</span>
        </div>
      </div>

      {loading ? (
        <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)] animate-pulse">{t('admin.analysingGenres')}</div>
      ) : genres.length === 0 ? (
        <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)]">{t('admin.notEnoughSynced')}</div>
      ) : (
        <div className="space-y-4 w-full flex-1 flex flex-col justify-center">
          {/* TOP 5 GENEROS

              En movil van en lista y no en cinco columnas. Cinco columnas en
              375 px son 60 px por hueco, y ahi "Adventure" o "Psychological"
              se quedaban en "A…": el nombre del genero es justo el dato que
              hay que leer. En lista cada uno tiene la fila entera.

              En escritorio se mantienen las tarjetas, que dejan comparar los
              cinco de un vistazo. */}
          <div className="flex flex-col gap-1.5 sm:hidden">
            {topGenres.map((genre) => (
              <div
                key={genre.name}
                onMouseEnter={() => setActiveGenre(genre)}
                onMouseLeave={() => setActiveGenre(null)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)]"
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: genre.color }}
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                />
                <span className="min-w-0 flex-1 truncate text-xs font-bold text-[var(--text-primary)]">
                  {genre.name}
                </span>
                <span className="shrink-0 text-[11px] font-mono text-[var(--text-muted)]">
                  {t('admin.genreEntries', { n: genre.count })}
                </span>
                <span
                  style={{ color: genre.color }}
                  className="shrink-0 text-[11px] font-mono font-bold w-9 text-right"
                >
                  {genre.percentage}%
                </span>
              </div>
            ))}
          </div>

          <div className="hidden sm:grid grid-cols-5 gap-2.5 w-full">
            {topGenres.map((genre) => (
              <div
                key={genre.name}
                onMouseEnter={() => setActiveGenre(genre)}
                onMouseLeave={() => setActiveGenre(null)}
                className={`py-2.5 px-2 rounded-[8px] bg-[var(--bg-surface)] border transition-all duration-150 cursor-pointer flex flex-col items-center justify-center text-center gap-1.5 ${
                  activeGenre?.name === genre.name
                    ? 'border-white/40 shadow-lg brightness-110'
                    : 'border-[var(--border-subtle)] hover:border-white/20'
                }`}
                style={{
                  boxShadow: activeGenre?.name === genre.name ? `0 0 14px ${genre.color}35` : undefined,
                }}
              >
                {/* GENRE PILL BADGE */}
                <span
                  style={{ backgroundColor: genre.color }}
                  className="px-2.5 py-1 rounded-[5px] text-[11px] sm:text-xs font-bold text-white shadow-xs font-heading tracking-wide truncate max-w-full"
                >
                  {genre.name}
                </span>

                {/* COUNT & PERCENTAGE */}
                <div className="space-y-0.5">
                  <div
                    style={{ color: genre.color }}
                    className="text-xs font-mono font-bold leading-tight"
                  >
                    {t('admin.genreEntries', { n: genre.count })}
                  </div>
                  <div className="text-[10px] text-[var(--text-muted)] font-mono leading-none">
                    {t('admin.genreOfTotal', { pct: genre.percentage })}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* MULTI-COLOR PROPORTIONAL PROGRESS BAR (BARRA GRUESA ESTILO ANILIST) */}
          <div className="space-y-1.5 pt-1">
            <div className="w-full h-3.5 sm:h-4 rounded-full bg-white/[0.04] p-0.5 overflow-hidden flex shadow-inner border border-white/[0.06]">
              {genres.map((genre) => (
                <div
                  key={genre.name}
                  style={{
                    width: `${genre.percentage}%`,
                    backgroundColor: genre.color,
                  }}
                  onMouseEnter={() => setActiveGenre(genre)}
                  onMouseLeave={() => setActiveGenre(null)}
                  className={`h-full transition-all duration-200 cursor-pointer relative first:rounded-l-full last:rounded-r-full ${
                    activeGenre && activeGenre.name !== genre.name ? 'opacity-35' : 'opacity-100 hover:brightness-125'
                  }`}
                  title={`${genre.name}: ${genre.count} entradas (${genre.percentage}%)`}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* LEYENDA INFERIOR SINCRONIZADA */}
      <div className="h-7 flex items-center justify-between text-[10.5px] font-mono text-[var(--text-muted)] pt-2 border-t border-[var(--border-subtle)]">
        <span className="truncate">{t('admin.proportionalGenres')}</span>
        {activeGenre ? (
          <span className="font-bold truncate" style={{ color: activeGenre.color }}>
            {activeGenre.name}: {activeGenre.count} ({activeGenre.percentage}%)
          </span>
        ) : (
          <span className="text-[10px]">{t('admin.hoverOverGenre')}</span>
        )}
      </div>
    </div>
  );
}
