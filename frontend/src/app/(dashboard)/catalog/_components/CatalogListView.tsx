'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { ListRow, ListRows, ListRowsHeader } from '@/components/ListRow';

/*
 * Column distribution in list view.
 *
 * "TV" and "S2" measure twenty pixels and "Local Library" ninety: with all
 * columns equal, short ones had seventy pixels of empty space inside.
 */
const CATALOG_COLUMNS_TEMPLATE = '1.2fr 0.7fr 0.8fr 0.8fr 0.7fr 1.4fr';

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

  /* Same row as history and other lists. Content inside changes,
     not structure: keeping catalog from becoming another
     ad-hoc variant of the same concept. */
  return (
    <>
      {/* With values already aligned, only missing piece
          to read like a table was labeling each column. */}
      <ListRowsHeader
        template={CATALOG_COLUMNS_TEMPLATE}
        title={t('catalog.colTitle')}
        columns={[
          t('catalog.colEpisodes'),
          t('catalog.colSeason'),
          t('catalog.colProgress'),
          t('catalog.colScore'),
          t('catalog.colFormat'),
          t('catalog.colSource'),
        ]}
        status={t('catalog.colStatus')}
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
              // Row measures 2230 px and title uses 400:
              // data fits on the same line, to the
              // right, instead of hanging below leaving
              // resto en blanco.
              metaOnRight
              metaTemplate={CATALOG_COLUMNS_TEMPLATE}
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
              // List has plenty of space on desktop
              // and was displaying less than grid view:
              // two items and a 1500 px void. These are
              // the same rendered on the card, and ListRow
              // already trims third onwards when screen
              // is narrow.
              //
              // Third was `anime.score`, a nonexistent
              // field—rating lives in `rating` or, if not
              // set by user, in `averageScore`—so it
              // always appeared empty.
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
                const Icon = getStatusIcon(anime.status);
                const color =
                  badge?.className ||
                  'border-[var(--border-subtle)] text-[var(--text-muted)]';
                return (
                  <>
                    {/* On mobile icon only, where space is tight;
                        on desktop icon with text, which provides
                        necessary context. */}
                    <span
                      title={badge?.label}
                      aria-label={badge?.label}
                      role="img"
                      className={`lg:hidden shrink-0 w-7 h-7 rounded-full border flex items-center justify-center ${color}`}
                    >
                      <Icon className="w-4 h-4" aria-hidden="true" />
                    </span>
                    <span
                      className={`hidden lg:inline-flex shrink-0 items-center justify-center gap-1.5 h-7 w-[104px] rounded-[var(--radius-md)] border text-[11px] font-semibold ${color}`}
                    >
                      <Icon className="w-3.5 h-3.5" aria-hidden="true" />
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
