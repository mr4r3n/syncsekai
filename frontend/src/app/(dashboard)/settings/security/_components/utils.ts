import type { Translator } from './types';

// Helper, not component: receives t instead of using hook. Reuses
// relative time keys already existing in topbar section.
function formatRelativeTime(t: Translator, dateString: string | Date | undefined) {
  if (!dateString) return t('security.activeRecently');
  const diffSec = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);

  if (diffSec < 60) return t('security.activeNow');
  if (diffSec < 3600) return t('topbar.minutesAgo', { mins: Math.floor(diffSec / 60) });
  if (diffSec < 86400) return t('topbar.hoursAgo', { hours: Math.floor(diffSec / 3600) });
  return t('topbar.daysAgo', { days: Math.floor(diffSec / 86400) });
}

export { formatRelativeTime };
