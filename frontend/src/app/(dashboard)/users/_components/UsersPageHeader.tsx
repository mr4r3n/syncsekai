import React from 'react';
import { Users, RefreshCw, Filter, ArrowUpDown, List, LayoutGrid, Search } from 'lucide-react';
import { CustomSelect } from '@/components/CustomSelect';
import type { CampoOrden } from './types';

interface UsersPageHeaderProps {
  handleRefresh: () => void;
  isRefreshing: boolean;
  filtroRol: 'ALL' | 'ADMIN' | 'USER';
  setFiltroRol: (val: 'ALL' | 'ADMIN' | 'USER') => void;
  filtroEstado: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW';
  setFiltroEstado: (val: 'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW') => void;
  ordenActual: string;
  setOrden: React.Dispatch<React.SetStateAction<{ campo: CampoOrden; asc: boolean }>>;
  ORDENES: Array<{ value: string; label: string; campo: CampoOrden; asc: boolean }>;
  vista: 'lista' | 'tarjetas';
  cambiarVista: (v: 'lista' | 'tarjetas') => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  setPagina: (p: number) => void;
  totalUsersCount: number;
  adminUsersCount: number;
  activeUsersCount: number;
  suspendedUsersCount: number;
  newUsersCount: number;
  t: (key: string, params?: any) => string;
}

export function UsersPageHeader({
  handleRefresh,
  isRefreshing,
  filtroRol,
  setFiltroRol,
  filtroEstado,
  setFiltroEstado,
  ordenActual,
  setOrden,
  ORDENES,
  vista,
  cambiarVista,
  searchQuery,
  setSearchQuery,
  setPagina,
  totalUsersCount,
  adminUsersCount,
  activeUsersCount,
  suspendedUsersCount,
  newUsersCount,
  t,
}: UsersPageHeaderProps) {
  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="w-full space-y-4">
        {/* El refresco va en la linea del titulo, no en una fila propia:
            en movil era un boton solo en 375 px de ancho, y con la barra de
            busqueda y los filtros debajo la cabecera se comia media
            pantalla antes de la primera cuenta. */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <Users className="w-4 h-4" />
              </div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('users.title')}</h1>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-1">
              {t('users.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="btn-secondary px-2.5 sm:px-3.5"
              title={t('users.refresh')}
              aria-label={t('users.refresh')}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} aria-hidden="true" />
              <span className="hidden sm:inline">{t('users.refresh')}</span>
            </button>
          </div>
        </div>

        {/* Desplegables de filtro y de orden; la busqueda a la derecha. */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[var(--glass-border)]">
          {/* En móvil, dos columnas y el orden a todo el ancho; en escritorio, una tira. */}
          <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 sm:flex-wrap">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)]">
              <Filter className="w-3.5 h-3.5" aria-hidden="true" />
              {t('users.filtersLabel')}
            </span>
            <CustomSelect
              value={filtroRol}
              onChange={(v) => {
                setFiltroRol(v as typeof filtroRol);
                setPagina(1);
              }}
              className="!w-full sm:!w-44 shrink-0" triggerClassName="!h-8 text-xs"
              options={[
                { value: 'ALL', label: `${t('users.allRoles')} (${totalUsersCount})` },
                { value: 'ADMIN', label: `${t('users.filterAdmins')} (${adminUsersCount})` },
                { value: 'USER', label: `${t('users.roleUsers')} (${totalUsersCount - adminUsersCount})` },
              ]}
            />
            <CustomSelect
              value={filtroEstado}
              onChange={(v) => {
                setFiltroEstado(v as typeof filtroEstado);
                setPagina(1);
              }}
              className="!w-full sm:!w-44 shrink-0" triggerClassName="!h-8 text-xs"
              options={[
                { value: 'ALL', label: t('users.allStatus') },
                { value: 'ACTIVE', label: `${t('users.filterActive')} (${activeUsersCount})` },
                { value: 'SUSPENDED', label: `${t('users.filterSuspended')} (${suspendedUsersCount})` },
                { value: 'NEW', label: `${t('users.filterNew')} (${newUsersCount})` },
              ]}
            />
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-[var(--text-muted)] sm:ml-2">
              <ArrowUpDown className="w-3.5 h-3.5" aria-hidden="true" />
            </span>
            <CustomSelect
              value={ordenActual}
              onChange={(v) => {
                const o = ORDENES.find((x) => x.value === v);
                if (o) setOrden({ campo: o.campo, asc: o.asc });
              }}
              placeholder={t('users.sortCustom')}
              className="!w-full sm:!w-44 shrink-0 col-span-2 sm:col-span-1" triggerClassName="!h-8 text-xs"
              options={ORDENES.map(({ value, label }) => ({ value, label }))}
            />
            <div className="hidden lg:inline-flex items-center rounded-[6px] bg-[var(--bg-surface)] p-0.5 sm:ml-2" role="group" aria-label={t('users.viewLabel')}>
              {(
                [
                  ['lista', List, t('users.viewList')],
                  ['tarjetas', LayoutGrid, t('users.viewCards')],
                ] as Array<['lista' | 'tarjetas', typeof List, string]>
              ).map(([v, Icono, etiqueta]) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => cambiarVista(v)}
                  aria-pressed={vista === v}
                  title={etiqueta}
                  aria-label={etiqueta}
                  className={`p-1.5 rounded-[5px] cursor-pointer transition-colors ${
                    vista === v ? 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)]'
                  }`}
                >
                  <Icono className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPagina(1);
              }}
              placeholder={t('users.searchPlaceholder')}
              suppressHydrationWarning
              autoComplete="off"
              className="glass-input glass-input-icon text-xs"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
