/**
 * Qué se pinta para cada notificación: icono, textos y a dónde lleva.
 *
 * El backend guarda un título y un mensaje, pero los compone en un idioma y
 * con un contexto que la interfaz no controla. Para los tipos conocidos el
 * texto se genera aquí a partir de `metadata`, en el idioma activo; lo
 * guardado queda como respaldo para tipos sin plantilla (avisos del sistema).
 *
 * La acción también sale de aquí: antes la campana ofrecía "Map anime now" a
 * cualquier notificación que llevara a algún sitio, incluida la de un usuario
 * nuevo.
 */
export type Traductor = (clave: string, vars?: Record<string, string | number>) => string;

export interface NotificacionDescrita {
  icono: 'alerta' | 'usuario' | 'ticket' | 'info';
  titulo: string;
  mensaje: string;
  accion?: { etiqueta: string; href: string };
}

export function describirNotificacion(n: any, t: Traductor, esAdmin: boolean): NotificacionDescrita {
  const m = n?.metadata || {};

  if (n.type === 'UNMAPPED_ANIME' || n.type === 'UNMAPPED_ITEM') {
    const temporada = Number(m.seasonNumber) > 1 ? ` (${t('notif.season', { n: m.seasonNumber })})` : '';
    const servidor = m.source === 'JELLYFIN' ? 'Jellyfin' : m.source === 'EMBY' ? 'Emby' : 'Plex';
    return {
      icono: 'alerta',
      titulo: m.showTitle ? t('notif.unmappedTitle', { title: `${m.showTitle}${temporada}` }) : n.title,
      mensaje: m.episodeNumber ? t('notif.unmappedMessage', { episode: m.episodeNumber, server: servidor }) : n.message,
      accion: m.showTitle
        ? {
            etiqueta: t('topbar.mapAnimeNow'),
            href: `/mappings?search=${encodeURIComponent(m.showTitle)}&season=${m.seasonNumber || 1}`,
          }
        : undefined,
    };
  }

  if (n.type === 'NEW_USER') {
    return {
      icono: 'usuario',
      titulo: t('notif.newUserTitle', { username: m.username || '' }),
      mensaje: t('notif.newUserMessage', { email: m.email || '', via: m.via || '' }),
      accion: { etiqueta: t('notif.viewUser'), href: `/users?search=${encodeURIComponent(m.username || '')}` },
    };
  }

  if (m.ticketId) {
    const numero = m.ticketNumber ?? '';
    const titulo =
      m.kind === 'ticket-new'
        ? t('notif.ticketNewTitle', { n: numero })
        : m.kind === 'ticket-reply'
          ? t('notif.ticketReplyTitle', { n: numero })
          : m.kind === 'ticket-support-reply'
            ? t('notif.ticketSupportReplyTitle', { n: numero })
            : n.title;
    const mensaje =
      m.kind === 'ticket-new'
        ? t('notif.ticketNewMessage', { username: m.username || '', subject: m.subject || '' })
        : m.kind === 'ticket-reply'
          ? `${m.username || ''}: "${m.snippet || ''}"`
          : m.kind === 'ticket-support-reply'
            ? t('notif.ticketSupportReplyMessage', { snippet: m.snippet || '' })
            : n.message;
    return {
      icono: 'ticket',
      titulo,
      mensaje,
      accion: { etiqueta: t('notif.viewTicket'), href: esAdmin ? '/admin/tickets' : '/tickets' },
    };
  }

  return { icono: 'info', titulo: n.title, mensaje: n.message };
}
