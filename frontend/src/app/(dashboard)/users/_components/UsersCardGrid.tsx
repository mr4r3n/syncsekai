import React from 'react';
import { Crown, MoreVertical, Edit3, Lock, Unlock, Trash2, Sliders } from 'lucide-react';
import { Paginacion } from '@/components/Paginacion';
import { SERVICIOS_USUARIO } from './constants';
import { getAvatarSrc } from './utils';

interface UsersCardGridProps {
  vista: 'lista' | 'tarjetas';
  loading: boolean;
  filteredUsers: any[];
  usuariosPagina: any[];
  totalPaginas: number;
  paginaActual: number;
  setPagina: (p: number) => void;
  fechaAlta: (iso?: string) => string;
  haceCuanto: (iso?: string | null) => string;
  esReciente: (iso?: string) => boolean;
  abrirOpciones: (u: any) => void;
  setActiveUserMenuId: (id: string | null) => void;
  handleOpenEdit: (u: any) => void;
  handleToggleBlock: (userId: string, currentSuspended: boolean, username: string) => void;
  setDeletingUser: (u: any) => void;
  t: (key: string, params?: any) => string;
}

export function UsersCardGrid({
  vista,
  loading,
  filteredUsers,
  usuariosPagina,
  totalPaginas,
  paginaActual,
  setPagina,
  fechaAlta,
  haceCuanto,
  esReciente,
  abrirOpciones,
  setActiveUserMenuId,
  handleOpenEdit,
  handleToggleBlock,
  setDeletingUser,
  t,
}: UsersCardGridProps) {
  return (
    <div className={vista === 'tarjetas' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3' : 'block lg:hidden space-y-2.5'}>
      {/* Tarjeta de movil, en tres lineas en vez de cinco.
          ------------------------------------------------------------------
          Medía 239 px de alto y con cinco cuentas la pagina se iba a 1669:
          entraba una tarjeta y media en pantalla. La altura se la comian dos
          rotulos -"SERVIDORES" y "TRACKERS"- que gastaban un renglon entero
          para tres pastillas de 30 px, una fila propia para "Permisos
          Plataforma" y un "2FA: INACTIVO" que ocupa lo mismo diga lo que
          diga.

          Los seis servicios caben de sobra en una sola linea (unos 230 px de
          los 343 disponibles), y lo que valia la pena de los rotulos -saber
          que es cada pastilla- ya estaba en su title. */}
      {loading ? (
        <div className="p-8 text-center text-[var(--text-muted)] font-mono text-xs glass-card lg:col-span-full">{t('users.loadingUsers')}</div>
      ) : filteredUsers.length === 0 ? (
        <div className="p-8 text-center text-[var(--text-muted)] font-mono text-xs glass-card lg:col-span-full">{t('users.noUsersFound')}</div>
      ) : (
        usuariosPagina.map((u) => {
          const isSuspended = u.permissions?.isSuspended;
          const avatarSrc = getAvatarSrc(u.avatarUrl);
          const perms = u.permissions || {};
          const activePermCount = [
            perms.canScrobble ?? true,
            perms.canAccessCatalog ?? true,
            perms.canEditMappings ?? true,
            perms.canSyncAnilist ?? true,
            perms.canSyncMal ?? true,
            perms.canSyncKitsu ?? true,
          ].filter(Boolean).length;

          return (
            <div
              key={u.id}
              role="button"
              tabIndex={0}
              onClick={() => abrirOpciones(u)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  abrirOpciones(u);
                }
              }}
              aria-label={t('users.userOptions')}
              className={`glass-card p-3.5 space-y-2.5 border cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors ${
                isSuspended ? 'border-[var(--status-danger)]/25' : 'border-[var(--border-subtle)]'
              }`}
            >
              {/* 1. Quien es */}
              <div className="flex items-center gap-3">
                {avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt=""
                    className="w-10 h-10 rounded-[var(--radius-md)] object-cover border border-[var(--border-subtle)] shrink-0 bg-[var(--bg-app)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center font-bold text-sm shrink-0 border border-[var(--nav-active-border)]">
                    {u.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="font-bold text-sm text-[var(--text-primary)] truncate flex items-center gap-1.5 leading-snug">
                    <span className="truncate">{u.username}</span>
                    {u.role === 'ADMIN' && (
                      <Crown
                        className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0"
                        aria-label={t('users.administrator')}
                      />
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--text-muted)] truncate font-mono">{u.email}</div>
                  <div className="text-[10.5px] text-[var(--text-muted)] font-mono">
                    {t('users.joinedOn', { fecha: fechaAlta(u.createdAt) })} · {haceCuanto(u.lastActiveAt)}
                    {esReciente(u.createdAt) && <span className="ml-1.5 text-sky-400">{t('users.newBadge')}</span>}
                  </div>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveUserMenuId(u.id);
                  }}
                  className="lg:hidden p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 cursor-pointer"
                  title={t('users.userOptions')}
                  aria-label={t('users.openOptionsMenu')}
                >
                  <MoreVertical className="w-4 h-4" aria-hidden="true" />
                </button>
                {/* En escritorio, las mismas tres acciones que la lista. */}
                <div className="hidden lg:flex items-center gap-0.5 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOpenEdit(u);
                    }}
                    className="p-1.5 rounded-[5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
                    title={t('users.editUserAndCredentials')}
                    aria-label={t('users.editUserAndCredentials')}
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleBlock(u.id, isSuspended, u.username);
                    }}
                    className={`p-1.5 rounded-[5px] cursor-pointer transition-colors ${
                      isSuspended ? 'text-rose-400 hover:bg-rose-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                    }`}
                    title={isSuspended ? t('users.unblockAndReactivate') : t('users.blockAccountAccess')}
                    aria-label={isSuspended ? t('users.unblockAndReactivate') : t('users.blockAccountAccess')}
                  >
                    {isSuspended ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeletingUser(u);
                    }}
                    className="p-1.5 rounded-[5px] text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                    title={t('users.deleteUserPermanently')}
                    aria-label={t('users.deleteUserPermanently')}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 2. Todo lo demas en una sola linea que envuelve.
                  Eran dos filas con un separador entre medias, y en una
                  cuenta normal la de arriba llevaba unicamente la pastilla
                  de permisos empujada a la derecha: una linea entera para
                  un dato y un hueco. Las pastillas aparecen solo cuando
                  dicen algo -es admin, esta bloqueada, tiene 2FA- y los
                  servicios, solo los que estan vinculados. */}
              <div className="flex items-center gap-1.5 flex-wrap font-mono text-[10.5px] pt-2.5 border-t border-[var(--glass-border)]">
                {u.role === 'ADMIN' && (
                  <span className="px-2 py-0.5 rounded-[var(--radius-xs)] font-bold border bg-[var(--accent-primary)]/15 text-[var(--accent-text)] border-[var(--accent-primary)]/30">
                    {u.role}
                  </span>
                )}

                {isSuspended && (
                  <span className="badge-status-danger">{t('users.stateBlocked')}</span>
                )}

                {u.twoFactorEnabled && (
                  <span className="badge-status-success text-[10px]">2FA</span>
                )}

                {(() => {
                  const vinculados = SERVICIOS_USUARIO.filter((s) => !!u.connections?.[s.id]);
                  if (vinculados.length === 0) {
                    return (
                      <span className="text-[var(--text-muted)]">{t('users.noLinkedServices')}</span>
                    );
                  }
                  return vinculados.map(({ id, corto, nombre, color }) => {
                    const detalle =
                      u.connections?.[`${id}Server`] || u.connections?.[`${id}User`];
                    return (
                      <span
                        key={id}
                        title={t('users.linkedTo', {
                          service: nombre,
                          detail: detalle || t('users.connected'),
                        })}
                        className="h-6 px-2 rounded-[var(--radius-xs)] inline-flex items-center justify-center font-bold border border-current/35 bg-current/10"
                        style={{ color: `var(${color})` }}
                      >
                        {corto}
                      </span>
                    );
                  });
                })()}

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenEdit(u);
                  }}
                  className={`ml-auto inline-flex items-center gap-1.5 px-2 h-6 rounded-[var(--radius-xs)] font-medium cursor-pointer transition-colors border active:scale-95 ${
                    activePermCount === 6
                      ? 'bg-emerald-500/12 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/12 text-amber-300 border-amber-500/30'
                  }`}
                  title={t('users.permsTitle', { n: activePermCount })}
                >
                  <Sliders className="w-3 h-3 shrink-0" aria-hidden="true" />
                  <span>{activePermCount}/6</span>
                </button>
              </div>
            </div>
          );
        })
      )}
      {!loading && totalPaginas > 1 && (
        <Paginacion
          pagina={paginaActual}
          totalPaginas={totalPaginas}
          onCambio={setPagina}
          resumen={t('common.page', { page: paginaActual, total: totalPaginas })}
          etiquetaAnterior={t('common.previous')}
          etiquetaSiguiente={t('common.next')}
          className="pt-1 lg:col-span-full"
        />
      )}
    </div>
  );
}
