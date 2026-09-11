'use client';

import React from 'react';
import { MoreVertical } from 'lucide-react';

/**
 * Fila de lista. El mismo esqueleto para historial, mapeos, medios, copias y
 * cualquier otra lista de este estilo.
 *
 * Existe porque cada una se dibujó a mano y acabaron siendo variantes distintas
 * del mismo concepto: sangrados propios, alturas propias, la misma información
 * ordenada de otra forma en cada pantalla. Arreglarlas una a una sólo garantiza
 * que en unos meses vuelva a haber seis variantes.
 *
 * ## La jerarquía es la idea, no la decoración
 *
 * Una fila responde a tres preguntas, en este orden: **qué es**, **cuáles son
 * sus datos** y **en qué estado está**. Por eso hay exactamente dos líneas de
 * texto: el título, y una sola línea gris con el resto separado por puntos.
 *
 * ## Móvil no es esto mismo encogido
 *
 * En pantalla estrecha la fila se reordena: la portada se reduce, los datos
 * secundarios se recortan a los que caben y el bloque de estado baja a una
 * segunda fila propia en lugar de comprimirse hasta ser ilegible.
 *
 * ## Nada de interactivos anidados
 *
 * La fila entera NO es un botón. Si lo fuera, el checkbox y el menú quedarían
 * dentro de otro control y ni el teclado ni un lector de pantalla sabrían qué
 * se activa. Lo pulsable es el título; los demás controles son hermanos suyos.
 */

/*
 * La geometria de las columnas vive aqui y no en cada sitio: la cabecera y las
 * filas tienen que medir exactamente lo mismo o la tabla deja de serlo.
 */
const REJILLA_META = 'gap-x-3 items-center';
const LADO_META = 'lg:w-[52%]';
/* Lo que ocupan la portada y su hueco, para que el rotulo del titulo empiece
 * donde empieza el titulo. */
const SANGRIA_TITULO = 'pl-[48px]';

export interface ListRowProps {
  /** Visual de la izquierda: portada, logo o icono. */
  media?: React.ReactNode;
  /** Texto principal. */
  title: React.ReactNode;
  /** Distintivo pegado al título (episodio, temporada, tipo). */
  badge?: React.ReactNode;
  /**
   * Datos secundarios. Se pintan en una sola línea separados por puntos, y los
   * que no caben se recortan. El orden importa: lo primero es lo que sobrevive
   * en móvil.
   */
  meta?: React.ReactNode[];
  /**
   * Reparto de las columnas de la derecha, en formato `grid-template-columns`.
   *
   * Con todas iguales, un "TV" de 20 px se quedaba en una celda de 150 y el
   * hueco entre columnas cortas era enorme. Cada lista sabe cual de sus datos
   * es largo y cual corto, asi que el reparto lo decide quien la escribe; lo
   * que NO puede es depender del contenido de cada fila, porque entonces cada
   * fila mediria distinto y dejaria de ser una tabla.
   *
   * Por defecto, todas iguales.
   */
  metaPlantilla?: string;
  /**
   * Pinta los datos a la derecha, junto al estado, en vez de bajo el título.
   *
   * Sirve para filas de una sola linea con el titulo corto y sitio de sobra: en
   * el catalogo a 2560 px el titulo ocupaba 400 px y los datos colgaban debajo
   * mientras a la derecha quedaban 1500 px en blanco. En movil no cabe, asi que
   * ahi vuelven debajo pase lo que pase.
   */
  metaALaDerecha?: boolean;
  /** Bloque de estado de la derecha (iconos de sincronización, píldoras). */
  status?: React.ReactNode;
  /** Acciones. Si no se pasa `onOpen`, van visibles; si se pasa, van tras el menú. */
  actions?: React.ReactNode;

  /** Selección múltiple. Si `onSelect` no viene, no se dibuja casilla. */
  selected?: boolean;
  onSelect?: () => void;
  selectDisabled?: boolean;

  /** Abre el detalle: convierte el título en botón y, sólo en móvil, añade el menú de la derecha. */
  onOpen?: () => void;
  /** Etiqueta accesible del menú, ya traducida. */
  openLabel?: string;

  /** `compact` para listas largas; `normal` por defecto. */
  density?: 'compact' | 'normal';
  /** Marca de error: tiñe el borde sin depender sólo del color. */
  tone?: 'default' | 'danger';
  className?: string;
}

export function ListRow({
  media,
  title,
  badge,
  meta,
  metaALaDerecha = false,
  metaPlantilla,
  status,
  actions,
  selected = false,
  onSelect,
  selectDisabled = false,
  onOpen,
  openLabel,
  density = 'normal',
  tone = 'default',
  className = '',
}: ListRowProps) {
  const compacta = density === 'compact';
  const visibles = (meta || []).filter(Boolean);

  // A la derecha los datos van en columnas, y una columna solo se alinea con la
  // de la fila de abajo si todas las filas tienen las mismas. Por eso aqui los
  // huecos se conservan como celda vacia en vez de descartarse: bajo el titulo
  // se filtran, porque ahi lo unico que dejaria un nulo es un "· ·" suelto.
  const enColumnas = (meta || []).map((dato) => dato ?? '');

  return (
    <li
      className={`group relative flex items-center gap-2.5 md:gap-3 rounded-[var(--radius-md)] border px-2.5 transition-colors ${
        compacta ? 'py-1.5' : 'py-2'
      } ${
        selected
          ? 'border-[var(--accent-primary)]/40 bg-[var(--nav-active-bg)]'
          : tone === 'danger'
          ? 'border-[var(--status-danger)]/25 hover:bg-[var(--bg-surface-hover)]'
          : 'border-transparent hover:bg-[var(--bg-surface-hover)]'
      } ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        {onSelect && (
          <input
            type="checkbox"
            checked={selected}
            disabled={selectDisabled}
            onChange={onSelect}
            // Casilla nativa: foco, teclado y semántica para lectores de pantalla.
            className="shrink-0 w-4 h-4 accent-[var(--accent-primary)] cursor-pointer disabled:cursor-default"
          />
        )}

        {media && <div className="shrink-0">{media}</div>}

        {/* min-w-0 obligatorio: sin él un título largo empuja el estado fuera
            de la fila en vez de recortarse. */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {onOpen ? (
              <button
                type="button"
                onClick={onOpen}
                className={`min-w-0 text-left font-semibold text-[var(--text-primary)] hover:text-[var(--accent-text)] transition-colors cursor-pointer rounded-[var(--radius-xs)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)] line-clamp-2 md:line-clamp-none md:truncate ${
                  compacta ? 'text-[13px]' : 'text-sm'
                }`}
              >
                {title}
              </button>
            ) : (
              <span
                className={`min-w-0 font-semibold text-[var(--text-primary)] line-clamp-2 md:line-clamp-none md:truncate ${
                  compacta ? 'text-[13px]' : 'text-sm'
                }`}
              >
                {title}
              </span>
            )}
            {badge && <span className="hidden md:inline shrink-0">{badge}</span>}
          </div>

          {visibles.length > 0 && (
            <LineaMeta
              datos={visibles}
              className={`mt-0.5 ${metaALaDerecha ? 'lg:hidden' : ''}`}
            />
          )}
        </div>
      </div>

      {/* El estado va a la derecha en la misma linea, tambien en movil: darle
          una fila propia costaba 45 px por elemento y no anadia informacion.
          Lo que no cabe ahi lo esconde quien llama, porque es quien sabe si esa
          accion esta repetida en la hoja de detalle. */}
      {(status || actions || onOpen || (metaALaDerecha && visibles.length > 0)) && (
        <div
          className={`flex items-center justify-end gap-2.5 shrink-0 ${
            metaALaDerecha ? LADO_META : ''
          }`}
        >
          {metaALaDerecha && visibles.length > 0 && (
            /* Rejilla de columnas iguales, no una linea de datos pegada al
               borde: la fila mide 2230 px y entre el titulo y el estado
               quedaban 1400 en blanco. Repartidos en columnas el hueco se llena
               y ademas los valores quedan uno debajo de otro, que es lo que
               deja compararlos de un vistazo al recorrer la lista. */
            <div
              style={{ gridTemplateColumns: metaPlantilla || `repeat(${enColumnas.length}, minmax(0, 1fr))` }}
              className={`hidden lg:grid flex-1 min-w-0 ${REJILLA_META} text-[11px] font-mono text-[var(--text-muted)] tabular-nums`}
            >
              {enColumnas.map((dato, i) => (
                <span key={i} className="truncate text-center">
                  {dato}
                </span>
              ))}
            </div>
          )}
          {status}
          {actions}
          {/* El menu es de movil y solo de movil: ahi la fila esconde las
              acciones y esto es lo unico que las alcanza. En escritorio no
              esconde nada -las acciones ya estan a la vista y el titulo abre el
              detalle-, asi que era un tercer boton que no llevaba a ningun
              sitio nuevo. */}
          {onOpen && (
            <button
              type="button"
              onClick={onOpen}
              aria-label={openLabel}
              title={openLabel}
              className="md:hidden shrink-0 p-1.5 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]"
            >
              <MoreVertical className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Los datos secundarios, en una linea y separados por puntos.
 *
 * Está aparte porque se pinta en dos sitios -bajo el título o a la derecha- y
 * duplicar el recorte responsive garantizaba que uno de los dos se quedara
 * atrás en cuanto alguien lo tocara.
 */
function LineaMeta({ datos, className = '' }: { datos: React.ReactNode[]; className?: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 min-w-0 text-[11px] font-mono text-[var(--text-muted)] ${className}`}
    >
      {datos.map((dato, i) => (
        <React.Fragment key={i}>
          {i > 0 && (
            // En móvil caben los dos primeros; del tercero en adelante sólo
            // aparecen cuando hay ancho de sobra. El orden en que se pasan
            // decide qué sobrevive.
            <span aria-hidden="true" className={i > 1 ? 'hidden lg:inline' : ''}>
              ·
            </span>
          )}
          {/* El primero es el identificador -el episodio, la temporada- y suele
              ser corto: no se encoge, porque el reparto por igual lo dejaba en
              "T…" mientras el de al lado, mucho mas largo, apenas perdia nada. */}
          <span
            className={`${i === 0 ? 'shrink-0' : 'truncate min-w-0'} ${
              i > 1 ? 'hidden lg:inline' : ''
            }`}
          >
            {dato}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}

/**
 * Cabecera de columnas para las listas que pintan los datos a la derecha.
 *
 * Con los valores ya alineados, lo unico que faltaba para que esto se lea como
 * una tabla es decir que es cada columna. Solo aparece donde hay sitio para las
 * columnas -de `md` en adelante-, igual que ellas.
 *
 * Los textos llegan traducidos, como en el resto de estos componentes.
 */
export function ListRowsHeader({
  titulo,
  columnas,
  estado,
  plantilla,
}: {
  titulo: string;
  /** Un rotulo por cada dato de `meta`, en el mismo orden y con los mismos huecos. */
  columnas: string[];
  estado?: string;
  /** El mismo `metaPlantilla` que se le pasa a las filas. */
  plantilla?: string;
}) {
  return (
    <div className="hidden lg:flex items-center gap-2.5 px-2.5 pb-2 mb-1 border-x border-transparent border-b-[var(--glass-border)] border-b text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
      <div className={`flex-1 min-w-0 ${SANGRIA_TITULO}`}>{titulo}</div>

      <div className={`flex items-center gap-2.5 ${LADO_META}`}>
        <div
          style={{ gridTemplateColumns: plantilla || `repeat(${columnas.length}, minmax(0, 1fr))` }}
          className={`grid flex-1 min-w-0 ${REJILLA_META}`}
        >
          {columnas.map((col, i) => (
            <span key={i} className="truncate text-center">
              {col}
            </span>
          ))}
        </div>

        {estado && <span className="w-[104px] shrink-0 text-center">{estado}</span>}
      </div>
    </div>
  );
}

/**
 * Contenedor de la lista. Aporta la semántica y el ritmo vertical, para que no
 * lo reinvente cada pantalla.
 */
export function ListRows({
  children,
  label,
  className = '',
}: {
  children: React.ReactNode;
  /** Nombre de la lista para lectores de pantalla, ya traducido. */
  label?: string;
  className?: string;
}) {
  return (
    <ul aria-label={label} className={`flex flex-col gap-0.5 ${className}`}>
      {children}
    </ul>
  );
}
