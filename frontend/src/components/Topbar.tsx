'use client';

import React, { useState, useEffect, useRef } from 'react';
import { ThemeToggle } from './ThemeToggle';
import { LanguageToggle } from './LanguageToggle';
import { BookOpen, Radio, Menu, Bell, Check, Trash2, ExternalLink, AlertTriangle, Info, UserPlus, CheckCheck, Loader2, TreePine, Sparkles, Ghost, Flame, Heart } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSidebar } from '@/components/SidebarProvider';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';
import { useActiveThemeEffect } from '@/lib/useActiveThemeEffect';
import { useI18n } from '@/i18n/I18nProvider';
import { useToast } from '@/components/ToastProvider';
import { api } from '@/lib/api';

interface TopbarProps {
  rootLabel?: string;
  currentLabel?: string;
  isAdmin?: boolean;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function Topbar({
  rootLabel,
  currentLabel,
  isAdmin = false,
}: TopbarProps) {
  const router = useRouter();
  const { t } = useI18n();
  const { showUndoToast } = useToast();
  // Los valores por defecto no pueden salir de t(): se evaluan en el ambito de
  // parametros, antes de que el hook exista.
  const rootTexto = rootLabel ?? t('topbar.rootConfig');
  const currentTexto = currentLabel ?? t('topbar.connectionsHub');
  const themeEffect = useActiveThemeEffect();
  const { toggleMobile } = useSidebar();
  const { confirmNavigation } = useUnsavedChanges();

  // Estado de Notificaciones
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 20000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchUnreadCount = async () => {
    try {
      const res = await api.notifications.getUnreadCount();
      setUnreadCount(res.unreadCount || 0);
    } catch {
      // Ignore if not logged in
    }
  };

  const handleOpenDropdown = async () => {
    const nextState = !isOpen;
    setIsOpen(nextState);
    if (nextState) {
      try {
        setLoading(true);
        const res = await api.notifications.get(20);
        setNotifications(res.notifications || []);
        setUnreadCount(res.unreadCount || 0);
      } catch (e) {
        console.warn('Error al cargar notificaciones:', e);
      } finally {
        setLoading(false);
      }
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    try {
      await api.notifications.markAsRead(id);
      setNotifications((prev: any[]) =>
        prev.map((n: any) => (n.id === id ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev: number) => Math.max(0, prev - 1));
    } catch (err) {
      console.warn('Error al marcar notificación como leída:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      setMarkingAll(true);
      await api.notifications.markAllAsRead();
      setNotifications((prev: any[]) => prev.map((n: any) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.warn('Error al marcar todas las notificaciones:', err);
    } finally {
      setMarkingAll(false);
    }
  };

  const handleDeleteNotification = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const aviso = notifications.find((n: any) => n.id === id);
    setNotifications((prev: any[]) => prev.filter((n: any) => n.id !== id));
    if (aviso && !aviso.isRead) setUnreadCount((prev: number) => Math.max(0, prev - 1));
    showUndoToast(t('common.deletingItem', { name: aviso?.title || t('topbar.notification') }), {
      alDeshacer: () => {
        if (!aviso) return;
        setNotifications((prev: any[]) => [aviso, ...prev]);
        if (!aviso.isRead) setUnreadCount((prev: number) => prev + 1);
      },
      alExpirar: async () => {
        try {
          await api.notifications.delete(id);
        } catch (err) {
          console.warn('Error al eliminar notificación:', err);
        }
      },
    });
  };

  const handleNavigateToMapping = (n: any) => {
    const meta = n.metadata || {};
    const search = meta.showTitle || '';
    const season = meta.seasonNumber || 1;
    setIsOpen(false);
    handleMarkAsRead(n.id);
    router.push(`/mappings?search=${encodeURIComponent(search)}&season=${season}`);
  };

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    const allowed = confirmNavigation(href, () => {
      router.push(href);
    });
    if (!allowed) {
      e.preventDefault();
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    try {
      const diff = Date.now() - new Date(dateStr).getTime();
      const mins = Math.floor(diff / 60000);
      if (mins < 1) return t('topbar.momentAgo');
      if (mins < 60) return t('topbar.minutesAgo', { mins });
      const hours = Math.floor(mins / 60);
      if (hours < 24) return t('topbar.hoursAgo', { hours });
      const days = Math.floor(hours / 24);
      return t('topbar.daysAgo', { days });
    } catch {
      return '';
    }
  };

  return (
    <header className="h-16 border-b border-[var(--glass-border)] px-5 sm:px-8 flex items-center justify-between sticky top-0 z-30 transition-colors backdrop-blur-xl bg-[var(--glass-bg)] shadow-[0_4px_20px_rgba(0,0,0,0.04)]">
      {/* Left: Mobile Toggle & Breadcrumbs */}
      <div className="flex items-center gap-3.5 min-w-0">
        {/* Mobile Hamburger Button */}
        <button
          onClick={toggleMobile}
          className="md:hidden p-2 rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors focus:outline-none shrink-0 cursor-pointer"
          title={t('topbar.openMenu')}
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumbs */}
        <div className="flex items-center gap-2.5 text-xs sm:text-sm truncate">
          {isAdmin ? (
            <span className="px-2.5 py-1 rounded-[6px] text-[10px] font-mono font-bold tracking-wider bg-rose-500/10 text-rose-400 border border-rose-500/20 shrink-0">
              ADMIN
            </span>
          ) : (
            <span className="text-[var(--text-muted)] hidden sm:inline truncate font-medium">{rootTexto}</span>
          )}
          <span className="text-[var(--text-muted)] opacity-50 hidden sm:inline">/</span>
          <span className="font-semibold text-[var(--text-primary)] truncate tracking-tight font-heading">{currentTexto}</span>
        </div>
      </div>

      {/* Right: Top Actions */}
      <div className="flex items-center gap-2.5 shrink-0">
        <Link
          href="/connections"
          onClick={(e) => handleLinkClick('/connections', e)}
          className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-[6px] text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-sm cursor-pointer"
        >
          <span className="w-2 h-2 rounded-full bg-[var(--accent-primary)]" />
          <Radio className="w-3.5 h-3.5 text-[var(--accent-text)]" />
          <span>{t('topbar.connectionStatus')}</span>
        </Link>

        <Link
          href="/docs"
          onClick={(e) => handleLinkClick('/docs', e)}
          className="hidden md:flex items-center gap-2 px-3.5 py-2 rounded-[6px] text-xs font-medium border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-sm cursor-pointer"
          title={t('topbar.documentation')}
        >
          <BookOpen className="w-3.5 h-3.5 text-[var(--brand-anilist)]" />
          <span className="hidden sm:inline">{t('topbar.documentation')}</span>
        </Link>

        {/* NOTIFICACIONES BELL DROPDOWN */}
        <div className="relative" ref={popoverRef}>
          <button
            onClick={handleOpenDropdown}
            className={`relative p-2 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] backdrop-blur-md hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)] text-[var(--text-primary)] transition-all duration-180 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] shadow-sm cursor-pointer ${
              isOpen ? 'border-[var(--accent-primary)] bg-[var(--bg-surface-hover)]' : ''
            }`}
            title={t('topbar.notificationCentre')}
            aria-label={t('topbar.notifications')}
          >
            <Bell className={`w-4 h-4 ${themeEffect.isChristmas ? 'text-amber-300' : 'text-amber-400'}`} />
            {unreadCount > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-500 text-white font-mono font-bold text-[10px] flex items-center justify-center shadow-md animate-pulse">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* POPOVER PANEL */}
          {isOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-[8px] border border-[var(--border-strong)] bg-[var(--popover-solid-bg)] text-[var(--text-primary)] shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              {/* Header */}
              <div className="px-4 py-3 border-b border-[var(--border-subtle)] flex items-center justify-between bg-[var(--popover-solid-header)]">
                <div className="flex items-center gap-2">
                  <Bell className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-bold text-[var(--text-primary)] font-heading">
                    {t('topbar.notifications')}
                  </span>
                  {unreadCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-[4px] bg-rose-500/20 text-rose-500 font-mono text-[10px] font-bold">
                      {unreadCount}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      onClick={handleMarkAllAsRead}
                      disabled={markingAll}
                      className="text-[11px] px-2 py-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      title={t('topbar.markAllReadLong')}
                    >
                      <CheckCheck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>{t('topbar.markAllRead')}</span>
                    </button>
                  )}
                  <Link
                    href="/settings/notifications"
                    onClick={() => setIsOpen(false)}
                    className="text-[11px] px-2 py-1 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface)] transition-colors"
                  >
                    {t('topbar.settings')}
                  </Link>
                </div>
              </div>

              {/* Lista de Notificaciones */}
              <div className="max-h-[380px] overflow-y-auto divide-y divide-[var(--border-subtle)]">
                {loading ? (
                  <div className="py-8 flex flex-col items-center justify-center gap-2 text-xs text-[var(--text-muted)]">
                    <Loader2 className="w-5 h-5 animate-spin text-[var(--color-brand-primary)]" />
                    <span>{t('topbar.loadingNotifications')}</span>
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="py-10 text-center text-xs text-[var(--text-muted)] space-y-1">
                    <Bell className="w-6 h-6 mx-auto opacity-30 text-amber-400" />
                    <p className="font-medium text-[var(--text-secondary)]">{t('topbar.inboxClear')}</p>
                    <p className="text-[10.5px]">{t('topbar.noPendingNotifications')}</p>
                  </div>
                ) : (
                  notifications.map((n) => {
                    /*
                     * El backend las crea con type 'UNMAPPED_ANIME' y aqui se
                     * comparaba con 'UNMAPPED_ITEM'. Nunca coincidia, asi que el
                     * boton para ir al mapeo no se pintaba jamas y pulsar la
                     * notificacion solo la marcaba como leida: no llevaba a
                     * ningun lado. Y el propio texto dice "Haz clic para crear el
                     * mapeo".
                     */
                    const isUnmapped =
                      n.type === 'UNMAPPED_ANIME' || n.type === 'UNMAPPED_ITEM';
                    // Si lleva a algun sitio, la notificacion entera lleva; un
                    // enlace de 90 px dentro de una tarjeta pulsable no se ve.
                    const esNuevoUsuario = n.type === 'NEW_USER';
                    const puedeNavegar = (isUnmapped && !!n.metadata?.showTitle) || esNuevoUsuario;
                    const navegar = () => {
                      if (esNuevoUsuario) {
                        setIsOpen(false);
                        handleMarkAsRead(n.id);
                        router.push(`/users?search=${encodeURIComponent(n.metadata?.username || '')}`);
                      } else {
                        handleNavigateToMapping(n);
                      }
                    };
                    return (
                      <div
                        key={n.id}
                        role={puedeNavegar ? 'button' : undefined}
                        tabIndex={puedeNavegar ? 0 : undefined}
                        onKeyDown={(e) => {
                          if (puedeNavegar && (e.key === 'Enter' || e.key === ' ')) {
                            e.preventDefault();
                            navegar();
                          }
                        }}
                        onClick={() => (puedeNavegar ? navegar() : handleMarkAsRead(n.id))}
                        className={`p-3.5 text-xs transition-colors hover:bg-[var(--popover-solid-hover)] cursor-pointer flex flex-col gap-1.5 ${
                          !n.isRead ? 'bg-[var(--color-brand-primary)]/5 font-medium' : 'opacity-85'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            {isUnmapped ? (
                              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
                            ) : esNuevoUsuario ? (
                              <UserPlus className="w-4 h-4 text-emerald-400 shrink-0" />
                            ) : (
                              <Info className="w-4 h-4 text-blue-400 shrink-0" />
                            )}
                            <span className="font-bold text-[var(--text-primary)] truncate font-heading">
                              {n.title}
                            </span>
                          </div>

                          <span className="text-[10px] text-[var(--text-muted)] shrink-0 font-mono">
                            {formatRelativeTime(n.createdAt)}
                          </span>
                        </div>

                        <p className="text-[11.5px] text-[var(--text-secondary)] leading-relaxed line-clamp-2">
                          {n.message}
                        </p>

                        {puedeNavegar && (
                          <div className="pt-1 flex items-center gap-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNavigateToMapping(n);
                              }}
                              className="px-2.5 py-1.5 rounded-[6px] text-xs font-semibold bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/40 flex items-center gap-1.5 transition-all shadow-sm cursor-pointer"
                            >
                              <ExternalLink className="w-3 h-3" />
                              <span>{t('topbar.mapAnimeNow')}</span>
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* En movil bajan al cajon lateral: aqui eran dos de los cuatro
            botones que apretaban el titulo de la pagina contra el borde. */}
        <div className="hidden md:flex items-center gap-2.5">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
