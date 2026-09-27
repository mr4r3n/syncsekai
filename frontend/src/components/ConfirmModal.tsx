'use client';

import React, { useId } from 'react';
import { AlertTriangle, Trash2, X, AlertCircle, Info, CheckCircle2, Loader2 } from 'lucide-react';
import { useModalA11y } from './useModalA11y';

export interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info' | 'success';
  loading?: boolean;
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  /**
   * Contenido extra entre la descripción y los botones.
   *
   * Para las confirmaciones que necesitan algo más que un sí: escribir la
   * contraseña, marcar una casilla. Sin esto había que duplicar el diálogo
   * entero cada vez que hacía falta un campo.
   */
  children?: React.ReactNode;
}

export function ConfirmModal({
  isOpen,
  title,
  description,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  variant = 'danger',
  loading = false,
  onConfirm,
  onClose,
  children,
}: ConfirmModalProps) {
  // Los hooks se llaman antes del retorno temprano: si no, React se queja de que
  // el número de hooks cambia entre renders al abrir y cerrar el modal.
  const tituloId = useId();
  const { dialogProps } = useModalA11y(isOpen, onClose, tituloId);

  if (!isOpen) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case 'danger':
        return {
          icon: <Trash2 className="w-5 h-5 text-rose-400" />,
          iconBg: 'bg-rose-500/10 border-rose-500/20 text-rose-400',
          btnClass: 'btn-danger-solid',
          titleColor: 'text-[var(--text-primary)]',
        };
      case 'warning':
        return {
          icon: <AlertTriangle className="w-5 h-5 text-amber-500 dark:text-amber-400" />,
          iconBg: 'bg-amber-500/10 border-amber-500/20 text-amber-500 dark:text-amber-400',
          btnClass: 'bg-amber-500 hover:bg-amber-600 text-black font-semibold shadow-lg shadow-amber-500/20 rounded-[var(--radius-md,6px)] h-9 px-3.5',
          titleColor: 'text-[var(--text-primary)]',
        };
      case 'success':
        return {
          icon: <CheckCircle2 className="w-5 h-5 text-emerald-500 dark:text-emerald-400" />,
          iconBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500 dark:text-emerald-400',
          btnClass: 'bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20 rounded-[var(--radius-md,6px)] h-9 px-3.5',
          titleColor: 'text-[var(--text-primary)]',
        };
      case 'info':
      default:
        return {
          icon: <Info className="w-5 h-5 text-sky-500 dark:text-sky-400" />,
          iconBg: 'bg-sky-500/10 border-sky-500/20 text-sky-500 dark:text-sky-400',
          btnClass: 'btn-primary',
          titleColor: 'text-[var(--text-primary)]',
        };
    }
  };

  const style = getVariantStyles();

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
      <div
        {...dialogProps}
        // En movil sube desde abajo como una hoja, igual que el resto de la
        // web; en escritorio sigue siendo el dialogo centrado de siempre.
        className="w-full sm:max-w-md rounded-t-[var(--radius-xl,16px)] sm:rounded-[var(--radius-lg,10px)] border-t sm:border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] sm:bg-[var(--glass-bg)] p-5 sm:p-6 pb-7 sm:pb-6 shadow-[0_-12px_48px_rgba(0,0,0,0.6)] sm:shadow-[var(--glass-shadow-lg)] space-y-5 text-[var(--text-primary)] backdrop-blur-2xl animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 sm:duration-200 outline-none"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-[var(--radius-md,6px)] flex items-center justify-center border shrink-0 ${style.iconBg}`}>
              {style.icon}
            </div>
            <div>
              <h3 id={tituloId} className={`font-bold text-base font-heading ${style.titleColor}`}>{title}</h3>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Cerrar modal"
            className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md,6px)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{description}</p>

        {children}

        <div className="flex flex-wrap items-center justify-end gap-2.5 pt-2 border-t border-[var(--glass-border)]">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="btn-secondary"
          >
            {cancelText}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`cursor-pointer disabled:opacity-50 ${style.btnClass}`}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            <span>{confirmText}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
