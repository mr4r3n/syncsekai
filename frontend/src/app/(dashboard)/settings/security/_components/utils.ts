import type { Traductor } from './types';

// Ayudante, no componente: recibe t en vez de usar el hook. Reutiliza las
// claves de tiempo relativo que ya existen en la seccion topbar.
function formatRelativeTime(t: Traductor, dateString: string | Date | undefined) {
  if (!dateString) return t('security.activeRecently');
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (diffSec < 60) return t('security.activeNow');
  if (diffSec < 3600) return t('topbar.minutesAgo', { mins: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return t('topbar.hoursAgo', { hours: Math.floor(diffSec / 3600) });
  return t('topbar.daysAgo', { days: Math.floor(diffSec / 86400) });
}

export { formatRelativeTime };
