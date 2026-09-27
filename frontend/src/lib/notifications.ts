/**
 * What is rendered for each notification: icon, text, and destination.
 *
 * The backend stores a title and message, but composes them in a language and
 * context the interface does not control. For known types the text is generated
 * here from `metadata` in the active language; stored values remain as fallback
 * for template-less types (system alerts).
 *
 * The action also originates here: previously the bell offered "Map anime now" for
 * any notification that led anywhere, including new user notifications.
 */
export type Translator = (key: string, vars?: Record<string, string | number>) => string;

export interface DescribedNotification {
  icon: 'alert' | 'user' | 'ticket' | 'info';
  title: string;
  message: string;
  action?: { label: string; href: string };
  /** Community suggestion: the mapping the "accept" button fixes. */
  acceptMappingId?: string;
}

export function describeNotification(n: any, t: Translator, esAdmin: boolean): DescribedNotification {
  const m = n?.metadata || {};

  if (n.type === 'UNMAPPED_ANIME' || n.type === 'UNMAPPED_ITEM') {
    const seasonSuffix = Number(m.seasonNumber) > 1 ? ` (${t('notif.season', { n: m.seasonNumber })})` : '';
    const server = m.source === 'JELLYFIN' ? 'Jellyfin' : m.source === 'EMBY' ? 'Emby' : 'Plex';
    return {
      icon: 'alert',
      title: m.showTitle ? t('notif.unmappedTitle', { title: `${m.showTitle}${seasonSuffix}` }) : n.title,
      message: m.episodeNumber ? t('notif.unmappedMessage', { episode: m.episodeNumber, server }) : n.message,
      action: m.showTitle
        ? {
            label: t('topbar.mapAnimeNow'),
            href: `/mappings?search=${encodeURIComponent(m.showTitle)}&season=${m.seasonNumber || 1}`,
          }
        : undefined,
    };
  }

  if (n.type === 'COMMUNITY_SUGGESTION') {
    const season = Number(m.plexSeason) > 1 ? ` (${t('notif.season', { n: m.plexSeason })})` : '';
    return {
      icon: 'info',
      title: t('notif.communityTitle', { title: `${m.plexTitle || ''}${season}` }),
      message: t('notif.communityMessage', { votes: m.votes ?? 2, suggested: m.anilistTitle || '', current: m.currentTitle || '' }),
      action: {
        label: t('notif.communityReview'),
        href: `/mappings?filter=${encodeURIComponent(m.plexTitle || '')}`,
      },
      acceptMappingId: m.mappingId,
    };
  }

  if (n.type === 'NEW_USER') {
    return {
      icon: 'user',
      title: t('notif.newUserTitle', { username: m.username || '' }),
      message: t('notif.newUserMessage', { email: m.email || '', via: m.via || '' }),
      action: { label: t('notif.viewUser'), href: `/users?search=${encodeURIComponent(m.username || '')}` },
    };
  }

  if (m.ticketId) {
    const number = m.ticketNumber ?? '';
    const title =
      m.kind === 'ticket-new'
        ? t('notif.ticketNewTitle', { n: number })
        : m.kind === 'ticket-reply'
          ? t('notif.ticketReplyTitle', { n: number })
          : m.kind === 'ticket-support-reply'
            ? t('notif.ticketSupportReplyTitle', { n: number })
            : n.title;
    const message =
      m.kind === 'ticket-new'
        ? t('notif.ticketNewMessage', { username: m.username || '', subject: m.subject || '' })
        : m.kind === 'ticket-reply'
          ? `${m.username || ''}: "${m.snippet || ''}"`
          : m.kind === 'ticket-support-reply'
            ? t('notif.ticketSupportReplyMessage', { snippet: m.snippet || '' })
            : n.message;
    return {
      icon: 'ticket',
      title,
      message,
      action: { label: t('notif.viewTicket'), href: esAdmin ? '/admin/tickets' : '/tickets' },
    };
  }

  return { icon: 'info', title: n.title, message: n.message };
}
