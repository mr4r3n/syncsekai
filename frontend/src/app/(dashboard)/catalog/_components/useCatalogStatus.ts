import {
  Eye,
  CheckCircle2,
  Clock,
  PauseCircle,
  XCircle,
  Circle,
} from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export function useCatalogStatus() {
  const { t } = useI18n();

  /**
   * Icono de cada estado. En la lista el estado va como icono y no como
   * texto: "Completed" gastaba 75 de los 375 px de una fila estrecha, y el
   * dato cabe en un simbolo. El nombre sigue en el title y en la etiqueta
   * accesible, asi que no se pierde para quien no interpreta el icono.
   */
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'CURRENT':
        return Eye;
      case 'COMPLETED':
        return CheckCircle2;
      case 'PLANNING':
        return Clock;
      case 'PAUSED':
        return PauseCircle;
      case 'DROPPED':
        return XCircle;
      default:
        return Circle;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CURRENT':
        return {
          label: t('catalog.statusWatching'),
          className: 'bg-sky-500/15 text-sky-500 dark:text-sky-400 border-sky-500/30',
          badgeClass: 'bg-sky-950/85 text-sky-300 border-sky-500/40 shadow-[0_4px_14px_rgba(56,189,248,0.25)]',
          dotClass: 'bg-[#02a9ff] shadow-[0_0_8px_#02a9ff]',
          text: '#38bdf8',
          border: 'rgba(56, 189, 248, 0.35)',
        };
      case 'COMPLETED':
        return {
          label: t('catalog.statusCompleted'),
          className: 'bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border-emerald-500/30',
          badgeClass: 'bg-emerald-950/85 text-emerald-300 border-emerald-500/40 shadow-[0_4px_14px_rgba(16,185,129,0.25)]',
          dotClass: 'bg-emerald-400 shadow-[0_0_8px_#34d399]',
          text: '#34d399',
          border: 'rgba(16, 185, 129, 0.35)',
        };
      case 'PLANNING':
        return {
          label: t('catalog.statusPlanning'),
          className: 'bg-purple-500/15 text-purple-500 dark:text-purple-400 border-purple-500/30',
          badgeClass: 'bg-purple-950/85 text-purple-300 border-purple-500/40 shadow-[0_4px_14px_rgba(168,85,247,0.25)]',
          dotClass: 'bg-purple-400 shadow-[0_0_8px_#c084fc]',
          text: '#c084fc',
          border: 'rgba(168, 85, 247, 0.35)',
        };
      case 'PAUSED':
        return {
          label: t('catalog.statusPaused'),
          className: 'bg-amber-500/15 text-amber-500 dark:text-amber-400 border-amber-500/30',
          badgeClass: 'bg-amber-950/85 text-amber-300 border-amber-500/40 shadow-[0_4px_14px_rgba(245,158,11,0.25)]',
          dotClass: 'bg-amber-400 shadow-[0_0_8px_#fbbf24]',
          text: '#fbbf24',
          border: 'rgba(245, 158, 11, 0.35)',
        };
      case 'DROPPED':
        return {
          label: t('catalog.statusDropped'),
          className: 'bg-rose-500/15 text-rose-500 dark:text-rose-400 border-rose-500/30',
          badgeClass: 'bg-rose-950/85 text-rose-300 border-rose-500/40 shadow-[0_4px_14px_rgba(239,68,68,0.25)]',
          dotClass: 'bg-rose-400 shadow-[0_0_8px_#f87171]',
          text: '#f87171',
          border: 'rgba(239, 68, 68, 0.35)',
        };
      case 'NOT_IN_LIST':
        return {
          label: t('catalog.statusNotInList'),
          className: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
          badgeClass: 'bg-zinc-950/85 text-zinc-300 border-zinc-600/50 shadow-md',
          dotClass: 'bg-zinc-400',
          text: '#a1a1aa',
          border: 'rgba(161, 161, 170, 0.3)',
        };
      default:
        return {
          label: status || 'Desconocido',
          className: 'bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]',
          badgeClass: 'bg-zinc-900/85 text-zinc-300 border-zinc-700/50 shadow-md',
          dotClass: 'bg-zinc-400',
          text: '#a1a1aa',
          border: 'rgba(255, 255, 255, 0.15)',
        };
    }
  };

  const getSeasonNumber = (anime: any) => {
    if (Number(anime?.seasonNumber) > 0) return Number(anime.seasonNumber);
    const title = [anime?.title, anime?.romajiTitle, anime?.englishTitle].filter(Boolean).join(' ');
    const match = title.match(/(?:season|temporada)\s*(\d{1,2})\b/i)
      || title.match(/\b(\d{1,2})(?:st|nd|rd|th)\s+season\b/i)
      || title.match(/\bpart\s*(\d{1,2})\b/i);
    return match ? Number(match[1]) : 1;
  };

  return {
    getStatusIcon,
    getStatusBadge,
    getSeasonNumber,
  };
}
