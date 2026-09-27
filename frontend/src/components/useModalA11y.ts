'use client';

import { useEffect, useRef } from 'react';

/**
 * Comportamiento accesible compartido para ventanas modales.
 *
 * Los modales del proyecto se anunciaban como un `div` cualquiera y, al abrirlos,
 * el foco del teclado se quedaba detrás, en la página. Quien navega con Tab
 * seguía recorriendo el contenido de fondo mientras el modal tapaba la pantalla,
 * y un lector de pantalla no tenía forma de saber que se había abierto nada.
 *
 * Resuelve cuatro cosas:
 *  - Anuncia el contenedor como diálogo modal (role + aria-modal).
 *  - Lleva el foco dentro al abrir, al primer control o al propio contenedor.
 *  - Mantiene el Tab dentro mientras está abierto.
 *  - Devuelve el foco al elemento que lo abrió al cerrar, para no perder el sitio.
 *
 * Uso:
 *   const modal = useModalA11y(isOpen, onClose);
 *   <div {...modal.overlayProps}> <div {...modal.dialogProps}> … </div> </div>
 */
const FOCUSABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Genérico en el tipo de elemento: por defecto un <div>, pero admite <aside> u
// otros contenedores sin obligar a castear en cada llamada.
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose?: () => void,
  titleId?: string,
) {
  const dialogRef = useRef<T>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);

  // onClose suele llegar como función en línea, así que cambia de identidad en
  // cada render. Si fuera dependencia del efecto, este se desmontaría y volvería
  // a montarse constantemente, y al reengancharse guardaría como "disparador" el
  // propio diálogo en lugar del botón que lo abrió: al cerrar, el foco se perdía.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Recordar quién abrió el modal para devolverle el foco al cerrar.
    disparadorRef.current = document.activeElement as HTMLElement | null;

    const nodo = dialogRef.current;
    if (nodo) {
      const primero = nodo.querySelector<HTMLElement>(FOCUSABLES);
      // Si no hay ningún control, se enfoca el propio diálogo (tiene tabIndex -1).
      (primero ?? nodo).focus({ preventScroll: true });
    }

    const alPulsarTecla = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && onCloseRef.current) {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab' || !dialogRef.current) return;

      const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLES)].filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];

      // Ciclar en los extremos en lugar de salirse al fondo de la página.
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', alPulsarTecla, true);
    return () => {
      document.removeEventListener('keydown', alPulsarTecla, true);
      // La limpieza corre durante el commit de React, ANTES de que retire del DOM
      // el nodo del diálogo. Si se devuelve el foco aquí mismo, React desmonta a
      // continuación y el foco acaba cayendo en <body>. Se aplaza un fotograma
      // para restaurarlo cuando el desmontaje ya ha terminado.
      const anterior = disparadorRef.current;
      requestAnimationFrame(() => {
        if (anterior && document.contains(anterior)) {
          anterior.focus({ preventScroll: true });
        }
      });
    };
  }, [isOpen]);

  return {
    dialogRef,
    dialogProps: {
      ref: dialogRef,
      role: 'dialog' as const,
      'aria-modal': true,
      ...(titleId ? { 'aria-labelledby': titleId } : {}),
      tabIndex: -1,
    },
  };
}
