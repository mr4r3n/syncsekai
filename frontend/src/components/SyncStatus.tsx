'use client';

import React from 'react';
import { Check, X } from 'lucide-react';

/**
 * Estado de sincronización de un scrobble en los tres trackers.
 *
 * ## Por qué existe
 *
 * Un único componente para el estado de los trackers en todas las pantallas.
 * Un fallo y un tracker sin configurar deben distinguirse de un vistazo, así
 * que son tres estados, no dos:
 *
 * | Estado           | Se ve                                    |
 * |------------------|------------------------------------------|
 * | Sincronizado     | icono en color de marca, con una marca ✓ |
 * | Falló            | icono en rojo de sistema, con una ✕      |
 * | Sin configurar   | icono apagado, sin marca                 |
 *
 * El color de marca identifica **de qué tracker se trata**; la marca dice **qué
 * pasó**. Así el estado no depende sólo del color, que es lo que exige que
 * también lo entienda quien no distingue el rojo del verde.
 */

export type EstadoSync = 'SUCCESS' | 'FAILED' | string | null | undefined;

const TRACKERS = {
  anilist: { nombre: 'AniList', color: 'var(--brand-anilist)' },
  mal: { nombre: 'MyAnimeList', color: 'var(--brand-mal)' },
  kitsu: { nombre: 'Kitsu', color: 'var(--brand-kitsu)' },
} as const;

export type Tracker = keyof typeof TRACKERS;

/**
 * Qué trackers tiene vinculados el usuario. Es un dato de la cuenta, no del
 * scrobble: un tracker sin vincular no es que fallara, es que nunca se
 * intentó. Sin esta distinción, «no lo tienes puesto» y «lo tienes puesto y
 * fue mal» se veían igual.
 */
export interface TrackersVinculados {
  anilist: boolean;
  mal: boolean;
  kitsu: boolean;
}

const TODOS_VINCULADOS: TrackersVinculados = { anilist: true, mal: true, kitsu: true };

function Glifo({ tracker }: { tracker: Tracker }) {
  if (tracker === 'anilist') {
    return (
      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="currentColor" aria-hidden="true">
        <path d="M24 17.53v2.421c0 .71-.391 1.101-1.1 1.101h-5l-.057-.165L11.84 3.736c.106-.502.46-.788 1.053-.788h2.422c.71 0 1.1.391 1.1 1.1v12.38H22.9c.71 0 1.1.392 1.1 1.101zM11.034 2.947l6.337 18.104h-4.918l-1.052-3.131H6.019l-1.077 3.131H0L6.361 2.948h4.673zm-.66 10.96-1.69-5.014-1.541 5.015h3.23z" />
      </svg>
    );
  }
  if (tracker === 'mal') {
    return (
      <span className="text-[9px] font-bold tracking-tighter leading-none" aria-hidden="true">
        MAL
      </span>
    );
  }
  return (
    <span className="text-[9px] font-bold tracking-tighter leading-none" aria-hidden="true">
      KIT
    </span>
  );
}

function Marca({ estado }: { estado: EstadoSync }) {
  if (estado === 'SUCCESS') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--status-success)] text-white flex items-center justify-center ring-2 ring-[var(--bg-surface)]">
        <Check className="w-2 h-2" strokeWidth={4} aria-hidden="true" />
      </span>
    );
  }
  if (estado === 'FAILED') {
    return (
      <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-[var(--status-danger)] text-white flex items-center justify-center ring-2 ring-[var(--bg-surface)]">
        <X className="w-2 h-2" strokeWidth={4} aria-hidden="true" />
      </span>
    );
  }
  return null;
}

function Icono({
  tracker,
  estado,
  etiqueta,
  vinculado = true,
}: {
  tracker: Tracker;
  estado: EstadoSync;
  etiqueta: string;
  vinculado?: boolean;
}) {
  // Sin vincular manda sobre cualquier estado del scrobble: si no lo tienes
  // puesto, no hay nada que informar mas alla de eso.
  const ok = vinculado && estado === 'SUCCESS';
  const fallo = vinculado && estado === 'FAILED';

  return (
    <span
      title={etiqueta}
      // El texto accesible lleva el estado; el color y la marca son refuerzo.
      role="img"
      aria-label={etiqueta}
      className={`relative w-7 h-7 rounded-[var(--radius-sm)] border flex items-center justify-center shrink-0 ${
        ok
          ? 'border-current/30 bg-current/10'
          : fallo
          ? 'border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)] opacity-40'
      }`}
      style={ok ? { color: TRACKERS[tracker].color } : undefined}
    >
      <Glifo tracker={tracker} />
      {vinculado && <Marca estado={estado} />}
    </span>
  );
}

/**
 * `etiquetas` recibe el texto ya traducido de cada estado, porque este
 * componente no debe conocer el sistema de traducción.
 */
export function SyncStatus({
  anilist,
  mal,
  kitsu,
  etiquetas,
  vinculados = TODOS_VINCULADOS,
  className = '',
}: {
  anilist: EstadoSync;
  mal: EstadoSync;
  kitsu: EstadoSync;
  etiquetas: { anilist: string; mal: string; kitsu: string };
  vinculados?: TrackersVinculados;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className}`}>
      <Icono tracker="anilist" estado={anilist} etiqueta={etiquetas.anilist} vinculado={vinculados.anilist} />
      <Icono tracker="mal" estado={mal} etiqueta={etiquetas.mal} vinculado={vinculados.mal} />
      <Icono tracker="kitsu" estado={kitsu} etiqueta={etiquetas.kitsu} vinculado={vinculados.kitsu} />
    </div>
  );
}

/**
 * Versión de una sola pieza para pantallas estrechas: dice cuántos trackers
 * fueron bien sin gastar tres controles, y el detalle queda a un toque.
 *
 * `resumen` es el texto ya traducido, del tipo «2 de 3 sincronizados».
 */
export function SyncSummary({
  anilist,
  mal,
  kitsu,
  resumen,
  vinculados = TODOS_VINCULADOS,
  className = '',
}: {
  anilist: EstadoSync;
  mal: EstadoSync;
  kitsu: EstadoSync;
  resumen: string;
  vinculados?: TrackersVinculados;
  className?: string;
}) {
  // El denominador son los trackers que el usuario tiene puestos, no tres
  // siempre: con solo AniList vinculado, lo correcto es 1/1 y no 1/3, que
  // parece que dos han fallado.
  const estados = ([
    ['anilist', anilist],
    ['mal', mal],
    ['kitsu', kitsu],
  ] as [Tracker, EstadoSync][])
    .filter(([id]) => vinculados[id])
    .map(([, estado]) => estado);

  const total = estados.length;
  const ok = estados.filter((e) => e === 'SUCCESS').length;
  const hayFallo = estados.some((e) => e === 'FAILED');

  // Sin ningun tracker vinculado no hay nada que contar.
  if (total === 0) {
    return (
      <span
        title={resumen}
        aria-label={resumen}
        className={`inline-flex items-center px-2 py-1 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-mono text-[var(--text-muted)] ${className}`}
      >
        —
      </span>
    );
  }

  return (
    <span
      title={resumen}
      aria-label={resumen}
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-[var(--radius-sm)] border text-[11px] font-mono font-semibold ${
        hayFallo
          ? 'border-[var(--status-danger)]/35 bg-[var(--status-danger-bg)] text-[var(--status-danger)]'
          : ok === total
          ? 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]'
          : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[var(--text-muted)]'
      } ${className}`}
    >
      {hayFallo ? (
        <X className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
      ) : (
        <Check className="w-3 h-3" strokeWidth={3} aria-hidden="true" />
      )}
      {ok}/{total}
    </span>
  );
}
