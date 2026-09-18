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
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CustomSelect } from '@/components/CustomSelect';
import { BottomSheet } from '@/components/BottomSheet';
import { useModalA11y } from '@/components/useModalA11y';
import { ConfirmModal } from '@/components/ConfirmModal';
import { Switch } from '@/components/Switch';

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
  const [filterType, setFilterType] = useState<'ALL' | 'ADMIN' | 'ACTIVE' | 'SUSPENDED' | 'NEW'>('ALL');
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
    if (filterType === 'ADMIN') return matchesSearch && u.role === 'ADMIN';
    if (filterType === 'ACTIVE') return matchesSearch && !isSuspended;
    if (filterType === 'SUSPENDED') return matchesSearch && isSuspended;
    if (filterType === 'NEW') return matchesSearch && esReciente(u.createdAt);
    return matchesSearch;
  });

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

          {/* Buscar primero y filtrar despues, que es el orden en que se
              usan; y los filtros en una tira que se desplaza en vez de
              partirse en dos lineas. */}
          <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 pt-1 border-t border-[var(--glass-border)]">
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap">
              <button
                onClick={() => setFilterType('ALL')}
                className={`shrink-0 ${filterType === 'ALL' ? 'filter-tab-active' : 'filter-tab'}`}
              >
                {t('users.filterAll')} ({totalUsersCount})
              </button>
              <button
                onClick={() => setFilterType('ACTIVE')}
                className={`shrink-0 ${filterType === 'ACTIVE' ? 'filter-tab-active text-emerald-400 border-emerald-500/30' : 'filter-tab'}`}
              >
                {t('users.filterActive')} ({activeUsersCount})
              </button>
              <button
                onClick={() => setFilterType('SUSPENDED')}
                className={`shrink-0 ${filterType === 'SUSPENDED' ? 'filter-tab-active text-rose-400 border-rose-500/30' : 'filter-tab'}`}
              >
                {t('users.filterSuspended')} ({suspendedUsersCount})
              </button>
              <button
                onClick={() => setFilterType('NEW')}
                className={`shrink-0 ${filterType === 'NEW' ? 'filter-tab-active text-sky-400 border-sky-500/30' : 'filter-tab'}`}
              >
                {t('users.filterNew')} ({newUsersCount})
              </button>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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
        <div className="hidden lg:block glass-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] text-[var(--text-secondary)] font-mono uppercase text-[10.5px]">
                <tr>
                  <th scope="col" className="py-3.5 px-4">Usuario &amp; Cuenta</th>
                  <th scope="col" className="py-3.5 px-4">Rol &amp; Estado</th>
                  <th scope="col" className="py-3.5 px-4">Servidores</th>
                  <th scope="col" className="py-3.5 px-4">Trackers</th>
                  <th scope="col" className="py-3.5 px-4 text-center">Permisos</th>
                  <th scope="col" className="py-3.5 px-4 text-right">{t('users.adminActions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--glass-border)]">
                {loading ? (
                  [...Array(4)].map((_, i) => (
                    <tr key={i} className="animate-in fade-in">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="skeleton w-9 h-9 rounded-[6px] shrink-0" />
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="skeleton h-3.5 w-28 rounded" />
                            <div className="skeleton h-2.5 w-36 rounded" />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4"><div className="skeleton h-6 w-24 rounded-[6px]" /></td>
                      <td className="py-4 px-4"><div className="skeleton h-6 w-20 rounded-[6px]" /></td>
                      <td className="py-4 px-4"><div className="skeleton h-6 w-24 rounded-[6px]" /></td>
                      <td className="py-4 px-4 text-center"><div className="skeleton h-6 w-24 mx-auto rounded-[6px]" /></td>
                      <td className="py-4 px-4 text-right"><div className="skeleton h-7 w-24 ml-auto rounded-[6px]" /></td>
                    </tr>
                  ))
                ) : filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-[var(--text-muted)] font-mono">{t('users.noUsersFound')}</td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const isSuspended = u.permissions?.isSuspended;
                    const avatarSrc = getAvatarSrc(u.avatarUrl);

                    // Conteo unificado de permisos
                    let activePermCount = 0;
                    if (u.permissions?.canScrobble ?? true) activePermCount++;
                    if (u.permissions?.canAccessCatalog ?? true) activePermCount++;
                    if (u.permissions?.canEditMappings ?? true) activePermCount++;
                    if (u.permissions?.canSyncAnilist ?? true) activePermCount++;
                    if (u.permissions?.canSyncMal ?? true) activePermCount++;
                    if (u.permissions?.canSyncKitsu ?? true) activePermCount++;

                    return (
                      <tr key={u.id} className="hover:bg-[var(--bg-surface-hover)] transition-colors">
                        {/* 1. USUARIO & CUENTA */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            {avatarSrc ? (
                              <img
                                src={avatarSrc}
                                alt={u.username}
                                className="w-9 h-9 rounded-[6px] object-cover border border-[var(--border-subtle)] shrink-0 shadow-sm bg-[var(--bg-app)]"
                              />
                            ) : (
                              <div className="w-9 h-9 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] flex items-center justify-center font-bold text-xs shrink-0 border border-[var(--nav-active-border)] shadow-sm">
                                {u.username?.[0]?.toUpperCase() || 'U'}
                              </div>
                            )}

                            <div className="min-w-0">
                              <div className="font-bold text-[var(--text-primary)] truncate flex items-center gap-1.5 leading-snug">
                                <span>{u.username}</span>
                                {u.role === 'ADMIN' && (
                                  <span title="Administrador" className="inline-flex items-center justify-center shrink-0 -translate-y-[1px]">
                                    <Crown className="w-3.5 h-3.5 text-amber-400 fill-amber-400" />
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--text-muted)] truncate font-mono">{u.email}</div>
                              <div className="text-[10.5px] text-[var(--text-muted)] font-mono">
                                {t('users.joinedOn', { fecha: fechaAlta(u.createdAt) })}
                                {esReciente(u.createdAt) && <span className="ml-1.5 text-sky-400">{t('users.newBadge')}</span>}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* 2. ROL & ESTADO */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => handleToggleRole(u.id, u.role)}
                              className={`px-2 py-0.5 rounded-[4px] text-[10.5px] font-mono font-bold cursor-pointer border transition-colors ${
                                u.role === 'ADMIN'
                                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30'
                                  : 'badge-pill hover:border-[var(--border-strong)]'
                              }`}
                              title={t('users.toggleAdminUser')}
                            >
                              {u.role}
                            </button>
                            <span
                              className={isSuspended ? 'badge-status-danger' : 'badge-status-success'}
                            >
                              {isSuspended ? 'BLOQUEADO' : 'ACTIVO'}
                            </span>
                            {u.twoFactorEnabled && (
                              <span className="badge-status-success text-[10px] font-mono" title="2FA Activo">
                                2FA
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 3. SERVIDORES MULTIMEDIA (SEPARADO) */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span
                              className={`h-6 px-2.5 rounded-[4px] inline-flex items-center justify-center font-bold transition-all ${
                                u.connections?.plex
                                  ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-xs'
                                  : 'text-[var(--text-muted)] opacity-35 border border-dashed border-[var(--border-subtle)]'
                              }`}
                              title={u.connections?.plex ? `Plex: ${u.connections.plexServer || 'Conectado'}` : 'Plex: No vinculado'}
                            >
                              PLEX
                            </span>
                            <span
                              className={`h-6 px-2.5 rounded-[4px] inline-flex items-center justify-center font-bold transition-all ${
                                u.connections?.jellyfin
                                  ? 'bg-[#00a4dc]/15 text-[#00a4dc] border border-[#00a4dc]/30 shadow-xs'
                                  : 'text-[var(--text-muted)] opacity-35 border border-dashed border-[var(--border-subtle)]'
                              }`}
                              title={u.connections?.jellyfin ? `Jellyfin: ${u.connections.jellyfinServer || 'Conectado'}` : 'Jellyfin: No vinculado'}
                            >
                              JF
                            </span>
                            <span
                              className={`h-6 px-2.5 rounded-[4px] inline-flex items-center justify-center font-bold transition-all ${
                                u.connections?.emby
                                  ? 'bg-[#52b54b]/15 text-[#52b54b] border border-[#52b54b]/30 shadow-xs'
                                  : 'text-[var(--text-muted)] opacity-35 border border-dashed border-[var(--border-subtle)]'
                              }`}
                              title={u.connections?.emby ? `Emby: ${u.connections.embyServer || 'Conectado'}` : 'Emby: No vinculado'}
                            >
                              EM
                            </span>
                          </div>
                        </td>

                        {/* 4. TRACKERS DE ANIME (SEPARADO) */}
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-1.5 font-mono text-[11px]">
                            <span
                              className={`h-6 px-2 rounded-[4px] inline-flex items-center justify-center font-bold transition-all ${
                                u.connections?.anilist
                                  ? 'bg-sky-500/15 text-sky-400 border border-sky-500/30 shadow-xs'
                                  : 'text-[var(--text-muted)] opacity-35 border border-dashed border-[var(--border-subtle)]'
                              }`}
                              title={u.connections?.anilist ? `AniList: ${u.connections.anilistUser || 'Conectado'}` : 'AniList: No vinculado'}
                            >
                              AL
                            </span>
                            <span
                              className={`h-6 px-2 rounded-[4px] inline-flex items-center justify-center font-bold transition-all ${
                                u.connections?.mal
                                  ? 'bg-purple-500/15 text-purple-400 border border-purple-500/30 shadow-xs'
                                  : 'text-[var(--text-muted)] opacity-35 border border-dashed border-[var(--border-subtle)]'
                              }`}
                              title={u.connections?.mal ? `MyAnimeList: ${u.connections.malUser || 'Conectado'}` : 'MyAnimeList: No vinculado'}
                            >
                              MAL
                            </span>
                            <span
                              className={`h-6 px-2 rounded-[4px] inline-flex items-center justify-center font-bold transition-all ${
                                u.connections?.kitsu
                                  ? 'bg-[#fd755c]/15 text-[#fd755c] border border-[#fd755c]/30 shadow-xs'
                                  : 'text-[var(--text-muted)] opacity-35 border border-dashed border-[var(--border-subtle)]'
                              }`}
                              title={u.connections?.kitsu ? `Kitsu: ${u.connections.kitsuUser || 'Conectado'}` : 'Kitsu: No vinculado'}
                            >
                              KT
                            </span>
                          </div>
                        </td>

                        {/* 5. PERMISOS UNIFICADOS */}
                        <td className="py-4 px-4 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(u)}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-sm,4px)] text-[11px] font-mono font-medium cursor-pointer transition-all hover:scale-105 select-none ${
                              activePermCount === 6
                                ? 'bg-emerald-500/12 text-emerald-400 border border-emerald-500/30'
                                : 'bg-amber-500/12 text-amber-300 border border-amber-500/30'
                            }`}
                            title={`${activePermCount} de 6 permisos habilitados. Haz clic para configurar permisos detallados.`}
                          >
                            <Sliders className="w-3 h-3 shrink-0" />
                            <span>{activePermCount}/6 Activos</span>
                          </button>
                        </td>

                        {/* 6. ACCIONES */}
                        <td className="py-4 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => handleOpenEdit(u)}
                              className="btn-secondary btn-icon-sm"
                              title={t('users.editUserAndCredentials')}
                            >
                              <Edit3 className="w-4 h-4 text-[var(--accent-text)]" />
                            </button>

                            <button
                              onClick={() => handleToggleBlock(u.id, isSuspended, u.username)}
                              className={isSuspended ? 'btn-danger btn-icon-sm' : 'btn-secondary btn-icon-sm'}
                              title={isSuspended ? t('users.unblockAndReactivate') : t('users.blockAccountAccess')}
                            >
                              {isSuspended ? <Lock className="w-4 h-4 text-rose-400" /> : <Unlock className="w-4 h-4 text-[var(--text-secondary)]" />}
                            </button>

                            <button
                              onClick={() => setDeletingUser(u)}
                              className="btn-danger btn-icon-sm"
                              title={t('users.deleteUserPermanently')}
                            >
                              <Trash2 className="w-4 h-4 text-rose-400" />
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
        <div className="block lg:hidden space-y-2.5">
          {loading ? (
            <div className="p-8 text-center text-[var(--text-muted)] font-mono text-xs glass-card">{t('users.loadingUsers')}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-[var(--text-muted)] font-mono text-xs glass-card">{t('users.noUsersFound')}</div>
          ) : (
            filteredUsers.map((u) => {
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
                  className={`glass-card p-3.5 space-y-2.5 border ${
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
                                {t('users.joinedOn', { fecha: fechaAlta(u.createdAt) })}
                                {esReciente(u.createdAt) && <span className="ml-1.5 text-sky-400">{t('users.newBadge')}</span>}
                              </div>
                    </div>

                    <button
                      onClick={() => setActiveUserMenuId(u.id)}
                      className="p-2 rounded-[var(--radius-sm)] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors shrink-0 cursor-pointer"
                      title={t('users.userOptions')}
                      aria-label={t('users.openOptionsMenu')}
                    >
                      <MoreVertical className="w-4 h-4" aria-hidden="true" />
                    </button>
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
                      onClick={() => handleOpenEdit(u)}
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
                  label: `Cambiar a rol ${selectedUser.role === 'ADMIN' ? 'USER' : 'ADMIN'}`,
                  sublabel:
                    selectedUser.role === 'ADMIN'
                      ? t('users.revokeAdmin')
                      : t('users.grantFullPermissions'),
                  icon: Shield,
                  iconColor: 'text-purple-400',
                  onClick: () => handleToggleRole(selectedUser.id, selectedUser.role),
                },
                {
                  label: isSuspended ? t('users.unblockAccount') : t('users.blockAccess'),
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
