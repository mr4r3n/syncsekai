'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { useRouter } from 'next/navigation';
import { useModalA11y } from '@/components/useModalA11y';
import { ConfirmModal } from '@/components/ConfirmModal';

import type { CampoOrden } from './_components/types';
import { UsersPageHeader } from './_components/UsersPageHeader';
import { UsersTable } from './_components/UsersTable';
import { UsersCardGrid } from './_components/UsersCardGrid';
import { UserActionSheet } from './_components/UserActionSheet';
import { UserEditModal } from './_components/UserEditModal';

export default function UsersManagementPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast, showUndoToast } = useToast();
  const { t, locale } = useI18n();
  const fechaAlta = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString(locale === 'es' ? 'es-ES' : 'en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '';
  const esReciente = (iso?: string) => !!iso && Date.now() - new Date(iso).getTime() < 7 * 24 * 60 * 60 * 1000;
  const [usersList, setUsersList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // ?search= llega desde la notificación de "nuevo usuario" de la campana.
  useEffect(() => {
    const buscado = new URLSearchParams(window.location.search).get('search');
    if (buscado) setSearchQuery(buscado);
  }, []);
  const [filtroRol, setFiltroRol] = useState<'ALL' | 'ADMIN' | 'USER'>('ALL');
  const [filtroEstado, setFiltroEstado] = useState<'ALL' | 'ACTIVE' | 'SUSPENDED' | 'NEW'>('ALL');
  // La vista se recuerda por navegador: es una preferencia, no un dato.
  const [vista, setVista] = useState<'lista' | 'tarjetas'>('lista');
  useEffect(() => {
    try {
      if (localStorage.getItem('plexsync_users_view') === 'tarjetas') setVista('tarjetas');
    } catch {}
  }, []);
  const abrirOpciones = (u: any) => {
    if (window.matchMedia('(min-width: 1024px)').matches) handleOpenEdit(u);
    else setActiveUserMenuId(u.id);
  };
  const cambiarVista = (v: 'lista' | 'tarjetas') => {
    setVista(v);
    try {
      localStorage.setItem('plexsync_users_view', v);
    } catch {}
  };
  const [orden, setOrden] = useState<{ campo: CampoOrden; asc: boolean }>({ campo: 'createdAt', asc: false });
  const [porPagina, setPorPagina] = useState(10);
  const [pagina, setPagina] = useState(1);
  const ordenarPor = (campo: CampoOrden) =>
    setOrden((prev) => ({ campo, asc: prev.campo === campo ? !prev.asc : campo === 'username' }));
  const haceCuanto = (iso?: string | null) => {
    if (!iso) return t('users.never');
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 1) return t('topbar.momentAgo');
    if (mins < 60) return t('topbar.minutesAgo', { mins });
    const hours = Math.floor(mins / 60);
    if (hours < 24) return t('topbar.hoursAgo', { hours });
    return t('topbar.daysAgo', { days: Math.floor(hours / 24) });
  };
  const [activeUserMenuId, setActiveUserMenuId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  // Estado para el modal de edición
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

  // Estado para modal de eliminación
  const [deletingUser, setDeletingUser] = useState<any | null>(null);

  // Semántica de diálogo y gestión de foco de los modales de esta vista.
  const { dialogProps: propsEditar } = useModalA11y(Boolean(editingUser), () => setEditingUser(null));
  // El borrado ya no necesita el suyo: ConfirmModal se encarga de su foco y de
  // su Escape. Dejarlo aqui montaba dos trampas de foco sobre el mismo dialogo.

  useEffect(() => {
    setMounted(true);
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('users.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const res = await api.admin.getUsers();
      setUsersList(res || []);
    } catch (e: any) {
      showToast(`${t('users.loadUsersError')} ` + e.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadUsers();
    setIsRefreshing(false);
    showToast(t('users.userListUpdated'), 'success');
  };

  // Abrir modal de edición
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

  // Guardar edición de usuario
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
      showToast(`Usuario "${editForm.username}" actualizado correctamente.`, 'success');

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
    } catch (err: any) {
      showToast(`${t('users.saveError')} ` + err.message, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Alternar bloqueo / suspensión rápido
  const handleToggleBlock = async (userId: string, currentSuspended: boolean, username: string) => {
    const nextState = !currentSuspended;
    try {
      await api.admin.updateUserPermissions(userId, { isSuspended: nextState });
      showToast(
        nextState ? `Usuario "${username}" bloqueado.` : `Usuario "${username}" desbloqueado y reactivado.`,
        nextState ? 'info' : 'success'
      );
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, permissions: { ...u.permissions, isSuspended: nextState } }
            : u
        )
      );
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // Alternar permiso individual (inline checkbox)
  const handleTogglePermission = async (userId: string, permKey: string, currentValue: boolean) => {
    try {
      const updated = { [permKey]: !currentValue };
      await api.admin.updateUserPermissions(userId, updated);
      showToast(`Permiso "${permKey}" actualizado.`, 'success');
      setUsersList((prev) =>
        prev.map((u) =>
          u.id === userId
            ? { ...u, permissions: { ...u.permissions, [permKey]: !currentValue } }
            : u
        )
      );
    } catch (err: any) {
      showToast(`${t('users.updatePermissionError')} ` + err.message, 'error');
    }
  };

  // Alternar rol ADMIN <-> USER rápido
  const handleToggleRole = async (userId: string, currentRole: string) => {
    const newRole = currentRole === 'ADMIN' ? 'USER' : 'ADMIN';
    try {
      await api.admin.updateUserPermissions(userId, { role: newRole });
      showToast(`Rol cambiado a ${newRole}.`, 'success');
      setUsersList((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
    } catch (err: any) {
      showToast('Error: ' + err.message, 'error');
    }
  };

  // La fila sale de la lista al confirmar; la petición se envía cuando expira
  // la cuenta atrás, así que Deshacer solo tiene que devolver la fila.
  const handleConfirmDelete = () => {
    if (!deletingUser) return;
    const usuario = deletingUser;
    setUsersList((prev) => prev.filter((u) => u.id !== usuario.id));
    setDeletingUser(null);
    showUndoToast(t('users.deletingUser', { username: usuario.username }), {
      alDeshacer: () => setUsersList((prev) => [...prev, usuario]),
      alExpirar: async () => {
        try {
          await api.admin.deleteUser(usuario.id);
          showToast(t('users.userDeleted', { username: usuario.username }), 'info');
        } catch (err: any) {
          setUsersList((prev) => [...prev, usuario]);
          showToast(`${t('users.deleteUserError')} ` + err.message, 'error');
        }
      },
    });
  };

  // Filtros
  const filteredUsers = usersList.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());

    const isSuspended = u.permissions?.isSuspended;
    const rolOk = filtroRol === 'ALL' || u.role === filtroRol;
    const estadoOk =
      filtroEstado === 'ALL' ||
      (filtroEstado === 'ACTIVE' && !isSuspended) ||
      (filtroEstado === 'SUSPENDED' && isSuspended) ||
      (filtroEstado === 'NEW' && esReciente(u.createdAt));
    return matchesSearch && rolOk && estadoOk;
  });

  // Orden estable: el desempate es el nombre, para que dos filas iguales no bailen.
  const valorOrden = (u: any): string | number => {
    switch (orden.campo) {
      case 'status': return u.permissions?.isSuspended ? 1 : 0;
      case 'role': return u.role === 'ADMIN' ? 0 : 1;
      case 'createdAt': return new Date(u.createdAt).getTime();
      case 'lastActiveAt': return u.lastActiveAt ? new Date(u.lastActiveAt).getTime() : 0;
      default: return (u.username || '').toLowerCase();
    }
  };
  const usuariosOrdenados = [...filteredUsers].sort((a, b) => {
    const va = valorOrden(a);
    const vb = valorOrden(b);
    const cmp = va < vb ? -1 : va > vb ? 1 : a.username.localeCompare(b.username);
    return orden.asc ? cmp : -cmp;
  });
  const totalPaginas = Math.max(1, Math.ceil(usuariosOrdenados.length / porPagina));
  const paginaActual = Math.min(pagina, totalPaginas);
  const usuariosPagina = usuariosOrdenados.slice((paginaActual - 1) * porPagina, paginaActual * porPagina);
  const ORDENES: Array<{ value: string; label: string; campo: CampoOrden; asc: boolean }> = [
    { value: 'newest', label: t('users.sortNewest'), campo: 'createdAt', asc: false },
    { value: 'oldest', label: t('users.sortOldest'), campo: 'createdAt', asc: true },
    { value: 'name-asc', label: t('users.sortNameAsc'), campo: 'username', asc: true },
    { value: 'name-desc', label: t('users.sortNameDesc'), campo: 'username', asc: false },
    { value: 'active', label: t('users.sortLastActive'), campo: 'lastActiveAt', asc: false },
  ];
  const ordenActual = ORDENES.find((o) => o.campo === orden.campo && o.asc === orden.asc)?.value || '';

  const totalUsersCount = usersList.length;
  const adminUsersCount = usersList.filter((u) => u.role === 'ADMIN').length;
  const activeUsersCount = usersList.filter((u) => !u.permissions?.isSuspended).length;
  const suspendedUsersCount = usersList.filter((u) => u.permissions?.isSuspended).length;
  const newUsersCount = usersList.filter((u) => esReciente(u.createdAt)).length;

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
        filtroRol={filtroRol}
        setFiltroRol={setFiltroRol}
        filtroEstado={filtroEstado}
        setFiltroEstado={setFiltroEstado}
        ordenActual={ordenActual}
        setOrden={setOrden}
        ORDENES={ORDENES}
        vista={vista}
        cambiarVista={cambiarVista}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        setPagina={setPagina}
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
          orden={orden}
          ordenarPor={ordenarPor}
          usuariosPagina={usuariosPagina}
          usuariosOrdenados={usuariosOrdenados}
          porPagina={porPagina}
          setPorPagina={setPorPagina}
          paginaActual={paginaActual}
          setPagina={setPagina}
          totalPaginas={totalPaginas}
          fechaAlta={fechaAlta}
          haceCuanto={haceCuanto}
          esReciente={esReciente}
          handleToggleBlock={handleToggleBlock}
          handleToggleRole={handleToggleRole}
          handleOpenEdit={handleOpenEdit}
          setDeletingUser={setDeletingUser}
          t={t}
        />

        <UsersCardGrid
          vista={vista}
          loading={loading}
          filteredUsers={filteredUsers}
          usuariosPagina={usuariosPagina}
          totalPaginas={totalPaginas}
          paginaActual={paginaActual}
          setPagina={setPagina}
          fechaAlta={fechaAlta}
          haceCuanto={haceCuanto}
          esReciente={esReciente}
          abrirOpciones={abrirOpciones}
          setActiveUserMenuId={setActiveUserMenuId}
          handleOpenEdit={handleOpenEdit}
          handleToggleBlock={handleToggleBlock}
          setDeletingUser={setDeletingUser}
          t={t}
        />

        <UserActionSheet
          activeUserMenuId={activeUserMenuId}
          setActiveUserMenuId={setActiveUserMenuId}
          filteredUsers={filteredUsers}
          handleOpenEdit={handleOpenEdit}
          handleToggleRole={handleToggleRole}
          handleToggleBlock={handleToggleBlock}
          setDeletingUser={setDeletingUser}
          t={t}
        />
      </main>

      {/* ========================================================= */}
      {/* MODAL DE EDICIÓN DE USUARIO (HORIZONTAL WIDE) */}
      {/* ========================================================= */}
      {editingUser && (
        <UserEditModal
          editingUser={editingUser}
          setEditingUser={setEditingUser}
          propsEditar={propsEditar}
          editForm={editForm}
          setEditForm={setEditForm}
          handleSaveEdit={handleSaveEdit}
          isSaving={isSaving}
          t={t}
        />
      )}

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMACIÓN DE ELIMINACIÓN */}
      {/* ========================================================= */}
      {/* El mismo dialogo de confirmacion que el historial, no uno propio.
          El de aqui estaba escrito a mano: sin boton de cerrar, sin animacion
          de entrada, con el texto en castellano fijo y con su propia idea de
          como se ve un borrado. */}
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
