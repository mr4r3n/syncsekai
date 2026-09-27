'use client';

import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface SelectOption {
  value: string;
  label: string;
  badge?: string;
  icon?: React.ReactNode;
  /** No elegible. Se sigue viendo, apagada, para que se note que existe. */
  disabled?: boolean;
  /** Por que no se puede elegir, ya traducido. Sale como title. */
  disabledReason?: string;
}

interface CustomSelectProps {
  options: SelectOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  triggerClassName?: string;
  accentColor?: 'cinnabar' | 'rose' | 'emerald' | 'sky' | 'amber' | 'purple' | 'zinc';
}

export function CustomSelect({
  options,
  value,
  onChange,
  placeholder = 'Seleccionar opción...',
  className = '',
  triggerClassName = '',
  accentColor = 'cinnabar',
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getAccentBorderClass = () => {
    switch (accentColor) {
      case 'rose':
        return 'focus:border-rose-500 hover:border-rose-500/50';
      case 'emerald':
        return 'focus:border-emerald-500 hover:border-emerald-500/50';
      case 'amber':
        return 'focus:border-amber-500 hover:border-amber-500/50';
      case 'purple':
        return 'focus:border-purple-500 hover:border-purple-500/50';
      case 'sky':
        return 'focus:border-sky-500 hover:border-sky-500/50';
      case 'zinc':
        return 'focus:border-zinc-400 hover:border-white/20';
      default:
        return 'focus:border-[var(--border-focus)] hover:border-[var(--border-strong)]';
    }
  };

  const getSelectedHighlight = (isSelected: boolean) => {
    if (!isSelected) return 'text-[var(--text-secondary)] hover:bg-[var(--bg-surface-hover)] hover:text-[var(--text-primary)]';
    switch (accentColor) {
      case 'rose':
        return 'bg-rose-500/15 text-rose-400 font-bold border border-rose-500/30';
      case 'emerald':
        return 'bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/30';
      case 'amber':
        return 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30';
      case 'purple':
        return 'bg-purple-500/15 text-purple-400 font-bold border border-purple-500/30';
      case 'sky':
        return 'bg-sky-500/15 text-sky-400 font-bold border border-sky-500/30';
      default:
        return 'bg-[var(--accent-primary)]/15 text-[var(--accent-text)] font-bold border border-[var(--accent-primary)]/30';
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Botón Trigger con Glassmorphism */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full h-9 min-h-[36px] px-3.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md text-xs text-left text-[var(--text-primary)] flex items-center justify-between gap-2 outline-none transition-all duration-150 cursor-pointer select-none ${getAccentBorderClass()} ${
          isOpen ? 'ring-1 ring-[var(--border-strong)] border-[var(--border-strong)]' : ''
        } ${triggerClassName}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className="truncate font-medium">
            {selectedOption ? selectedOption.label : <span className="text-[var(--text-muted)]">{placeholder}</span>}
          </span>
          {selectedOption?.badge && (
            <span className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-mono bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)]">
              {selectedOption.badge}
            </span>
          )}
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-[var(--text-muted)] shrink-0 transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-[var(--text-primary)]' : ''
          }`}
        />
      </button>

      {/* Menú Desplegable Flotante */}
      {isOpen && (
        <div className="absolute z-[70] left-0 right-0 mt-1.5 max-h-64 overflow-y-auto rounded-[6px] border border-[var(--border-strong)] bg-[var(--popover-solid-bg)] shadow-[0_12px_40px_rgba(0,0,0,0.6)] p-1 space-y-0.5 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150 custom-scrollbar">
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={option.disabled}
                title={option.disabled ? option.disabledReason : undefined}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
                className={`w-full px-3 py-2 rounded-[var(--radius-md)] text-xs flex items-center justify-between gap-2 text-left transition-colors duration-150 ${
                  option.disabled
                    ? 'text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                    : `cursor-pointer ${getSelectedHighlight(isSelected)}`
                }`}
              >
                <div className="flex items-center gap-2 truncate">
                  {option.icon}
                  <span className="truncate">{option.label}</span>
                  {option.badge && (
                    <span className="px-1.5 py-0.5 rounded-[6px] text-[10px] font-mono bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-muted)]">
                      {option.badge}
                    </span>
                  )}
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 text-[var(--accent-text)]" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
