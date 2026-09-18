'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Users,
  Search,
  RefreshCw,
  UserCheck,
  UserX,
  Trash2,
  Shield,
  Filter,
  CheckCircle2,
  Tv,
  Radio,
  Sliders,
  Check,
  X,
  AlertTriangle,
  Clock,
  Sparkles,
  Edit3,
  Lock,
  Unlock,
  Key,
  ShieldAlert,
  Save,
  Mail,
  User as UserIcon,
  Camera,
  MoreVertical,
  Crown,
  Loader2,
  ChevronsUpDown,
  ChevronUp,
  ChevronDown,
  LayoutGrid,
  List,
  ArrowUpDown,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/components/CustomSelect';
import { BottomSheet } from '@/components/BottomSheet';
import { useModalA11y } from '@/components/useModalA11y';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Switch } from '@/components/Switch';
import { Paginacion } from '@/components/Paginacion';

/**
 * Los seis servicios que puede tener vinculados una cuenta.
 *
 * El color sale de las variables de marca y no de un hex suelto: escritas a
 * mano en dos sitios ya se habian separado, y Jellyfin salia azul en la tabla
 * de escritorio y morado en la tarjeta de movil.
 */
const SERVICIOS_USUARIO = [
  { id: 'plex', corto: 'PLEX', nombre: 'Plex', color: '--brand-plex' },
  { id: 'jellyfin', corto: 'JF', nombre: 'Jellyfin', color: '--brand-jellyfin' },
  { id: 'emby', corto: 'EM', nombre: 'Emby', color: '--brand-emby' },
  { id: 'anilist', corto: 'AL', nombre: 'AniList', color: '--brand-anilist' },
  { id: 'mal', corto: 'MAL', nombre: 'MyAnimeList', color: '--brand-mal' },
  { id: 'kitsu', corto: 'KT', nombre: 'Kitsu', color: '--brand-kitsu' },
] as const;

/** Los seis permisos de cuenta, en el orden en que se pintan. */
const PERMISOS_USUARIO = [
  { campo: 'canScrobble', clave: 'users.permScrobble' },
  { campo: 'canAccessCatalog', clave: 'users.catalogueAccess' },
  { campo: 'canEditMappings', clave: 'users.mappingsEditing' },
  { campo: 'canSyncAnilist', clave: 'users.permSyncAnilist' },
  { campo: 'canSyncMal', clave: 'users.permSyncMal' },
  { campo: 'canSyncKitsu', clave: 'users.permSyncKitsu' },
] as const;

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
  type CampoOrden = 'username' | 'status' | 'role' | 'createdAt' | 'lastActiveAt';
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

  const getAvatarSrc = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return url;
    return `/api/auth/avatar/${url}`;
  };

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

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
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

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-6 min-w-0">
        {/* TABLA DESKTOP (PANTALLAS GRANDES >= 1024px) */}
        <div className={`${vista === 'lista' ? 'hidden lg:block' : 'hidden'} glass-card overflow-hidden`}>
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
                    ] as Array<[CampoOrden | null, string, string]>
                  ).map(([campo, clave, extra]) => (
                    <th key={clave} scope="col" className={`py-3 px-4 font-semibold ${extra}`}>
                      {campo ? (
                        <button
                          type="button"
                          onClick={() => ordenarPor(campo)}
                          className="inline-flex items-center gap-1 uppercase hover:text-[var(--text-primary)] cursor-pointer"
                        >
                          {t(clave)}
                          {orden.campo === campo ? (
                            orden.asc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronsUpDown className="w-3 h-3 opacity-40" />
                          )}
                        </button>
                      ) : (
                        t(clave)
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
                ) : usuariosPagina.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-[var(--text-muted)] font-mono">{t('users.noUsersFound')}</td>
                  </tr>
                ) : (
                  usuariosPagina.map((u, i) => {
                    const isSuspended = u.permissions?.isSuspended;
                    const avatarSrc = getAvatarSrc(u.avatarUrl);
                    const vinculados = SERVICIOS_USUARIO.filter((sv) => !!u.connections?.[sv.id]);

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
                                {esReciente(u.createdAt) && (
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
                            {/* Ancho fijo: ACTIVE y BLOCKED miden distinto y movían lo de al lado. */}
                            <span className={`min-w-[4.75rem] justify-center ${isSuspended ? 'badge-status-danger' : 'badge-status-success'}`}>
                              {isSuspended ? t('users.stateBlocked') : t('users.stateActive')}
                            </span>
                            {u.twoFactorEnabled && (
                              <span className="badge-pill text-[10px] font-mono" title="2FA">2FA</span>
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
                          {vinculados.length === 0 ? (
                            <span className="text-[var(--text-muted)] font-mono">—</span>
                          ) : (
                            <div className="flex items-center gap-1 font-mono text-[10.5px]">
                              {vinculados.map(({ id, corto, nombre, color }) => {
                                const detalle = u.connections?.[`${id}Server`] || u.connections?.[`${id}User`];
                                return (
                                  <span
                                    key={id}
                                    title={t('users.linkedTo', { service: nombre, detail: detalle || t('users.connected') })}
                                    className="h-5 px-1.5 rounded-[4px] inline-flex items-center justify-center font-bold bg-current/10"
                                    style={{ color: `var(${color})` }}
                                  >
                                    {corto}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </td>

                        {/* Alta */}
                        <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{fechaAlta(u.createdAt)}</td>

                        {/* Última actividad */}
                        <td className="py-3 px-4 font-mono text-[11px] text-[var(--text-secondary)] whitespace-nowrap">{haceCuanto(u.lastActiveAt)}</td>

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

          {/* Pie: filas por página y paginación */}
          {!loading && usuariosOrdenados.length > 0 && (
            <div className="flex items-center justify-between gap-3 px-4 py-3 border-t border-[var(--glass-border)] text-[11px] font-mono text-[var(--text-muted)]">
              <div className="flex items-center gap-2">
                <span>{t('users.rowsPerPage')}</span>
                <select
                  value={porPagina}
                  onChange={(e) => {
                    setPorPagina(Number(e.target.value));
                    setPagina(1);
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
                    from: (paginaActual - 1) * porPagina + 1,
                    to: Math.min(paginaActual * porPagina, usuariosOrdenados.length),
                    total: usuariosOrdenados.length,
                  })}
                </span>
              </div>
              <Paginacion
                pagina={paginaActual}
                totalPaginas={totalPaginas}
                onCambio={setPagina}
                resumen={t('common.page', { page: paginaActual, total: totalPaginas })}
                etiquetaAnterior={t('common.previous')}
                etiquetaSiguiente={t('common.next')}
              />
            </div>
          )}
        </div>

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
        <div className={vista === 'tarjetas' ? 'grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3' : 'block lg:hidden space-y-2.5'}>
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

        {/* BOTTOM SHEET NATIVO MÓVIL PARA OPCIONES DE USUARIO */}
        {(() => {
          const selectedUser = filteredUsers.find((u: any) => u.id === activeUserMenuId);
          if (!selectedUser) return null;
          const isSuspended = selectedUser.permissions?.isSuspended;
          const avatarSrc = getAvatarSrc(selectedUser.avatarUrl);

          return (
            <BottomSheet
              isOpen={!!activeUserMenuId}
              onClose={() => setActiveUserMenuId(null)}
              title={selectedUser.username}
              subtitle={selectedUser.email}
              headerImage={
                avatarSrc ? (
                  <img
                    src={avatarSrc}
                    alt={selectedUser.username}
                    className="w-10 h-10 rounded-[8px] object-cover border border-[var(--border-subtle)] shadow-sm shrink-0 bg-[var(--bg-app)]"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-[8px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center font-bold text-sm border border-[var(--nav-active-border)] shrink-0">
                    {selectedUser.username?.[0]?.toUpperCase() || 'U'}
                  </div>
                )
              }
              headerBadge={
                <span
                  className={`px-2 py-0.5 rounded-[4px] text-[10px] font-mono font-bold ${
                    selectedUser.role === 'ADMIN'
                      ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                      : 'badge-pill'
                  }`}
                >
                  {selectedUser.role}
                </span>
              }
              actions={[
                {
                  label: t('users.editDataAndPermissions'),
                  sublabel: t('users.editDataDesc'),
                  icon: Edit3,
                  iconColor: 'text-[var(--accent-text)]',
                  onClick: () => handleOpenEdit(selectedUser),
                },
                {
                  label: t('users.changeRoleTo', { role: selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN' }),
                  sublabel:
                    selectedUser.role === 'ADMIN'
                      ? t('users.revokeAdmin')
                      : t('users.grantFullPermissions'),
                  icon: Shield,
                  iconColor: 'text-purple-400',
                  onClick: () => handleToggleRole(selectedUser.id, selectedUser.role),
                },
                {
                  label: isSuspended ? t('users.unblockAccount') : t('users.blockAccountAccess'),
                  sublabel: isSuspended
                    ? t('users.restoreLoginAndSync')
                    : t('users.suspendAccessNow'),
                  icon: isSuspended ? Unlock : Lock,
                  variant: isSuspended ? 'success' : 'warning',
                  onClick: () =>
                    handleToggleBlock(selectedUser.id, isSuspended, selectedUser.username),
                },
                {
                  label: t('users.deleteUserPermanentlyTitle'),
                  sublabel: t('users.deleteUserPermanentlyDesc'),
                  icon: Trash2,
                  variant: 'danger',
                  onClick: () => setDeletingUser(selectedUser),
                },
              ]}
            />
          );
        })()}
      </main>

      {/* ========================================================= */}
      {/* MODAL DE EDICIÓN DE USUARIO (HORIZONTAL WIDE) */}
      {/* ========================================================= */}
      {editingUser && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6 bg-black/70 backdrop-blur-md animate-in fade-in duration-200">
          <div
            {...propsEditar}
            /* En movil esto es una hoja que sube desde abajo, no un dialogo
               flotando en el centro: es lo que hace el resto de la web -el menu
               de opciones ya era asi- y ademas deja el contenido pegado al
               pulgar en vez de en mitad de la pantalla. */
            className="relative w-full sm:max-w-2xl rounded-t-[var(--radius-xl)] sm:rounded-[var(--radius-lg)] border-t sm:border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] sm:bg-[var(--glass-bg)] shadow-[0_-12px_48px_rgba(0,0,0,0.6)] sm:shadow-[var(--glass-shadow-lg)] flex flex-col text-[var(--text-primary)] backdrop-blur-2xl max-h-[92vh] sm:max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:zoom-in-95 duration-300 sm:duration-200 outline-none"
          >
            {/* Agarradera, como en la hoja de opciones */}
            <div className="sm:hidden pt-3 pb-1 flex justify-center shrink-0">
              <div className="w-12 h-1.5 rounded-full bg-white/25" />
            </div>
            {/* Cabecera.
                El avatar era un cuadrado de 80 px que se comia el ancho, y al
                lado del titulo colgaba una pastilla con el id recortado, que no
                se puede copiar ni sirve para nada aqui: ahora vive en el title
                del avatar, por si alguna vez hace falta. */}
            <div className="flex items-center gap-3.5 px-5 sm:px-6 py-4 border-b border-[var(--glass-border)] shrink-0">
              {getAvatarSrc(editingUser.avatarUrl) ? (
                <img
                  src={getAvatarSrc(editingUser.avatarUrl)!}
                  alt=""
                  title={editingUser.id}
                  className="w-11 h-11 rounded-[var(--radius-md)] object-cover border border-[var(--border-subtle)] shrink-0 bg-[var(--bg-app)]"
                />
              ) : (
                <div
                  title={editingUser.id}
                  className="w-11 h-11 rounded-[var(--radius-md)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center font-bold text-base shrink-0"
                >
                  {editingUser.username?.[0]?.toUpperCase() || 'U'}
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
                  {t('users.editingAccount')}
                </p>
                <h2 className="text-base font-bold font-heading leading-tight truncate flex items-center gap-1.5">
                  <span className="truncate">@{editingUser.username}</span>
                  {editingUser.role === 'ADMIN' && (
                    <Crown
                      className="w-3.5 h-3.5 text-amber-400 fill-amber-400 shrink-0"
                      aria-label={t('users.administrator')}
                    />
                  )}
                </h2>
                <p className="text-[11px] text-[var(--text-muted)] font-mono truncate">
                  {editingUser.email}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="w-9 h-9 rounded-[var(--radius-md)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors flex items-center justify-center cursor-pointer shrink-0"
                title={t('common.closeModal')}
                aria-label={t('common.closeModal')}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
              <div className="overflow-y-auto flex-1 px-5 sm:px-6 py-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5 items-start">
                  {/* IZQUIERDA: la cuenta */}
                  <div className="space-y-4">
                    <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--glass-border)]">
                      {t('users.accountAndSecurity')}
                    </h3>

                    <div className="space-y-1.5">
                      <label htmlFor="usuario-nombre" className="text-xs font-medium text-[var(--text-secondary)]">
                        {t('users.username')}
                      </label>
                      <input
                        id="usuario-nombre"
                        type="text"
                        required
                        suppressHydrationWarning
                        value={editForm.username}
                        onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                        placeholder={t('users.usernamePlaceholder')}
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="usuario-correo" className="text-xs font-medium text-[var(--text-secondary)]">
                        {t('auth.emailLabel')}
                      </label>
                      <input
                        id="usuario-correo"
                        type="email"
                        required
                        suppressHydrationWarning
                        value={editForm.email}
                        onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                        placeholder={t('auth.emailPlaceholder')}
                        className="glass-input text-xs"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-[var(--text-secondary)]">
                        {t('users.accountRole')}
                      </label>
                      <CustomSelect
                        value={editForm.role}
                        onChange={(val) => setEditForm({ ...editForm, role: val })}
                        accentColor="cinnabar"
                        options={[
                          { value: 'USER', label: t('users.roleStandardUser'), badge: 'USER' },
                          { value: 'ADMIN', label: t('users.roleAdmin'), badge: 'ADMIN' },
                        ]}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label htmlFor="usuario-clave" className="text-xs font-medium text-[var(--text-secondary)]">
                        {t('users.newPasswordOptional')}
                      </label>
                      <input
                        id="usuario-clave"
                        type="password"
                        suppressHydrationWarning
                        placeholder={t('users.leaveBlankToKeep')}
                        value={editForm.newPassword}
                        onChange={(e) => setEditForm({ ...editForm, newPassword: e.target.value })}
                        className="glass-input text-xs"
                      />
                    </div>
                  </div>

                  {/* DERECHA: acceso y permisos, con el mismo interruptor que el resto de la web. */}
                  <div className="space-y-4">
                    <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--glass-border)]">
                      {t('users.accessAnd2fa')}
                    </h3>

                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
                      <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                        <div className="min-w-0">
                          <div className="text-xs font-bold text-[var(--text-primary)]">
                            {t('users.blockAccessSuspend')}
                          </div>
                          <div className="text-[11px] text-[var(--text-muted)]">
                            {t('users.blockLoginAndSync')}
                          </div>
                        </div>
                        <Switch
                          checked={editForm.isSuspended}
                          onChange={(v) => setEditForm({ ...editForm, isSuspended: v })}
                          ariaLabel={t('users.blockAccessSuspend')}
                        />
                      </div>

                      {editingUser.twoFactorEnabled && (
                        <div className="flex items-center justify-between gap-3 px-3.5 py-3">
                          <div className="min-w-0">
                            <div className="text-xs font-bold text-[var(--text-primary)]">
                              {t('users.reset2fa')}
                            </div>
                            <div className="text-[11px] text-[var(--text-muted)]">
                              {t('users.reset2faDesc')}
                            </div>
                          </div>
                          <Switch
                            checked={editForm.reset2Fa}
                            onChange={(v) => setEditForm({ ...editForm, reset2Fa: v })}
                            ariaLabel={t('users.reset2faShort')}
                          />
                        </div>
                      )}
                    </div>

                    <h3 className="text-[10.5px] font-mono uppercase tracking-wider text-[var(--text-muted)] pb-2 border-b border-[var(--glass-border)]">
                      {t('users.featurePermissions')}
                    </h3>

                    <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] divide-y divide-[var(--border-subtle)]">
                      {PERMISOS_USUARIO.map(({ campo, clave }) => (
                        <div key={campo} className="flex items-center justify-between gap-3 px-3.5 py-2">
                          <span className="text-xs text-[var(--text-secondary)] min-w-0 truncate">
                            {t(clave)}
                          </span>
                          <Switch
                            checked={editForm[campo]}
                            onChange={(v) => setEditForm({ ...editForm, [campo]: v })}
                            ariaLabel={t(clave)}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-[var(--glass-border)] shrink-0">
                <button type="button" onClick={() => setEditingUser(null)} className="btn-secondary">
                  {t('common.cancel')}
                </button>
                <button type="submit" disabled={isSaving} className="btn-primary disabled:opacity-50">
                  {isSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
                  ) : (
                    <Save className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                  <span>{isSaving ? t('users.saving') : t('users.saveChanges')}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
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
