import React from 'react';
import { Palette, RotateCcw, Check } from 'lucide-react';
import { THEME_SWATCHES } from './constants';
import type { ThemeSwatch } from './types';

interface ThemeSwatchesCardProps {
  selectedThemeId: string;
  handleSelectTheme: (swatch: ThemeSwatch) => void;
  t: (key: string, params?: any) => string;
}

export function ThemeSwatchesCard({
  selectedThemeId,
  handleSelectTheme,
  t,
}: ThemeSwatchesCardProps) {
  return (
    <div className="glass-card p-6 sm:p-7 space-y-4">
      {/* CARD DE PERSONALIZACIÓN DE TEMAS (ESTILO DISCORD) */}
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[6px] bg-[var(--color-brand-primary)]/10 border border-[var(--color-brand-primary)]/20 flex items-center justify-center text-[var(--color-brand-primary)] shrink-0">
          <Palette className="w-4 h-4" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading tracking-tight">{t('settings.appearance')}</h2>
          <p className="text-xs text-[var(--text-secondary)] mt-0.5">
            {t('settings.appearanceSubtitle')}
          </p>
        </div>
      </div>

      {/* Fila horizontal de muestras de tema */}
      <div className="flex items-center gap-3 pt-2 pb-1 flex-wrap">
        {THEME_SWATCHES.map((swatch) => {
          const isSelected = selectedThemeId === swatch.id;
          return (
            <div key={swatch.id} className="relative group">
              <button
                type="button"
                onClick={() => handleSelectTheme(swatch)}
                className={`w-11 h-11 sm:w-12 sm:h-12 rounded-[10px] transition-all duration-150 cursor-pointer relative flex items-center justify-center shadow-sm hover:scale-[1.06] active:scale-[0.98] ${
                  isSelected
                    ? 'ring-2 ring-[var(--color-brand-primary)] ring-offset-2 ring-offset-[var(--bg-app)]'
                    : 'border hover:border-[var(--border-strong)]'
                }`}
                style={{
                  backgroundColor: swatch.bgColor,
                  borderColor: swatch.borderColor || 'var(--border-subtle)',
                }}
                aria-label={t(swatch.name)}
              >
                {/* Contenido interior: dot de color o icono de rotación */}
                {swatch.dotColor && (
                  <span
                    className="w-3.5 h-3.5 rounded-full shadow-md"
                    style={{ backgroundColor: swatch.dotColor }}
                  />
                )}
                {swatch.isAuto && (
                  <RotateCcw className="w-4.5 h-4.5 text-zinc-400 group-hover:text-zinc-200 transition-colors" />
                )}

                {/* Badge de Selección (Check circular en la esquina superior derecha) */}
                {isSelected && (
                  <span className="absolute -top-1.5 -right-1.5 w-4.5 h-4.5 rounded-full bg-[var(--color-brand-primary)] text-white flex items-center justify-center shadow-md border-2 border-[var(--bg-app)] animate-in zoom-in-50 duration-150">
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  </span>
                )}
              </button>

              {/* Tooltip flotante con flecha apuntando hacia abajo */}
              <div className="absolute -top-9 left-1/2 -translate-x-1/2 px-2 py-1 rounded-[6px] bg-[var(--bg-surface-elevated)] text-[var(--text-primary)] border border-[var(--border-subtle)] text-[11px] font-semibold shadow-xl pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-150 transform group-hover:-translate-y-0.5 z-30 whitespace-nowrap">
                {t(swatch.name)}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-[var(--bg-surface-elevated)] border-r border-b border-[var(--border-subtle)] rotate-45" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Resumen del Tema Activo */}
      <div className="pt-2.5 flex items-center justify-between text-xs text-[var(--text-secondary)] border-t border-[var(--border-subtle)]">
        <span className="font-medium">{t('settings.activeTheme')}</span>
        <span className="font-bold text-[var(--text-primary)] font-mono">
          {t(THEME_SWATCHES.find((s) => s.id === selectedThemeId)?.name || 'settings.themeSync')}
        </span>
      </div>
    </div>
  );
}
