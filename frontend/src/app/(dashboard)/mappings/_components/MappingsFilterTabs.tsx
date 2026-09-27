import React from 'react';
import { CustomSelect } from '@/components/CustomSelect';

interface MappingsFilterTabsProps {
  mappings: any[];
  statusFilter: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL';
  handleStatusFilterChange: (val: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL') => void;
  t: (key: string, params?: any) => string;
}

export function MappingsFilterTabs({
  mappings,
  statusFilter,
  handleStatusFilterChange,
  t,
}: MappingsFilterTabsProps) {
  {/* FILTROS, FUERA DEL CONTENEDOR
      Estaban dentro de la tarjeta, apretados contra su cabecera y
      compitiendo con el buscador por la misma fila. Filtrar decide QUE
      lista se ve, asi que va antes de la lista, no dentro. Es ademas
      como funciona el catalogo, que tenia el mismo problema.

      Pildoras en escritorio y desplegable en movil, por lo mismo que
      alli: cuatro pestanas no caben en 375 px sin cortarse. */}
  return (
    <>
      {(() => {
        const filtros: { id: 'ALL' | 'APPROVED' | 'PENDING' | 'GLOBAL'; etiqueta: string; cuenta: number; activo: string }[] = [
          { id: 'ALL', etiqueta: t('mappings.filterAll'), cuenta: mappings.length, activo: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]' },
          { id: 'APPROVED', etiqueta: t('mappings.filterLinked'), cuenta: mappings.filter((m) => m.isApproved).length, activo: 'bg-[var(--status-success-bg)] text-[var(--status-success)] border-[var(--status-success)]/30' },
          { id: 'PENDING', etiqueta: t('mappings.filterPending'), cuenta: mappings.filter((m) => !m.isApproved).length, activo: 'bg-[var(--status-warning-bg)] text-[var(--status-warning)] border-[var(--status-warning)]/30' },
          { id: 'GLOBAL', etiqueta: t('mappings.filterGlobal'), cuenta: mappings.filter((m) => m.isGlobal).length, activo: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]' },
        ];

        return (
          <>
            <div className="sm:hidden">
              <CustomSelect
                value={statusFilter}
                onChange={(v: string) => handleStatusFilterChange(v as any)}
                options={filtros.map((f) => ({
                  value: f.id,
                  label: f.etiqueta,
                  badge: String(f.cuenta),
                }))}
              />
            </div>

            <div
              role="tablist"
              aria-label={t('mappings.filterByStatus')}
              className="hidden sm:flex items-center gap-1.5 flex-wrap text-xs"
            >
              {filtros.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === f.id}
                  onClick={() => handleStatusFilterChange(f.id)}
                  className={`px-3 py-1.5 rounded-[var(--radius-md)] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                    statusFilter === f.id
                      ? `${f.activo} font-bold shadow-sm`
                      : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                  }`}
                >
                  {f.etiqueta} ({f.cuenta})
                </button>
              ))}
            </div>
          </>
        );
      })()}
    </>
  );
}
