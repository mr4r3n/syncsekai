'use client';

import { useEffect, useRef } from 'react';

/**
 * Shared accessible behavior for modal windows.
 *
 * Project modals were announced as generic `div`s and, on open,
 * keyboard focus stayed behind on the page. Tab navigation
 * kept traversing background content while the modal covered the screen,
 * and a screen reader had no way of knowing anything had opened.
 *
 * Solves four things:
 *  - Announces container as modal dialog (role + aria-modal).
 *  - Moves focus inside on open, to first control or container itself.
 *  - Traps Tab inside while open.
 *  - Returns focus to trigger element on close, keeping place.
 *
 * Usage:
 *   const modal = useModalA11y(isOpen, onClose);
 *   <div {...modal.overlayProps}> <div {...modal.dialogProps}> … </div> </div>
 */
const FOCUSABLES =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Generic over element type: defaults to <div>, but accepts <aside> or
// other containers without forcing a cast on every call.
export function useModalA11y<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose?: () => void,
  titleId?: string,
) {
  const dialogRef = useRef<T>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // onClose usually arrives as inline function, changing identity on
  // every render. If it were effect dependency, it would unmount and mount
  // continuously, storing the dialog itself as "trigger" on reconnect
  // instead of the opening button: on close, focus was lost.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    // Remember who opened the modal to return focus on close.
    triggerRef.current = document.activeElement as HTMLElement | null;

    const node = dialogRef.current;
    if (node) {
      const primero = node.querySelector<HTMLElement>(FOCUSABLES);
      // If there is no control, focus dialog itself (has tabIndex -1).
      (primero ?? node).focus({ preventScroll: true });
    }

    const onKeyDown = (e: KeyboardEvent) => {
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

      // Cycle at boundaries instead of escaping to background page.
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('keydown', onKeyDown, true);
      // Cleanup runs during React commit, BEFORE it removes from DOM
      // the dialog node. If focus is returned right here, React unmounts
      // next and focus lands on <body>. Deferred one frame
      // to restore it when unmounting is complete.
      const anterior = triggerRef.current;
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
