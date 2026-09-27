'use client';

import React, { createContext, useContext, useState, useRef, useEffect, useCallback } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { AlertTriangle, Loader2, Save, X, Trash2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export type SaveHandler = () => Promise<boolean | void> | boolean | void;

interface UnsavedChangesContextType {
  isDirty: boolean;
  setDirty: (dirty: boolean) => void;
  registerSaveHandler: (handler: SaveHandler | null) => void;
  confirmNavigation: (targetUrl: string, onProceed?: () => void) => boolean;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextType | null>(null);

export function useUnsavedChanges() {
  const context = useContext(UnsavedChangesContext);
  if (!context) {
    throw new Error('useUnsavedChanges must be used within an UnsavedChangesProvider');
  }
  return context;
}

export function UnsavedChangesProvider({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const [isDirty, setIsDirtyState] = useState(false);
  const isDirtyRef = useRef(false);
  const saveHandlerRef = useRef<SaveHandler | null>(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pendingNavigation, setPendingNavigation] = useState<{
    url?: string;
    onProceed?: () => void;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const setDirty = useCallback((dirty: boolean) => {
    setIsDirtyState(dirty);
    isDirtyRef.current = dirty;
  }, []);

  const registerSaveHandler = useCallback((handler: SaveHandler | null) => {
    saveHandlerRef.current = handler;
  }, []);

  // Al cambiar de ruta limpia el dirty state automáticamente
  useEffect(() => {
    setDirty(false);
    saveHandlerRef.current = null;
    setIsModalOpen(false);
    setPendingNavigation(null);
  }, [pathname, setDirty]);

  // Interceptar navegación por enlaces o router
  const confirmNavigation = useCallback(
    (targetUrl: string, onProceed?: () => void): boolean => {
      if (!isDirtyRef.current) {
        if (onProceed) onProceed();
        else router.push(targetUrl);
        return true;
      }

      setPendingNavigation({ url: targetUrl, onProceed });
      setIsModalOpen(true);
      return false;
    },
    [router]
  );

  // Interceptar cierre o recarga de pestaña
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDirtyRef.current) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, []);

  // Interceptar botón atrás/adelante del navegador
  useEffect(() => {
    const handlePopState = (e: PopStateEvent) => {
      if (isDirtyRef.current) {
        window.history.pushState(null, '', window.location.href);
        setIsModalOpen(true);
        setPendingNavigation({
          onProceed: () => {
            window.history.back();
          },
        });
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Acciones del modal
  const handleCancel = () => {
    setIsModalOpen(false);
    setPendingNavigation(null);
  };

  const handleDiscard = () => {
    const nav = pendingNavigation;
    setDirty(false);
    setIsModalOpen(false);
    setPendingNavigation(null);

    if (nav?.onProceed) {
      nav.onProceed();
    } else if (nav?.url) {
      router.push(nav.url);
    }
  };

  const handleSaveAndProceed = async () => {
    if (!saveHandlerRef.current) {
      handleDiscard();
      return;
    }

    setIsSaving(true);
    try {
      const result = await saveHandlerRef.current();
      if (result === false) {
        // El guardado falló explícitamente, cancelamos navegación
        setIsSaving(false);
        return;
      }

      const nav = pendingNavigation;
      setDirty(false);
      setIsModalOpen(false);
      setPendingNavigation(null);

      if (nav?.onProceed) {
        nav.onProceed();
      } else if (nav?.url) {
        router.push(nav.url);
      }
    } catch (err) {
      console.error('Error al guardar cambios antes de navegar:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <UnsavedChangesContext.Provider
      value={{
        isDirty,
        setDirty,
        registerSaveHandler,
        confirmNavigation,
      }}
    >
      {children}

      {/* MODAL DE PREVENCIÓN DE PÉRDIDA DE CAMBIOS GLASSMORPHISM */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="unsaved-modal-title"
            className="w-full max-w-md rounded-[10px] border border-[var(--glass-border)] bg-[var(--glass-bg)] p-6 shadow-[var(--glass-shadow-lg)] space-y-5 text-[var(--text-primary)] backdrop-blur-2xl animate-in zoom-in-95 duration-200"
          >
            {/* Header con Icono de Advertencia y Botón de Cerrar */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-[8px] flex items-center justify-center border shrink-0 bg-amber-500/10 border-amber-500/20 text-amber-400 shadow-xs">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h3 id="unsaved-modal-title" className="font-bold text-base font-heading text-[var(--text-primary)] tracking-tight">{t('common.unsavedTitle')}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer disabled:opacity-50"
                title={t('common.closeModal')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Mensaje Informativo */}
            <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('common.unsavedDesc')}</p>

            {/* Botones de Acción */}
            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[var(--glass-border)]">
              <button
                type="button"
                onClick={handleCancel}
                disabled={isSaving}
                className="btn-secondary text-xs px-3.5 py-2"
              >{t('common.cancel')}</button>

              <button
                type="button"
                onClick={handleDiscard}
                disabled={isSaving}
                className="btn-danger text-xs px-3.5 py-2 flex items-center gap-1.5"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Descartar</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAndProceed}
                disabled={isSaving}
                className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 shadow-sm"
              >
                {isSaving ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Save className="w-3.5 h-3.5" />
                )}
                <span>{isSaving ? 'Guardando...' : t('common.saveAndExit')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </UnsavedChangesContext.Provider>
  );
}
