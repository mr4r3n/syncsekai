import React from 'react';
import { Crown, MoreVertical, Edit3, Lock, Unlock, Trash2, Sliders } from 'lucide-react';
import { Pagination } from '@/components/Pagination';
import { USER_SERVICES } from './constants';
import { getAvatarSrc } from './utils';

interface UsersCardGridProps {
  view: 'lista' | 'tarjetas';
  loading: boolean;
  /** Users that match the filters, across every page. */
  total: number;
  pageUsers: any[];
  totalPages: number;
  currentPage: number;
  setPage: (p: number) => void;
  registrationDate: (iso?: string) => string;
  timeAgo: (iso?: string | null) => string;
  isRecent: (iso?: string) => boolean;
  openOptions: (u: any) => void;
  setActiveUserMenuId: (id: string | null) => void;
  handleOpenEdit: (u: any) => void;
  handleToggleBlock: (userId: string, currentSuspended: boolean, username: string) => void;
  setDeletingUser: (u: any) => void;
  t: (key: string, params?: any) => string;
}

export function UsersCardGrid({
  view,
  loading,
  total,
  pageUsers,
  totalPages,
  currentPage,
  setPage,
  registrationDate,
  timeAgo,
  isRecent,
  openOptions,
  setActiveUserMenuId,
  handleOpenEdit,
  handleToggleBlock,
  setDeletingUser,
  t,
}: UsersCardGridProps) {
  return (
    <div className={view === 'tarjetas' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3' : 'block lg:hidden space-y-2.5'}>
      {/* Mobile card, in three lines instead of five.
          ------------------------------------------------------------------
          Measured 239 px high and with five accounts page stretched to 1669:
          barely 1.5 cards fit on screen. Height was consumed by two
          headers—"SERVERS" and "TRACKERS"—wasting an entire line
          for three 30 px pills, a dedicated row for "Platform
          Permissions", and a "2FA: INACTIVE" occupying space regardless
          of state.

          All six services comfortably fit on one line (about 230 px of
          343 available), and the value of headers—identifying
          pills—was already in their title attribute. */}
      {loading ? (
        <div className="p-8 text-center text-[var(--text-muted)] font-mono text-xs glass-card lg:col-span-full">{t('users.loadingUsers')}</div>
      ) : total === 0 ? (
        <div className="p-8 text-center text-[var(--text-muted)] font-mono text-xs glass-card lg:col-span-full">{t('users.noUsersFound')}</div>
      ) : (
        pageUsers.map((u) => {
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
              onClick={() => openOptions(u)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  openOptions(u);
                }
              }}
              aria-label={t('users.userOptions')}
              className={`glass-card p-3.5 space-y-2.5 border cursor-pointer hover:bg-[var(--bg-surface-hover)] transition-colors ${
                isSuspended ? 'border-[var(--status-danger)]/25' : 'border-[var(--border-subtle)]'
              }`}
            >
              {/* 1. Who it is */}
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
                    {t('users.joinedOn', { date: registrationDate(u.createdAt) })} · {timeAgo(u.lastActiveAt)}
                    {isRecent(u.createdAt) && <span className="ml-1.5 text-sky-400">{t('users.newBadge')}</span>}
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
                {/* On desktop, same three actions as the list. */}
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

              {/* 2. Everything else on a single wrapping line.
                  Previously two rows with separator between, and on normal
                  accounts top row carried only the permissions pill pushed
                  to right: a whole line for one value and empty space.
                  Pills appear only when informative—admin, blocked, 2FA—and
                  services appear only when linked. */}
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
                  const linked = USER_SERVICES.filter((s) => !!u.connections?.[s.id]);
                  if (linked.length === 0) {
                    return (
                      <span className="text-[var(--text-muted)]">{t('users.noLinkedServices')}</span>
                    );
                  }
                  return linked.map(({ id, short, name, color }) => {
                    const detail =
                      u.connections?.[`${id}Server`] || u.connections?.[`${id}User`];
                    return (
                      <span
                        key={id}
                        title={t('users.linkedTo', {
                          service: name,
                          detail: detail || t('users.connected'),
                        })}
                        className="h-6 px-2 rounded-[var(--radius-xs)] inline-flex items-center justify-center font-bold border border-current/35 bg-current/10"
                        style={{ color: `var(${color})` }}
                      >
                        {short}
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
      {!loading && totalPages > 1 && (
        <Pagination
          page={currentPage}
          totalPages={totalPages}
          onChange={setPage}
          summary={t('common.page', { page: currentPage, total: totalPages })}
          prevLabel={t('common.previous')}
          nextLabel={t('common.next')}
          className="pt-1 lg:col-span-full"
        />
      )}
    </div>
  );
}
