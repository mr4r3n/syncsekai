'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X, Undo2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

type ToastType = 'success' | 'warning' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
  /** Aviso con cuenta atrás: la acción se ejecuta al expirar salvo que se deshaga. */
  deshacer?: { expira: number; segundos: number; alDeshacer: () => void };
}

export interface OpcionesDeshacer {
  /** Segundos de cuenta atrás. */
  segundos?: number;
  /** Se ejecuta si nadie pulsa Deshacer antes de que expire. */
  alExpirar: () => void;
  /** Se ejecuta al pulsar Deshacer. */
  alDeshacer: () => void;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType) => void;
  /**
   * Aviso con botón Deshacer y cuenta atrás. La acción destructiva se hace
   * al expirar, no antes: así deshacer no tiene que revertir nada.
   */
  showUndoToast: (message: string, opciones: OpcionesDeshacer) => void;
}

const ToastContext = createContext<ToastContextType>({
  showToast: () => {},
  showUndoToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = React.useCallback((message: string, type: ToastType = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  const removeToast = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showUndoToast = React.useCallback((message: string, opciones: OpcionesDeshacer) => {
    const id = Math.random().toString(36).substring(2, 9);
    const segundos = opciones.segundos ?? 8;
    let deshecho = false;
    const temporizador = setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
      if (!deshecho) opciones.alExpirar();
    }, segundos * 1000);
    const alDeshacer = () => {
      deshecho = true;
      clearTimeout(temporizador);
      setToasts((prev) => prev.filter((t) => t.id !== id));
      opciones.alDeshacer();
    };
    setToasts((prev) => [
      ...prev,
      { id, message, type: 'warning', deshacer: { expira: Date.now() + segundos * 1000, segundos, alDeshacer } },
    ]);
  }, []);

  // Un tic periódico mientras haya alguna cuenta atrás en pantalla.
  const [, setTic] = useState(0);
  const hayCuentaAtras = toasts.some((t) => t.deshacer);
  useEffect(() => {
    if (!hayCuentaAtras) return;
    const i = setInterval(() => setTic((n) => n + 1), 250);
    return () => clearInterval(i);
  }, [hayCuentaAtras]);

  return (
    <ToastContext.Provider value={{ showToast, showUndoToast }}>
      {children}
      <div
        role="region"
        aria-label={t('common.systemNotifications')}
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.type === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-center justify-between p-3.5 rounded-[6px] text-xs font-medium shadow-2xl border animate-in slide-in-from-bottom-2 fade-in bg-[var(--popover-solid-bg)] text-[var(--text-primary)] ${
              toast.type === 'success'
                ? 'border-emerald-500/40'
                : toast.type === 'warning'
                ? 'border-amber-500/40'
                : toast.type === 'error'
                ? 'border-rose-500/40'
                : 'border-[var(--border-strong)]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" aria-hidden="true" />}
              {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />}
              {toast.type === 'error' && <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" aria-hidden="true" />}
              {toast.type === 'info' && <Info className="w-4 h-4 text-sky-400 shrink-0" aria-hidden="true" />}
              <span className="leading-snug">{toast.message}</span>
            </div>
            {toast.deshacer ? (
              <button
                type="button"
                onClick={toast.deshacer.alDeshacer}
                className="btn-secondary ml-3 shrink-0 text-xs py-1 px-2.5 relative overflow-hidden"
              >
                {/* Barra que se vacía con la cuenta atrás, detrás del texto. */}
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 left-0 bg-[var(--status-warning-bg)] transition-[width] duration-200 ease-linear"
                  style={{ width: `${Math.max(0, Math.min(100, ((toast.deshacer.expira - Date.now()) / (toast.deshacer.segundos * 1000)) * 100))}%` }}
                />
                <Undo2 className="w-3.5 h-3.5 relative" aria-hidden="true" />
                <span className="relative tabular-nums">
                  {t('common.undo')} ({Math.max(0, Math.ceil((toast.deshacer.expira - Date.now()) / 1000))}s)
                </span>
              </button>
            ) : (
              <button
                onClick={() => removeToast(toast.id)}
                aria-label={t('common.closeNotification')}
                className="ml-3 p-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
