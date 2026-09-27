'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { Star } from 'lucide-react';

interface CatalogGridViewProps {
  catalog: any[];
  setSelectedAnime: (anime: any) => void;
  getStatusBadge: (status: string) => any;
  getSeasonNumber: (anime: any) => number;
  handleToggleFavorite: (anime: any, e?: React.MouseEvent) => void;
  favoritesList: string[];
}

export function CatalogGridView({
  catalog,
  setSelectedAnime,
  getStatusBadge,
  getSeasonNumber,
  handleToggleFavorite,
  favoritesList,
}: CatalogGridViewProps) {
  const { t } = useI18n();

  const getGridClass = () =>
    'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-3.5';

  return (
    <div className={getGridClass()}>
      {catalog.map((anime) => {
        const badge = getStatusBadge(anime.status);
        return (
          <div
            key={anime.id || anime.anilistId}
            onClick={() => setSelectedAnime(anime)}
            className="group relative rounded-[8px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:border-sky-500/50 hover:shadow-xl transition-all duration-200 cursor-pointer flex flex-col justify-between overflow-hidden"
          >
            {/* Imagen de Portada */}
            <div className="relative aspect-[2/3] w-full overflow-hidden bg-zinc-950">
              <img
                src={anime.coverUrl}
                alt={anime.title}
                width={230}
                height={345}
                loading="lazy"
                onError={(e) => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = 'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                }}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />

              {/* Header Flotante Superior (Estado + Calificación) */}
              <div className="absolute top-1.5 inset-x-1.5 flex items-center justify-between gap-1 pointer-events-none">
                <div
                  // max-w-[50%] recortaba "Completado" a "Complet…" en tarjetas
                  // estrechas (160px en móvil): el 50% daba 80px y la etiqueta
                  // necesita ~75px más relleno. "Viendo", más corto, sí cabía, y
                  // de ahí que unas tarjetas se vieran bien y otras no.
                  className="px-1.5 py-0.5 rounded-[4px] text-[9.5px] font-bold bg-black/80 backdrop-blur-md border shadow-sm truncate max-w-[62%] shrink-0"
                  style={{
                    color: badge.text,
                    borderColor: badge.border,
                  }}
                >
                  {badge.label}
                </div>

                <div className="flex items-center gap-1 pointer-events-auto">
                  {/*
                    Ambas variantes comparten forma, tamaño y escala /10.
                    Antes, al no haber nota propia se pintaba averageScore crudo
                    ("90%"): escala sobre 100, sin icono y en otro color, en el
                    mismo hueco donde el resto muestra una nota sobre 10. Rompía
                    la lectura de la rejilla y no se entendía qué medía.
                    El color y el icono siguen distinguiendo tu nota del promedio
                    de la comunidad, pero ya no cambia la unidad.
                  */}
                  {anime.rating > 0 ? (
                    <div
                      title={`Tu puntuación: ${Number(anime.rating).toFixed(1)} de 10`}
                      className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-black/80 backdrop-blur-md text-amber-300 flex items-center gap-0.5 border border-amber-500/25 shadow-sm shrink-0"
                    >
                      <Star className="hidden min-[420px]:block w-2.5 h-2.5 fill-amber-300 shrink-0" aria-hidden="true" />
                      {Number(anime.rating).toFixed(1)}
                    </div>
                  ) : anime.averageScore ? (
                    <div
                      title={`Promedio de la comunidad: ${(Number(anime.averageScore) / 10).toFixed(1)} de 10`}
                      className="px-1.5 py-0.5 rounded-[4px] text-[11px] font-bold bg-black/80 backdrop-blur-md text-sky-300 flex items-center gap-0.5 border border-sky-500/25 shadow-sm shrink-0"
                    >
                      <Star className="hidden min-[420px]:block w-2.5 h-2.5 shrink-0" aria-hidden="true" />
                      {(Number(anime.averageScore) / 10).toFixed(1)}
                    </div>
                  ) : null}

                  <button
                    type="button"
                    onClick={(e) => handleToggleFavorite(anime, e)}
                    className="w-5 h-5 rounded-[4px] bg-black/80 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:text-amber-400 transition-colors shadow-sm cursor-pointer"
                    title={favoritesList.includes(String(anime.anilistId || anime.malId || anime.kitsuId || anime.id)) ? t('catalog.removeFromFavourites') : t('catalog.addToFavourites')}
                  >
                    <Star
                      className={`w-3 h-3 transition-all ${
                        favoritesList.includes(String(anime.anilistId || anime.malId || anime.kitsuId || anime.id))
                          ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_4px_rgba(251,191,36,0.8)]'
                          : 'text-zinc-400 hover:text-amber-300'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Barra Flotante de Progreso de Episodios */}
              <div className="absolute bottom-1.5 inset-x-1.5 flex items-center justify-between text-[9.5px] font-mono font-medium text-white bg-black/85 backdrop-blur-md px-1.5 py-0.5 rounded-[4px] border border-white/10 shadow-sm">
                <span className="truncate">
                  Ep. {anime.episodesWatched}/{anime.episodesTotal || '?'}
                </span>
                <span
                  className={
                    anime.progressPercentage === 100 ? 'text-emerald-400 font-bold' : 'text-sky-400 font-bold'
                  }
                >
                  {anime.progressPercentage}%
                </span>
              </div>
            </div>

            {/* Información Inferior de la Tarjeta */}
            <div className="p-2 space-y-1">
              <h3
                className="font-bold text-xs truncate text-[var(--text-primary)] leading-tight group-hover:text-sky-400 transition-colors"
                title={anime.title}
              >
                {anime.title}
              </h3>
              <div
                className="flex items-center justify-between text-[10px] text-[var(--text-secondary)]"
              >
                <span className="truncate max-w-[60%]">{anime.studio || 'Studio'}</span>
                <div className="flex items-center gap-1 font-mono shrink-0">
                  {/* Dos datos distintos: que temporada es y cuando
                      se emitio. Se pinta cada uno solo si lo hay, en
                      vez de rellenar con 'TV' lo que no se sabe. */}
                  {getSeasonNumber(anime) > 1 && (
                    <span className="text-sky-400 font-bold">T{getSeasonNumber(anime)}</span>
                  )}
                  {anime.season && <span className="truncate">{anime.season}</span>}
                  {!anime.season && getSeasonNumber(anime) <= 1 && (
                    <span className="truncate">{anime.format || 'TV'}</span>
                  )}
                </div>
              </div>

              {/* Barra de Progreso Sutil */}
              <div className="w-full h-1 rounded-full bg-zinc-800/80 overflow-hidden mt-1">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${anime.progressPercentage}%`,
                    backgroundColor:
                      anime.progressPercentage === 100
                        ? 'var(--status-success)'
                        : 'var(--brand-anilist)',
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
