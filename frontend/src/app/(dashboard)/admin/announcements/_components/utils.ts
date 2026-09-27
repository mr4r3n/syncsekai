import type { Traductor } from './types';

function toDatetimeLocal(isoStr?: string | null) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '';
    const tzOffset = d.getTimezoneOffset() * 60000;
    const local = new Date(d.getTime() - tzOffset);
    return local.toISOString().slice(0, 16);
  } catch {
    return '';
  }
}

function fromDatetimeLocal(localStr: string) {
  if (!localStr) return null;
  try {
    const d = new Date(localStr);
    if (isNaN(d.getTime())) return null;
    return d.toISOString();
  } catch {
    return null;
  }
}

// Recibe t y el idioma porque es un ayudante, no un componente: no puede usar el hook.
function formatReadableDate(t: Traductor, locale: string, isoStr?: string | null) {
  if (!isoStr) return t('announcements.sampleBadge');
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString(locale, {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return isoStr;
  }
}

export { toDatetimeLocal, fromDatetimeLocal, formatReadableDate };
