'use client';

import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { useModalA11y } from './useModalA11y';
import { useI18n } from '@/i18n/I18nProvider';

export interface BottomSheetAction {
  label: string;
  sublabel?: string;
  icon: React.ElementType;
  iconColor?: string;
  onClick: () => void;
  variant?: 'default' | 'danger' | 'warning' | 'success';
  disabled?: boolean;
}

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
  headerImage?: React.ReactNode;
  headerBadge?: React.ReactNode;
  actions: BottomSheetAction[];
  children?: React.ReactNode;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  subtitle,
  headerImage,
  headerBadge,
  actions,
  children,
}: BottomSheetProps) {
  const { t } = useI18n();
  const { dialogProps } = useModalA11y(isOpen, onClose);

  // Bloquear scroll de fondo cuando el bottom sheet está abierto
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Cerrar al presionar la tecla Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    /* Hoja pegada abajo en movil y dialogo centrado en escritorio. */
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6">
      {/* Fondo oscurecido con desenfoque / Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/65 backdrop-blur-sm animate-in fade-in duration-200 transition-opacity"
        aria-hidden="true"
      />

      {/* Contenedor del Bottom Sheet estilo Android / iOS */}
      {/* Ya declaraba role/aria-modal; lo que faltaba era el foco: al abrirse, el
          teclado seguía navegando la página de fondo, detrás de la hoja. */}
      <div
        {...dialogProps}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full sm:max-w-md bg-[var(--bg-surface-elevated)] border-t sm:border border-[var(--glass-border)] rounded-t-[var(--radius-xl,16px)] sm:rounded-[var(--radius-lg,10px)] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] sm:shadow-[var(--glass-shadow-lg)] backdrop-blur-2xl z-10 max-h-[88vh] flex flex-col animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 sm:duration-200 ease-out outline-none"
      >
        {/* La agarradera es de la hoja; en escritorio no hay nada que arrastrar. */}
        <div className="sm:hidden pt-3 pb-1.5 flex justify-center shrink-0 cursor-grab active:cursor-grabbing">
          <div className="w-12 h-1.5 rounded-full bg-white/25 hover:bg-white/40 transition-colors" />
        </div>

        {/* Cabecera con Info del Elemento */}
        {(title || headerImage) && (
          <div className="px-5 py-3 sm:pt-4 border-b border-[var(--border-subtle)] flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              {headerImage}
              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  {title && (
                    <h3 className="text-sm font-bold text-[var(--text-primary)] truncate font-heading">
                      {title}
                    </h3>
                  )}
                  {headerBadge}
                </div>
                {subtitle && (
                  <p className="text-xs text-[var(--text-muted)] truncate font-mono">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={onClose}
              className="w-9 h-9 flex items-center justify-center rounded-[var(--radius-md,6px)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer shrink-0"
              title={t('common.close')}
              aria-label={t('common.close')}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Contenido extra opcional (ej: badges o métricas) */}
        {children && <div className="px-5 py-3 border-b border-[var(--border-subtle)] shrink-0">{children}</div>}

        {/* Lista de Acciones con Área Táctil Ergonómica */}
        <div className="p-3.5 space-y-1.5 overflow-y-auto max-h-[55vh]">
          {actions.map((action, index) => {
            const Icon = action.icon;
            const isDanger = action.variant === 'danger';
            const isWarning = action.variant === 'warning';
            const isSuccess = action.variant === 'success';

            let textColor = 'text-[var(--text-primary)]';
            let iconColorClass = action.iconColor || 'text-[var(--accent-text)]';
            let hoverBg = 'hover:bg-[var(--bg-surface-hover)] active:bg-[var(--bg-surface-hover)]';

            if (isDanger) {
              textColor = 'text-rose-400 font-semibold';
              iconColorClass = 'text-rose-400';
              hoverBg = 'hover:bg-rose-500/15 active:bg-rose-500/20';
            } else if (isWarning) {
              textColor = 'text-amber-400 font-semibold';
              iconColorClass = 'text-amber-400';
              hoverBg = 'hover:bg-amber-500/15 active:bg-amber-500/20';
            } else if (isSuccess) {
              textColor = 'text-emerald-400 font-semibold';
              iconColorClass = 'text-emerald-400';
              hoverBg = 'hover:bg-emerald-500/15 active:bg-emerald-500/20';
            }

            return (
              <button
                key={index}
                disabled={action.disabled}
                onClick={() => {
                  onClose();
                  action.onClick();
                }}
                className={`w-full px-4 py-3 rounded-[var(--radius-lg,10px)] text-left text-xs sm:text-sm font-medium flex items-center gap-3.5 transition-all cursor-pointer select-none border border-transparent ${textColor} ${hoverBg} ${
                  action.disabled ? 'opacity-40 pointer-events-none' : ''
                }`}
              >
                <div className={`p-2 rounded-[var(--radius-md,6px)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] shrink-0 ${iconColorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate">{action.label}</div>
                  {action.sublabel && (
                    <div className="text-[11px] font-normal text-[var(--text-muted)] truncate">
                      {action.sublabel}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Botón Inferior Cancelar / Descartar */}
        <div className="p-3.5 pt-1 border-t border-[var(--border-subtle)] shrink-0">
          <button
            onClick={onClose}
            className="w-full py-2.5 rounded-[var(--radius-md,6px)] bg-[var(--bg-surface)] hover:bg-[var(--bg-surface-hover)] border border-[var(--border-subtle)] text-xs sm:text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer text-center"
          >{t('common.cancel')}</button>
        </div>
      </div>
    </div>
  );
}
