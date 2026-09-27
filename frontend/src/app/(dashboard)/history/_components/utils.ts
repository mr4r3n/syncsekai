function getMonthStartDayOffset(year: number, month: number) {
  const day = new Date(year, month, 1).getDay();
  return (day + 6) % 7; // Monday = 0, ..., Sunday = 6
}

/** "September 2026" o "septiembre de 2026" según el idioma activo. */
function etiquetaMes(year: number, month: number, locale: string) {
  return new Date(year, month, 1).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { month: 'long', year: 'numeric' });
}

function formatDateReadable(isoDate: string) {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
}

function getHeatmapTierClass(tier: number, isLight: boolean) {
  if (tier === 0) {
    return isLight
      ? 'bg-zinc-100 border-zinc-200 text-zinc-700 font-semibold'
      : 'bg-[var(--bg-surface-elevated)]/40 border-[var(--border-subtle)] text-[var(--text-muted)]';
  }
  if (tier === 1) {
    return isLight
      ? 'bg-amber-100 border-amber-300 text-zinc-950 font-bold shadow-xs'
      : 'bg-amber-500/20 border-amber-500/35 text-amber-300 font-semibold';
  }
  if (tier === 2) {
    return isLight
      ? 'bg-amber-200 border-amber-400 text-zinc-950 font-bold shadow-xs'
      : 'bg-amber-500/45 border-amber-500/60 text-amber-100 font-bold';
  }
  if (tier === 3) {
    return isLight
      ? 'bg-orange-500 border-orange-600 text-white font-bold shadow-xs'
      : 'bg-orange-500/80 border-orange-500/90 text-white font-bold shadow-xs';
  }
  return isLight
    ? 'bg-orange-600 border-orange-700 text-white font-black shadow-sm'
    : 'bg-orange-500 border-orange-300 text-white font-bold shadow-sm';
}

/**
 * Texto de estado de cada tracker, ya traducido.
 *
 * Vive aqui y no dentro de SyncStatus porque ese componente no debe conocer el
 * sistema de traduccion: recibe cadenas, no claves.
 */
function etiquetasSync(item: any, t: (k: string, v?: any) => string) {
  const texto = (estado: string, tracker: string) =>
    estado === 'SUCCESS'
      ? t('history.syncedOn', { tracker })
      : estado === 'FAILED'
      ? t('history.syncFailedOn', { tracker })
      : t('history.notConfiguredOn', { tracker });

  return {
    anilist: texto(item.anilistStatus, 'AniList'),
    mal: texto(item.malStatus, 'MyAnimeList'),
    kitsu: texto(item.kitsuStatus, 'Kitsu'),
  };
}

export {
  getMonthStartDayOffset,
  etiquetaMes,
  formatDateReadable,
  getHeatmapTierClass,
  etiquetasSync,
};
