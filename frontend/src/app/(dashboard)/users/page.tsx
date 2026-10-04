'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/components/useModalA11y';
import { ConfirmModal } from '@/components/ConfirmModal';

import type { SortField } from './_components/types';
import { UsersPageHeader } from './_components/UsersPageHeader';
import { UsersTable } from './_components/UsersTable';
import { UsersCardGrid } from './_components/UsersCardGrid';
import { UserActionSheet } from './_components/UserActionSheet';
import { UserEditModal } from './_components/UserEditModal';
import { useNow } from '@/lib/useNow';

export default function UsersManagementPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t, locale } = useI18n();
  const now = useNow();
  const registrationDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const isRecent = (iso?: string) => !!iso && now - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
  // One page from the server; `total` (after filters) and `counts` (header) describe everyone.
  const [usersList, setUsersList] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ all: 0, admins: 0, active: 0, suspended: 0, new: 0 });
  const latestRequest = useRef(0);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  // ?search= arrives from the bell's "new user" notification.
  useEffect(() => {
    const searched = new URLSearchParams(window.location.search).get('search');
    if (searched) setSearchQuery(searched);
  }, []);
  const [roleFilter, setRoleFilter] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW'>('ALL');
  // View preference remembered per browser: a preference, not account data.
  const [vista, setView] = useState<'lista' | 'tarjetas'>('lista');
  useEffect(() => {
    try {
      if (localStorage.getItem('plexsync_users_view') === 'tarjetas') setView('tarjetas');
    } catch {}
  }, []);
  const openOptions = (u: any) => {
    if (window.matchMedia('(min-width: 1024px)').matches) handleOpenEdit(u);
    else setActiveUserMenuId(u.id);
  };
  const changeView = (v: 'lista' | 'tarjetas') => {
    setView(v);
    try {
      localStorage.setItem('plexsync_users_view', v);
    } catch {}
  };
  const [sort, setSort] = useState<{ field: SortField; asc: boolean }>({ field: 'createdAt', asc: false });
  const [perPage, setPerPage] = useState(10);
  const [page, setPage] = useState(1);
  const sortBy = (sortField: SortField) =>
    setSort((prev) => ({ field: sortField, asc: prev.field === sortField ? !prev.asc : sortField === 'username' }));
  const timeAgo = (iso?: string | null) => {
    if (!iso) return t('users.never');
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t('topbar.momentAgo');
    if (mins < 60) return t('topbar.minutesAgo', { mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('topbar.hoursAgo', { hours });
    return t('topbar.daysAgo', { days: Math.floor(hours / 24) });
  };
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);

  // Edit modal state
  const [editingUser, setEditingUser] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({
    username: '',
    email: '',
    role: 'USER',
    newPassword: '',
    reset2Fa: false,
    isSuspended: false,
    canScrobble: true,
    canAccessCatalog: true,
    canEditMappings: true,
    canSyncAnilist: true,
    canSyncMal: true,
    canSyncKitsu: true,
  });
  const [isSaving, setIsSaving] = useState(false);

  // Delete modal state
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  // Dialog semantics and focus management for modals in this view.
  const { dialogProps: editProps } = useModalA11y(Boolean(editingUser), () => setEditingUser(null));
  // Deletion no longer needs its own: ConfirmModal handles focus and
  // Escape. Leaving it here mounted two focus traps on the same dialog.

  useEffect(() => {
    api.auth
      .me()
      .catch(() => null)
      .then((meRes) => {
        const meUser = meRes?.user || meRes;
        if (!meUser || meUser.role !== 'ADMIN') {
          showToast(t('users.adminRequired'), 'error');
          router.push('/catalog');
        }
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The search reaches the server a moment after the last keystroke, not on every one.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchQuery.trim()), 300);
    return () => clearTimeout(id);
  }, [searchQuery]);

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, perPage, roleFilter, statusFilter, sort, debouncedSearch]);

  /** The page on screen, filtered and sorted by the server. An older answer arriving late is ignored. */
  const loadUsers = async () => {
    const request = ++latestRequest.current;
    try {
      const res = await api.admin.getUsers({
        page,
        limit: perPage,
        search: debouncedSearch,
        role: roleFilter,
        status: statusFilter,
        sort: sort.field,
        asc: sort.asc,
      });
      if (request !== latestRequest.current) return;
      // Past the last page (rows deleted, a narrower filter): go to the last one that has rows.
      if (res.items.length === 0 && page > 1 && res.total > 0) {
        setPage(Math.ceil(res.total / perPage));
        return;
      }
      setUsersList(res.items || []);
      setTotal(res.total || 0);
      setCounts(res.counts);
    } catch (e: any) {
      if (request === latestRequest.current) showToast(`${t('users.loadUsersError')} ` + e.message, 'error');
    } finally {
      if (request === latestRequest.current) setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setIsRefreshing(false);
    showToast(t('users.userListUpdated'), 'success');
  };

  // Open edit modal
  const handleOpenEdit = (user: any) => {
    setEditingUser(user);
    setEditForm({
      username: user.username || '',
      email: user.email || '',
      role: user.role || 'USER',
      newPassword: '',
      reset2Fa: false,
      isSuspended: !!user.permissions?.isSuspended,
      canScrobble: user.permissions?.canScrobble ?? true,
      canAccessCatalog: user.permissions?.canAccessCatalog ?? true,
      canEditMappings: user.permissions?.canEditMappings ?? true,
      canSyncAnilist: user.permissions?.canSyncAnilist ?? true,
      canSyncMal: user.permissions?.canSyncMal ?? true,
      canSyncKitsu: user.permissions?.canSyncKitsu ?? true,
    });
  };

  // Save user edit
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    try {
      setIsSaving(true);
      const payload: any = {
        username: editForm.username.trim(),
        email: editForm.email.trim().toLowerCase(),
        role: editForm.role,
        isSuspended: editForm.isSuspended,
        canScrobble: editForm.canScrobble,
        canAccessCatalog: editForm.canAccessCatalog,
        canEditMappings: editForm.canEditMappings,
        canSyncAnilist: editForm.canSyncAnilist,
        canSyncMal: editForm.canSyncMal,
        canSyncKitsu: editForm.canSyncKitsu,
      };

      if (editForm.newPassword.trim()) {
        if (editForm.newPassword.trim().length < 12) {
          showToast(t('auth.newPasswordMinLength'), 'error');
          setIsSaving(false);
          return;
        }
        payload.newPassword = editForm.newPassword.trim();
      }

      if (editForm.reset2Fa) {
        payload.reset2Fa = true;
      }

      await api.admin.updateUserPermissions(editingUser.id, payload);
      showToast(t('users.userUpdated', { username: editForm.username }), 'success');

      // Actualizar listado local
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === editingUser.id
            ? {
                ...u,
                username: editForm.username.trim(),
                email: editForm.email.trim().toLowerCase(),
                role: editForm.role,
                twoFactorEnabled: editForm.reset2Fa ? false : u.twoFactorEnabled,
                permissions: {
                  ...u.permissions,
                  isSuspended: editForm.isSuspended,
                  canScrobble: editForm.canScrobble,
                  canAccessCatalog: editForm.canAccessCatalog,
                  canEditMappings: editForm.canEditMappings,
                  canSyncAnilist: editForm.canSyncAnilist,
                  canSyncMal: editForm.canSyncMal,
                  canSyncKitsu: editForm.canSyncKitsu,
                },
              }
            : u
        )
      );

      setEditingUser(null);
      loadUsers();
    } catch (err: any) {
      showToast(`${t('users.saveError')} ` + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Quick toggle lock / suspension
  const handleToggleBlock = async (userId: string, currentSuspended: boolean, username: string) => {
    const nextState = !currentSuspended;
    try {
      await api.admin.updateUserPermissions(userId, { isSuspended: nextState });
      showToast(
        nextState ? t('users.userBlocked', { username }) : t('users.userUnblocked', { username }),
        nextState ? 'info' : 'success'
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, permissions: { ...u.permissions, isSuspended: nextState } }
            : u
        )
      );
      loadUsers();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Quick toggle ADMIN <-> USER role
  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await api.admin.updateUserPermissions(userId, { role: newRole });
      showToast(t('users.roleChanged', { role: newRole }), 'success');
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      loadUsers();
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Row leaves list on confirm; request sends when countdown
  // expires, so Undo only needs to restore the row.
  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    const user = deletingUser;
    setUsersList((prev) => prev.filter((u) => u.id !== user.id));
    setTotal((n) => Math.max(0, n - 1));
    setDeletingUser(null);
    showUndoToast(t('users.deletingUser', { username: user.username }), {
      onUndo: () => loadUsers(),
      onExpire: async () => {
        try {
          await api.admin.deleteUser(user.id);
          showToast(t('users.userDeleted', { username: user.username }), 'info');
        } catch (err: any) {
          showToast(`${t('users.deleteUserError')} ` + err.message, 'error');
        }
        loadUsers();
      },
    });
  };

  // Filters, sort (name breaks ties) and pages are applied by the server (admin-users.service.ts).
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = usersList;
  const SORTS: Array<{ value: string; label: string; field: SortField; asc: boolean }> = [
    { value: 'newest', label: t('users.sortNewest'), field: 'createdAt', asc: false },
    { value: 'oldest', label: t('users.sortOldest'), field: 'createdAt', asc: true },
    { value: 'name-asc', label: t('users.sortNameAsc'), field: 'username', asc: true },
    { value: 'name-desc', label: t('users.sortNameDesc'), field: 'username', asc: false },
    { value: 'active', label: t('users.sortLastActive'), field: 'lastActiveAt', asc: false },
  ];
  const currentSort = SORTS.find((o) => o.field === sort.field && o.asc === sort.asc)?.value || '';

  const totalUsersCount = counts.all;
  const adminUsersCount = counts.admins;
  const activeUsersCount = counts.active;
  const suspendedUsersCount = counts.suspended;
  const newUsersCount = counts.new;

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('users.title')} />

      <UsersPageHeader
        handleRefresh={handleRefresh}
        isRefreshing={isRefreshing}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        currentSort={currentSort}
        setSort={setSort}
        SORTS={SORTS}
        vista={vista}
        changeView={changeView}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setPage={setPage}
        totalUsersCount={totalUsersCount}
        adminUsersCount={adminUsersCount}
        activeUsersCount={activeUsersCount}
        suspendedUsersCount={suspendedUsersCount}
        newUsersCount={newUsersCount}
        t={t}
      />

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
        <UsersTable
          vista={vista}
          loading={loading}
          sort={sort}
          sortBy={sortBy}
          pageUsers={pageUsers}
          total={total}
          perPage={perPage}
          setPerPage={setPerPage}
          currentPage={currentPage}
          setPage={setPage}
          totalPages={totalPages}
          registrationDate={registrationDate}
          timeAgo={timeAgo}
          isRecent={isRecent}
          handleToggleBlock={handleToggleBlock}
          handleToggleRole={handleToggleRole}
          handleOpenEdit={handleOpenEdit}
          setDeletingUser={setDeletingUser}
          t={t}
        />

        <UsersCardGrid
          view={vista}
          loading={loading}
          total={total}
          pageUsers={pageUsers}
          totalPages={totalPages}
          currentPage={currentPage}
          setPage={setPage}
          registrationDate={registrationDate}
          timeAgo={timeAgo}
          isRecent={isRecent}
          openOptions={openOptions}
          setActiveUserMenuId={setActiveUserMenuId}
          handleOpenEdit={handleOpenEdit}
          handleToggleBlock={handleToggleBlock}
          setDeletingUser={setDeletingUser}
          t={t}
        />

        <UserActionSheet
          activeUserMenuId={activeUserMenuId}
          setActiveUserMenuId={setActiveUserMenuId}
          pageUsers={pageUsers}
          handleOpenEdit={handleOpenEdit}
          handleToggleRole={handleToggleRole}
          handleToggleBlock={handleToggleBlock}
          setDeletingUser={setDeletingUser}
          t={t}
        />
      </main>

      {/* ========================================================= */}
      {/* USER EDIT MODAL (HORIZONTAL WIDE) */}
      {/* ========================================================= */}
      {editingUser && (
        <UserEditModal
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          editProps={editProps}
          editForm={editForm}
          setEditForm={setEditForm}
          handleSaveEdit={handleSaveEdit}
          isSaving={isSaving}
          t={t}
        />
      )}

      {/* ========================================================= */}
      {/* DELETION CONFIRMATION MODAL */}
      {/* ========================================================= */}
      {/* Same confirmation dialog as history, not a custom one.
          The one here was hand-coded: no close button, no entrance
          animation, hardcoded Spanish copy, and idiosyncratic
          deletion styling. */}
      <ConfirmModal
        isOpen={Boolean(deletingUser)}
        title={t('users.deleteUser')}
        description={t('users.deleteUserQuestion', {
          username: deletingUser?.username || '',
          email: deletingUser?.email || '',
          warning: t('users.deleteUserWarning'),
        })}
        confirmText={t('users.deletePermanently')}
        cancelText={t('common.cancel')}
        variant="danger"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingUser(null)}
      />
    </div>
  );
}
