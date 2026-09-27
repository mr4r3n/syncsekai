import React from 'react';
import { Crown, Lock, Unlock, Trash2, Edit3, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';
import { Switch } from '@/components/Switch';
import { Pagination } from '@/components/Pagination';
import { USER_SERVICES } from './constants';
import { getAvatarSrc } from './utils';
import type { SortField } from './types';

interface UsersTableProps {
  vista: 'lista' | 'tarjetas';
  loading: boolean;
  sort: { field: SortField; asc: boolean };
  sortBy: (sortField: SortField) => void;
  pageUsers: any[];
  sortedUsers: any[];
  perPage: number;
  setPerPage: (n: number) => void;
  currentPage: number;
  setPage: (p: number) => void;
  totalPages: number;
  registrationDate: (iso?: string) => string;
  timeAgo: (iso?: string | null) => string;
  isRecent: (iso?: string) => boolean;
  handleToggleBlock: (userId: string, currentSuspended: boolean, username: string) => void;
  handleToggleRole: (userId: string, currentRole: string) => void;
  handleOpenEdit: (u: any) => void;
  setDeletingUser: (u: any) => void;
  t: (key: string, params?: any) => string;
}

export function UsersTable({
  vista,
  loading,
  sort,
  sortBy,
  pageUsers,
  sortedUsers,
  perPage,
  setPerPage,
  currentPage,
  setPage,
  totalPages,
  registrationDate,
  timeAgo,
  isRecent,
  handleToggleBlock,
  handleToggleRole,
  handleOpenEdit,
  setDeletingUser,
  t,
}: UsersTableProps) {
  return (
    <div className={`${vista === 'lista' ? 'hidden lg:block' : 'hidden'} glass-card overflow-hidden`}>
      {/* TABLA DESKTOP (PANTALLAS GRANDES >= 1024px) */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] font-mono uppercase text-[10.5px]">
            <tr>
              {(
                [
                  ['username', 'users.colUser', ''],
                  ['status', 'users.colStatus', ''],
                  ['role', 'users.colRole', ''],
                  [null, 'users.colServices', ''],
                  ['createdAt', 'users.colJoined', ''],
                  ['lastActiveAt', 'users.colLastActive', ''],
                  [null, 'users.adminActions', 'text-right'],
                ] as Array<[SortField | null, string, string]>
              ).map(([sortField, labelKey, extra]) => (
                <th key={labelKey} scope="col" className={`py-3 px-4 font-semibold ${extra}`}>
                  {sortField ? (
                    <button
                      type="button"
                      onClick={() => sortBy(sortField)}
                      className="inline-flex items-center gap-1 uppercase hover:text-[var(--text-primary)] cursor-pointer"
                    >
                      {t(labelKey)}
                      {sort.field === sortField ? (
                        sort.asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    t(labelKey)
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {loading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="animate-in fade-in">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="skeleton w-9 h-9 rounded-full shrink-0" />
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="skeleton h-3.5 w-28 rounded" />
                        <div className="skeleton h-2.5 w-36 rounded" />
                      </div>
                    </div>
                  </td>
                  {[...Array(5)].map((_, j) => (
                    <td key={j} className="py-3.5 px-4"><div className="skeleton h-5 w-20 rounded-[6px]" /></td>
                  ))}
                  <td className="py-3.5 px-4 text-right"><div className="skeleton h-7 w-24 ml-auto rounded-[6px]" /></td>
                </tr>
              ))
            ) : pageUsers.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-[var(--text-muted)] font-mono">{t('users.noUsersFound')}</td>
              </tr>
            ) : (
              pageUsers.map((u, i) => {
                const isSuspended = u.permissions?.isSuspended;
                const avatarSrc = getAvatarSrc(u.avatarUrl);
                const linked = USER_SERVICES.filter((sv) => !!u.connections?.[sv.id]);

                return (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-[var(--bg-surface-hover)] ${i % 2 === 1 ? 'bg-[var(--bg-surface)]/40' : ''}`}
                  >
                    {/* Usuario */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        {avatarSrc ? (
                          <img src={avatarSrc} alt="" className="w-9 h-9 rounded-full object-cover shrink-0 bg-[var(--bg-app)]" />
                        ) : (
                          <div className="w-9 h-9 rounded-full bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center font-bold text-xs shrink-0">
                            {u.username?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-bold text-[13px] text-[var(--text-primary)] truncate flex items-center gap-1.5 leading-snug">
                            <span className="truncate">{u.username}</span>
                            {u.role === 'ADMIN' && (
                              <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0" aria-label={t('users.administrator')} />
                            )}
                            {isRecent(u.createdAt) && (
                              <span className="text-[9.5px] font-mono font-bold text-sky-400 bg-sky-500/10 px-1.5 py-px rounded-[4px] shrink-0">{t('users.newBadge')}</span>
                            )}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)] truncate font-mono">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Estado */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={!isSuspended}
                          onChange={() => handleToggleBlock(u.id, isSuspended, u.username)}
                          ariaLabel={isSuspended ? t('users.unblockAndReactivate') : t('users.blockAccountAccess')}
                        />
                        {/* Fixed width: ACTIVE and BLOCKED differ in length and shifted adjacent items. */}
                        <span className={`min-w-[4.75rem] justify-center ${isSuspended ? 'badge-status-danger' : 'badge-status-success'}`}>
                          {isSuspended ? t('users.stateBlocked') : t('users.stateActive')}
                        </span>
                        {u.twoFactorEnabled && (
                          <span className="badge-pill text-[10px] font-mono" title="2FA">2FA</span>
                        )}
                        {u.inactivityLockedAt && (
                          <span className="badge-status-warning text-[10px] font-mono" title={t('users.inactivityLockHint')}>
                            {t('users.inactivityLock')}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Rol */}
                    <td className="py-3 px-4">
                      <button
                        type="button"
                        onClick={() => handleToggleRole(u.id, u.role)}
                        className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold cursor-pointer transition-colors ${
                          u.role === 'ADMIN'
                            ? 'bg-purple-500/20 text-purple-400 hover:bg-purple-500/30'
                            : 'badge-pill hover:text-[var(--text-primary)]'
                        }`}
                        title={t('users.toggleAdminUser')}
                      >
                        {u.role}
                      </button>
                    </td>

                    {/* Servicios vinculados */}
                    <td className="py-3 px-4">
                      {linked.length === 0 ? (
                        <span className="text-[var(--text-muted)] font-mono">—</span>
                      ) : (
                        <div className="flex items-center gap-1 font-mono text-[10.5px]">
                          {linked.map(({ id, short, name, color }) => {
                            const detail = u.connections?.[`${id}Server`] || u.connections?.[`${id}User`];
                            return (
                              <span
                                key={id}
                                title={t('users.linkedTo', { service: name, detail: detail || t('users.connected') })}
                                className="h-5 px-1.5 rounded-[4px] inline-flex items-center justify-center font-bold bg-current/10"
                                style={{ color: `var(${color})` }}
                              >
                                {short}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Alta */}
                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{registrationDate(u.createdAt)}</td>

                    {/* Last activity */}
                    <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{timeAgo(u.lastActiveAt)}</td>

                    {/* Acciones */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => handleOpenEdit(u)}
                          className="p-1.5 rounded-[5px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer transition-colors"
                          title={t('users.editUserAndCredentials')}
                          aria-label={t('users.editUserAndCredentials')}
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleBlock(u.id, isSuspended, u.username)}
                          className={`p-1.5 rounded-[5px] cursor-pointer transition-colors ${
                            isSuspended ? 'text-rose-400 hover:bg-rose-500/10' : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                          }`}
                          title={isSuspended ? t('users.unblockAndReactivate') : t('users.blockAccountAccess')}
                          aria-label={isSuspended ? t('users.unblockAndReactivate') : t('users.blockAccountAccess')}
                        >
                          {isSuspended ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => setDeletingUser(u)}
                          className="p-1.5 rounded-[5px] text-rose-400 hover:bg-rose-500/10 cursor-pointer transition-colors"
                          title={t('users.deleteUserPermanently')}
                          aria-label={t('users.deleteUserPermanently')}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Footer: rows per page and pagination */}
      {!loading && sortedUsers.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--glass-border)] text-[11px] font-mono text-[var(--text-muted)]">
          <div className="flex items-center gap-2">
            <span>{t('users.rowsPerPage')}</span>
            <select
              value={perPage}
              onChange={(e) => {
                setPerPage(Number(e.target.value));
                setPage(1);
              }}
              className="glass-input !h-7 !w-auto !px-2 text-[11px]"
              aria-label={t('users.rowsPerPage')}
            >
              {[10, 25, 50].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
            <span>
              {t('users.showingRange', {
                from: (currentPage - 1) * perPage + 1,
                to: Math.min(currentPage * perPage, sortedUsers.length),
                total: sortedUsers.length,
              })}
            </span>
          </div>
          <Pagination
            page={currentPage}
            totalPages={totalPages}
            onChange={setPage}
            summary={t('common.page', { page: currentPage, total: totalPages })}
            prevLabel={t('common.previous')}
            nextLabel={t('common.next')}
          />
        </div>
      )}
    </div>
  );
}
