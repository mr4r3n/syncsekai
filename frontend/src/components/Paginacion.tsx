'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * Barra de paginación compacta para listas que viven dentro de una tarjeta.
 *
 * Es la versión de una línea, no la barra completa de una pantalla: aquí no
 * caben cinco números de página y un salto directo sin robarle el sitio a la
 * propia lista. Dice dónde estás, cuántos elementos hay y deja moverte.
 *
 * Los textos llegan ya traducidos, igual que en `ListRow` y `SyncStatus`: este
 * componente no debe conocer el sistema de traducción.
 */
export function Paginacion({
  pagina,
  totalPaginas,
  onCambio,
  resumen,
  etiquetaAnterior,
  etiquetaSiguiente,
  className = '',
}: {
  /** Página actual, empezando en 1. */
  pagina: number;
  totalPaginas: number;
  onCambio: (pagina: number) => void;
  /** Texto de la izquierda, ya traducido: «28 países» o «Página 2 de 4». */
  resumen: string;
  etiquetaAnterior: string;
  etiquetaSiguiente: string;
  className?: string;
}) {
  // Con una sola página no hay nada que paginar, y una barra que no lleva a
  // ningún sitio es ruido.
  if (totalPaginas <= 1) return null;

  const boton =
    'p-1.5 rounded-[var(--radius-sm)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer disabled:opacity-30 disabled:pointer-events-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent-primary)]';

  return (
    <div
      className={`pt-3 mt-1 border-t border-[var(--glass-border)] flex items-center justify-between gap-3 ${className}`}
    >
      <span className="text-[11px] font-mono text-[var(--text-muted)] truncate">{resumen}</span>

      <div className="flex items-center gap-1.5 shrink-0">
        <button
          type="button"
          onClick={() => onCambio(pagina - 1)}
          disabled={pagina <= 1}
          aria-label={etiquetaAnterior}
          title={etiquetaAnterior}
          className={boton}
        >
          <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
        </button>

        <span className="text-[11px] font-mono font-bold text-[var(--text-primary)] tabular-nums px-1">
          {pagina}/{totalPaginas}
        </span>

        <button
          type="button"
          onClick={() => onCambio(pagina + 1)}
          disabled={pagina >= totalPaginas}
          aria-label={etiquetaSiguiente}
          title={etiquetaSiguiente}
          className={boton}
        >
          <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
