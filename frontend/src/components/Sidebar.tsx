'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api, getApiBase } from '@/lib/api';
import { useSidebar } from '@/components/SidebarProvider';
import { useUnsavedChanges } from '@/components/UnsavedChangesProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { LanguageToggle } from './LanguageToggle';
import { ThemeToggle } from './ThemeToggle';
import {
  LayoutGrid,
  History,
  GitMerge,
  ShieldBan,
  Sliders,
  Radio,
  BarChart3,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Shield,
  Bell,
  Server,
  MapPin,
  Activity,
  HardDrive,
  Image as ImageIcon,
  BookOpen,
  Megaphone,
  KeyRound,
  Globe,
  LifeBuoy,
  AlertTriangle,
  Link2 as LinkIcon,
} from 'lucide-react';
import { useModalA11y } from './useModalA11y';


interface SidebarProps {
  userToken?: string;
  username?: string;
  role?: 'ADMIN' | 'USER';
}

export function Sidebar({
  userToken: propToken,
  username: propUsername,
  role: propRole,
}: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const { isCollapsed, isLocked, toggleCollapsed, isMobileOpen, closeMobile } = useSidebar();

  // El cajón móvil se comporta como diálogo: foco dentro y devuelto al cerrar.
  const { dialogProps: dialogPropsCajon } = useModalA11y<HTMLElement>(isMobileOpen, closeMobile);
  const { confirmNavigation } = useUnsavedChanges();
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [avatarError, setAvatarError] = useState(false);
  const [reconnectionCount, setReconnectionCount] = useState(0);

  const checkReconnections = () => {
    api.connections
      .getHub()
      .then((data: any) => {
        if (typeof data?.reconnectionRequiredCount === 'number') {
          setReconnectionCount(data.reconnectionRequiredCount);
        }
      })
      .catch(() => {});
  };

  const handleLogout = async () => {
    const proceed = async () => {
      try {
        await api.auth.logout();
      } finally {
        router.push('/login');
      }
    };
    confirmNavigation('/login', proceed);
  };

  const handleNavClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (pathname === href) {
      closeMobile();
      return;
    }
    const allowed = confirmNavigation(href, () => {
      closeMobile();
      router.push(href);
    });
    if (!allowed) {
      e.preventDefault();
    } else {
      closeMobile();
    }
  };

  useEffect(() => {
    // Escuchar cambios de perfil y estado de conexiones
    api.auth
      .me()
      .then((res: any) => {
        if (res?.user) setCurrentUser(res.user);
        else if (res?.id) setCurrentUser(res);
      })
      .catch(() => {});

    checkReconnections();

    const handleConnUpdate = () => checkReconnections();
    window.addEventListener('plexsync:connections-updated', handleConnUpdate);
    return () => {
      window.removeEventListener('plexsync:connections-updated', handleConnUpdate);
    };
  }, [pathname]);

  const effectiveRole = currentUser?.role || propRole || 'USER';
  const effectiveUsername = currentUser?.username || propUsername || 'Usuario';
  const effectiveToken = currentUser?.userToken || propToken || 'usr_live_xxxx';
  const effectiveAvatar = currentUser?.avatarUrl;

  const getAvatarSrc = (url?: string | null) => {
    if (!url || avatarError) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return url;
    return `/api/auth/avatar/${url}`;
  };

  const baseNavItems = [
    {
      section: t('navigation.userLibrary'),
      items: [
        { label: t('navigation.syncedCatalog'), href: '/catalog', icon: LayoutGrid },
        { label: t('navigation.scrobbleHistory'), href: '/history', icon: History },
        { label: t('navigation.titleMapping'), href: '/mappings', icon: GitMerge },
        { label: t('navigation.blacklist'), href: '/blacklist', icon: ShieldBan },
      ],
    },
    {
      section: t('navigation.preferences'),
      items: [
        { label: t('navigation.profileAvatar'), href: '/settings', icon: User },
        { label: t('navigation.security2fa'), href: '/settings/security', icon: Shield },
        { label: t('navigation.connectionHub'), href: '/connections', icon: Radio },
        { label: t('navigation.notifications'), href: '/settings/notifications', icon: Bell },
        { label: t('navigation.scrobblerRules'), href: '/settings/rules', icon: Sliders },
        { label: t('navigation.supportTickets'), href: '/tickets', icon: LifeBuoy },
        { label: t('navigation.guideHelp'), href: '/docs', icon: BookOpen },
      ],
    },
  ];

  const navItems =
    effectiveRole === 'ADMIN'
      ? [
          ...baseNavItems,
          {
            section: t('navigation.systemAdmin'),
            items: [
              { label: t('navigation.metricsCharts'), href: '/admin', icon: BarChart3 },
              { label: t('navigation.servicesNodes'), href: '/admin/services', icon: Server },
              { label: t('navigation.failedScrobbles'), href: '/admin/failed-scrobbles', icon: AlertTriangle },
              { label: t('navigation.geolocationIps'), href: '/admin/geo', icon: MapPin },
              { label: t('navigation.healthLogs'), href: '/admin/logs', icon: Activity },
              { label: t('navigation.backups'), href: '/admin/backups', icon: HardDrive },
              { label: t('navigation.mediaManagement'), href: '/admin/media', icon: ImageIcon },
              { label: t('navigation.alertsAnnouncements'), href: '/admin/announcements', icon: Megaphone },
              { label: t('navigation.siteLinks'), href: '/admin/links', icon: LinkIcon },
              { label: t('navigation.siteSettings'), href: '/admin/site', icon: Globe },
              { label: t('navigation.systemCredentials'), href: '/admin/credentials', icon: KeyRound },
              { label: t('navigation.ticketManagement'), href: '/admin/tickets', icon: LifeBuoy },
              { label: t('navigation.userManagement'), href: '/users', icon: Users },
              { label: t('navigation.globalMappings'), href: '/admin/mappings', icon: GitMerge },
            ],
          },
        ]
      : baseNavItems;

  const renderSidebarContent = (collapsed: boolean) => (
    <div className="flex flex-col h-full bg-[var(--glass-bg)] backdrop-blur-xl text-[var(--text-primary)] select-none relative overflow-hidden transition-colors">
      {/* Header */}
      <div className="h-16 flex items-center px-4 border-b border-[var(--glass-border)] shrink-0 overflow-hidden">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="w-9 h-9 rounded-[6px] overflow-hidden flex items-center justify-center shrink-0 transition-all duration-300 hover:scale-105"
            title="SyncSekai"
          >
            <img
              src="/logo.webp"
              alt="SyncSekai Logo"
              width={36}
              height={36}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/logo.jpeg';
              }}
            />
          </Link>

          <div
            className={`flex flex-col min-w-0 whitespace-nowrap overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
              collapsed
                ? 'opacity-0 max-w-0 -translate-x-3 pointer-events-none'
                : 'opacity-100 max-w-xs translate-x-0 delay-75'
            }`}
          >
            <span className="font-bold text-base tracking-tight leading-none text-[var(--text-primary)] font-heading truncate">
              SyncSekai
            </span>
            <span className="text-xs font-mono mt-0.5 text-[var(--text-muted)] truncate">
              {effectiveRole === 'ADMIN' ? t('navigation.adminCenter') : t('navigation.animeScrobbler')}
            </span>
          </div>
        </div>

        {/* Close Button (Mobile) */}
        <button
          onClick={closeMobile}
          className="md:hidden ml-auto p-1.5 rounded-[6px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Nav List: Separación vertical limpia y animaciones suaves */}
      <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-7 scrollbar-none relative">
        {navItems.map((group, idx) => (
          <div key={idx} className="space-y-2">
            {/* Título de Sección */}
            <div
              className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] overflow-hidden whitespace-nowrap ${
                collapsed
                  ? 'h-0 opacity-0 -translate-x-2 my-0 pointer-events-none'
                  : 'h-5 opacity-100 translate-x-0 my-1'
              }`}
            >
              <span className="text-[10.5px] font-bold uppercase tracking-wider px-3.5 text-[var(--text-muted)] font-mono">
                {group.section}
              </span>
            </div>

            {/* Separador sutil visible solo cuando está colapsado */}
            <div
              className={`transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] h-px bg-[var(--glass-border)] ${
                collapsed ? 'my-3 mx-2 opacity-100' : 'my-0 opacity-0 h-0 pointer-events-none'
              }`}
            />

            {group.items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              const isHub = item.href === '/connections';
              const showBadge = isHub && reconnectionCount > 0;

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={(e) => handleNavClick(e, item.href)}
                  title={collapsed ? (showBadge ? `${item.label} (${reconnectionCount} pendientes)` : item.label) : undefined}
                  className={`flex items-center gap-3.5 px-3 py-2.5 rounded-[6px] transition-all duration-200 w-full overflow-hidden my-1 relative ${
                    isActive
                      ? 'bg-[var(--nav-active-bg)] border border-[var(--nav-active-border)] text-[var(--nav-active-text)] font-semibold shadow-sm'
                      : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                  }`}
                >
                  <div className="relative shrink-0 flex items-center justify-center">
                    <Icon
                      className={`w-5 h-5 transition-colors ${
                        isActive ? 'text-[var(--nav-active-text)]' : 'text-[var(--text-muted)]'
                      }`}
                    />
                    {/* Dot estilo Discord cuando la barra está colapsada */}
                    {showBadge && collapsed && (
                      <span className="absolute -top-1 -right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-[var(--bg-card)] shadow-[0_0_8px_rgba(244,63,94,0.9)] animate-pulse" />
                    )}
                  </div>
                  <span
                    className={`text-sm font-medium whitespace-nowrap overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] flex-1 flex items-center justify-between ${
                      collapsed
                        ? 'opacity-0 max-w-0 -translate-x-3 pointer-events-none'
                        : 'opacity-100 max-w-xs translate-x-0 delay-75'
                    }`}
                  >
                    <span>{item.label}</span>
                    {/* Pill con número animado estilo Discord cuando está expandida */}
                    {showBadge && !collapsed && (
                      <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1.5 text-[11px] font-extrabold text-white bg-rose-500 rounded-full shadow-[0_0_8px_rgba(244,63,94,0.8)] animate-pulse shrink-0 tracking-tight">
                        {reconnectionCount}
                      </span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Idioma y tema: solo en el cajon de movil.
          Arriba compartian barra con el menu, las notificaciones y la
          documentacion, y en 375 px eso son cuatro botones al lado del titulo
          de la pagina. Aqui no le quitan sitio a nada y siguen a un toque. */}
      <div className="md:hidden px-3.5 py-2.5 border-t border-[var(--glass-border)] shrink-0 flex items-center justify-between gap-2">
        <span className="text-[11px] font-mono uppercase tracking-wider text-[var(--text-muted)]">
          {t('navigation.appearanceLanguage')}
        </span>
        <div className="flex items-center gap-2 shrink-0">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Footer Profile */}
      <div className="h-16 px-3.5 border-t border-[var(--glass-border)] shrink-0 flex items-center justify-between bg-transparent overflow-hidden">
        {/* User Info (Avatar + Nombre): Oculto al colapsar */}
        <div
          className={`flex items-center gap-3 min-w-0 transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)] ${
            collapsed
              ? 'opacity-0 max-w-0 pointer-events-none -translate-x-3'
              : 'opacity-100 max-w-xs translate-x-0'
          }`}
        >
          {getAvatarSrc(effectiveAvatar) ? (
            <img
              src={getAvatarSrc(effectiveAvatar)!}
              alt={effectiveUsername}
              onError={() => setAvatarError(true)}
              className="w-9 h-9 rounded-[6px] object-cover border border-[var(--border-subtle)] shrink-0 shadow-sm bg-[var(--bg-surface)]"
              title={effectiveUsername}
            />
          ) : (
            <div
              className="w-9 h-9 rounded-[6px] flex items-center justify-center font-bold text-xs shrink-0 shadow-sm transition-all duration-300 bg-[var(--color-brand-primary)] text-white border border-[var(--border-subtle)]"
              title={effectiveUsername}
            >
              {effectiveUsername.slice(0, 2).toUpperCase()}
            </div>
          )}

          <div className="flex flex-col min-w-0 whitespace-nowrap overflow-hidden">
            <span className="text-sm font-semibold truncate leading-snug text-[var(--text-primary)]">
              {effectiveUsername}
            </span>
            <span className="text-xs font-mono truncate text-[var(--text-muted)]">
              {effectiveToken}
            </span>
          </div>
        </div>

        {/* Botón de Logout: Único elemento visible al colapsar */}
        <button
          type="button"
          onClick={handleLogout}
          title={t('navigation.logout')}
          className={`rounded-[6px] text-[var(--text-muted)] hover:text-rose-400 hover:bg-rose-500/10 transition-all duration-200 flex items-center justify-center shrink-0 cursor-pointer ${
            collapsed ? 'w-full h-11' : 'p-2.5'
          }`}
        >
          <LogOut className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <>
      {/* DESKTOP FIXED SIDEBAR */}
      <aside
        className={`hidden md:block fixed top-0 bottom-0 left-0 z-40 border-r border-[var(--glass-border)] transition-[width] duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
          isCollapsed ? 'w-[72px]' : 'w-[260px]'
        }`}
      >
        {/* Toggle Collapse Button Flotante sobre el borde derecho del sidebar */}
        {!isLocked && (
          <button
            onClick={toggleCollapsed}
            className="hidden md:flex absolute -right-3 top-5 z-50 w-6 h-6 rounded-[6px] bg-[var(--bg-surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] items-center justify-center shadow-lg transition-all focus:outline-none cursor-pointer hover:scale-105 active:scale-95"
            title={isCollapsed ? 'Expandir barra lateral' : t('navigation.collapseSidebar')}
          >
            {isCollapsed ? (
              <ChevronRight className="w-3.5 h-3.5" />
            ) : (
              <ChevronLeft className="w-3.5 h-3.5" />
            )}
          </button>
        )}

        {renderSidebarContent(isCollapsed)}
      </aside>

      {/* MOBILE DRAWER OVERLAY */}
      {isMobileOpen && (
        <div
          onClick={closeMobile}
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-md md:hidden animate-in fade-in duration-200"
        />
      )}

      {/* MOBILE DRAWER SIDEBAR (ALWAYS EXPANDED IN MOBILE VIEW) */}
      {/*
        El cajón nunca se desmonta: cerrado sigue en el DOM, solo desplazado fuera
        de pantalla. Sin `inert`, quien navega con teclado tabulaba dentro de un
        menú invisible y se perdía. `inert` lo saca del orden de foco y del árbol
        de accesibilidad mientras está cerrado, sin afectar a la animación.
      */}
      <aside
        {...(isMobileOpen ? dialogPropsCajon : {})}
        inert={!isMobileOpen}
        aria-label={t('navigation.navMenu')}
        className={`fixed top-0 bottom-0 left-0 z-50 w-[280px] md:hidden shadow-2xl transition-transform duration-300 ease-in-out border-r border-[var(--glass-border)] outline-none ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {renderSidebarContent(false)}
      </aside>
    </>
  );
}
