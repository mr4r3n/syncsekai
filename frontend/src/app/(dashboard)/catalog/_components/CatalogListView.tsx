'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { ListRow, ListRows, ListRowsHeader } from '@/components/ListRow';

/*
 * Reparto de las columnas de la vista de lista.
 *
 * "TV" y "T2" miden veinte pixeles y "Local Library" noventa: con todas las
 * columnas iguales, las cortas se quedaban con setenta pixeles de aire dentro.
 */
const PLANTILLA_COLUMNAS_CATALOGO = '1.2fr 0.7fr 0.8fr 0.8fr 0.7fr 1.4fr';

interface CatalogListViewProps {
  catalog: any[];
  setSelectedAnime: (anime: any) => void;
  getStatusBadge: (status: string) => any;
  getStatusIcon: (status: string) => any;
  getSeasonNumber: (anime: any) => number;
}

export function CatalogListView({
  catalog,
  setSelectedAnime,
  getStatusBadge,
  getStatusIcon,
  getSeasonNumber,
}: CatalogListViewProps) {
  const { t } = useI18n();

  /* Misma fila que el historial y el resto de listas. Cambia lo
     que se pinta dentro, no la estructura: asi el catalogo no
     vuelve a ser una variante propia del mismo concepto. */
  return (
    <>
      {/* Con los valores ya alineados, lo unico que le
          faltaba a esto para leerse como una tabla era
          decir que es cada columna. */}
      <ListRowsHeader
        plantilla={PLANTILLA_COLUMNAS_CATALOGO}
        titulo={t('catalog.colTitle')}
        columnas={[
          t('catalog.colEpisodes'),
          t('catalog.colSeason'),
          t('catalog.colProgress'),
          t('catalog.colScore'),
          t('catalog.colFormat'),
          t('catalog.colSource'),
        ]}
        estado={t('catalog.colStatus')}
      />
      <ListRows label={t('catalog.title')}>
        {catalog.map((anime) => {
          const badge = getStatusBadge(anime.status);
          const vistos = Number(anime.episodesWatched || 0);
          const totales = Number(anime.episodesTotal || 0);
          return (
            <ListRow
              key={anime.id || anime.anilistId}
              onOpen={() => setSelectedAnime(anime)}
              openLabel={t('catalog.openDetails')}
              // La fila mide 2230 px y el titulo gasta 400:
              // los datos caben en la misma linea, a la
              // derecha, en vez de colgar debajo dejando el
              // resto en blanco.
              metaALaDerecha
              metaPlantilla={PLANTILLA_COLUMNAS_CATALOGO}
              media={
                <img
                  src={anime.coverUrl}
                  alt=""
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    e.currentTarget.src =
                      'https://s4.anilist.co/file/anilistcdn/media/anime/cover/medium/default.jpg';
                  }}
                  className="w-9 h-12 rounded-[var(--radius-sm)] object-cover border border-[var(--border-subtle)] bg-[var(--bg-app)]"
                />
              }
              title={anime.title}
              // La lista tiene sitio de sobra en escritorio
              // y estaba ensenando menos que la cuadricula:
              // dos datos y un hueco de 1500 px. Estos son
              // los mismos que pinta la card, y ListRow ya
              // recorta del tercero en adelante cuando la
              // pantalla es estrecha.
              //
              // El tercero era `anime.score`, un campo que
              // no existe -la nota vive en `rating` y, si no
              // la has puesto tu, en `averageScore`- asi que
              // salia siempre vacio.
              meta={[
                totales > 0 ? `Ep. ${vistos}/${totales}` : `Ep. ${vistos}`,
                getSeasonNumber(anime) > 1 ? `T${getSeasonNumber(anime)}` : anime.season || null,
                anime.progressPercentage > 0 ? `${anime.progressPercentage}%` : null,
                anime.rating > 0
                  ? `★ ${Number(anime.rating).toFixed(1)}`
                  : anime.averageScore
                  ? `★ ${(Number(anime.averageScore) / 10).toFixed(1)}`
                  : null,
                anime.format || null,
                anime.studio || null,
              ]}
              status={(() => {
                const Icono = getStatusIcon(anime.status);
                const color =
                  badge?.className ||
                  'border-[var(--border-subtle)] text-[var(--text-muted)]';
                return (
                  <>
                    {/* En movil solo el icono, que es donde
                        no hay espacio; en escritorio el
                        icono con su texto, que es lo que
                        hace falta leer. */}
                    <span
                      title={badge?.label}
                      aria-label={badge?.label}
                      role="img"
                      className={`lg:hidden shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${color}`}
                    >
                      <Icono className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span
                      className={`hidden lg:inline-flex shrink-0 items-center justify-center gap-1.5 h-7 w-[104px] rounded-[var(--radius-md)] border text-[11px] font-semibold ${color}`}
                    >
                      <Icono className="w-3.5 h-3.5" aria-hidden="true" />
                      {badge?.label}
                    </span>
                  </>
                );
              })()}
            />
          );
        })}
      </ListRows>
    </>
  );
}
