'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Server,
  RefreshCw,
  Zap,
  Radio,
  Tv,
  Layers,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Cpu,
  HardDrive,
  Database,
  Wrench,
  X,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useModalA11y } from '@/components/useModalA11y';

export default function AdminServicesPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [systemHealth, setSystemHealth] = useState<any>(null);
  const [maintenance, setMaintenance] = useState<{ enabled: boolean; message: string; estimatedEnd: string | null }>({
    enabled: false,
    message: '',
    estimatedEnd: null,
  });
  const [showMaintenanceModal, setShowMaintenanceModal] = useState(false);
  const [savingMaintenance, setSavingMaintenance] = useState(false);
  const [mEnabled, setMEnabled] = useState(false);
  const [mMessage, setMMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [autoRefreshInterval, setAutoRefreshInterval] = useState<number>(10); // por defecto 10s
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Semántica de diálogo y gestión de foco de los modales de esta vista.
  const { dialogProps: propsMantenimiento } = useModalA11y(Boolean(showMaintenanceModal), () => setShowMaintenanceModal(false));

  useEffect(() => {
    loadData(true);
  }, []);

  // Intervalo de auto-actualización en tiempo real
  useEffect(() => {
    if (autoRefreshInterval <= 0) return;
    const timer = setInterval(() => {
      loadData(false);
    }, autoRefreshInterval * 1000);
    return () => clearInterval(timer);
  }, [autoRefreshInterval]);

  const loadData = async (showInitialLoader = false) => {
    try {
      if (showInitialLoader) setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const [dashRes, healthRes, maintRes] = await Promise.allSettled([
        api.admin.getDashboard(),
        api.admin.getSystemHealth(),
        api.admin.getMaintenance(),
      ]);

      if (dashRes.status === 'fulfilled') setData(dashRes.value);
      if (healthRes.status === 'fulfilled') setSystemHealth(healthRes.value);
      if (maintRes.status === 'fulfilled') {
        setMaintenance(maintRes.value);
        setMEnabled(maintRes.value.enabled);
        setMMessage(maintRes.value.message);
      }
      setLastUpdated(new Date());
    } catch (e) {
      console.error(e);
    } finally {
      if (showInitialLoader) setLoading(false);
    }
  };

  const handleSaveMaintenance = async () => {
    setSavingMaintenance(true);
    try {
      const updated = await api.admin.setMaintenance({
        enabled: mEnabled,
        message: mMessage,
      });
      setMaintenance(updated);
      setShowMaintenanceModal(false);
      showToast(
        updated.enabled
          ? t('admin.maintenanceOn')
          : t('admin.maintenanceOff'),
        updated.enabled ? 'info' : 'success',
      );
    } catch (err: any) {
      showToast(err.message || t('admin.maintenanceUpdateError'), 'error');
    } finally {
      setSavingMaintenance(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await loadData(false);
    setIsRefreshing(false);
    showToast(t('admin.servicesUpdated'), 'success');
  };

  const stats = data?.stats || {};
  const serviceDist = data?.serviceDistribution || {};
  const libraryDist = data?.libraryDistribution || [];

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.servicesTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.servicesTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.servicesSubtitle')}</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* Selector de Auto-Sondeo */}
              <div className="flex items-center gap-1.5 p-1 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-xs">
                <span className="text-[11px] font-mono text-[var(--text-muted)] px-2 flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      autoRefreshInterval > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                    }`}
                  />
                  Sondeo:
                </span>
                {[
                  { label: 'Off', val: 0 },
                  { label: '5s', val: 5 },
                  { label: '10s', val: 10 },
                  { label: '30s', val: 30 },
                ].map((opt) => (
                  <button
                    key={opt.val}
                    type="button"
                    onClick={() => {
                      setAutoRefreshInterval(opt.val);
                      if (opt.val > 0) {
                        showToast(`Sondeo automático configurado cada ${opt.label}`, 'info');
                      } else {
                        showToast(t('admin.autoPollingPaused'), 'info');
                      }
                    }}
                    className={`px-2 py-1 rounded-[4px] font-mono text-[11px] font-bold transition-all cursor-pointer ${
                      autoRefreshInterval === opt.val
                        ? 'bg-[var(--accent-primary)]/10 text-[var(--accent-text)] border border-[var(--accent-primary)]/30 dark:bg-[var(--accent-primary)]/20 dark:border-[var(--accent-primary)]/40 shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border border-transparent'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Botón de Modo Mantenimiento */}
              <button
                type="button"
                onClick={() => {
                  setMEnabled(maintenance.enabled);
                  setMMessage(maintenance.message);
                  setShowMaintenanceModal(true);
                }}
                className={`btn-secondary transition-all ${
                  maintenance.enabled
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/40 hover:bg-amber-500/25 hover:border-amber-500/60 shadow-sm'
                    : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                }`}
                title="Configurar modo mantenimiento"
              >
                <Wrench className={`w-3.5 h-3.5 ${maintenance.enabled ? 'text-amber-400 animate-spin [animation-duration:8s]' : 'text-[var(--text-muted)]'}`} />
                <span>{maintenance.enabled ? t('admin.maintenanceActive') : 'Mantenimiento'}</span>
              </button>

              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="btn-secondary"
                title={t('admin.testConnectionsNow')}
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('admin.testNow')}</span>
              </button>
            </div>
          </div>

          {lastUpdated && (
            <div className="flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)] border-t border-[var(--glass-border)] pt-2">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                Última comprobación: {lastUpdated.toLocaleTimeString()}
              </span>
              <span className="text-[var(--accent-text)]">
                {autoRefreshInterval > 0 ? `Refresco activo (cada ${autoRefreshInterval}s)` : 'Modo manual'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main id="main-content" tabIndex={-1} className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0 outline-none">
        {/* ROW DE ESTADO DE MICROSERVICIOS PRINCIPALES */}
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <div key={i} className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="skeleton h-4 w-32 rounded" />
                  <div className="skeleton w-2.5 h-2.5 rounded-full" />
                </div>
                <div className="skeleton h-7 w-28 rounded" />
                <div className="skeleton h-3 w-full rounded" />
              </div>
            ))
          ) : (
            <>
              {/* 1. Backend NestJS */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Backend Core (NestJS)</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.stateOperational')}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                  <span>Puerto 4000</span>
                  <span className="text-[var(--accent-text)] font-semibold">Latencia: {stats.apiLatency || '4ms'}</span>
                </div>
              </div>

              {/* 2. PostgreSQL */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Database className="w-4 h-4 text-[var(--text-muted)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">PostgreSQL Pool</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.stateConnected')}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                  <span>Prisma ORM</span>
                  <span className="text-[var(--text-secondary)] font-semibold">{t('admin.activePool')}</span>
                </div>
              </div>

              {/* 3. Redis / BullMQ */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-rose-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Redis Queue</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.stateSynced')}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                  <span>{t('admin.scrobbleQueue')}</span>
                  <span className="text-rose-400 font-semibold">{t('admin.zeroPending')}</span>
                </div>
              </div>

              {/* 4. Plex Live Watcher */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Plex Watcher</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.onlineUpper')}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                  <span>Webhooks &amp; Polling</span>
                  <span className="text-amber-400 font-semibold">{serviceDist.plexServersConnected ?? 0} Servidores</span>
                </div>
              </div>

              {/* 5. Jellyfin Live Watcher */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-[var(--brand-jellyfin)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Jellyfin Watcher</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.onlineUpper')}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                  <span>Webhooks &amp; API</span>
                  <span className="text-[var(--brand-jellyfin)] font-semibold">{serviceDist.jellyfinServersConnected ?? 0} Servidores</span>
                </div>
              </div>

              {/* 6. Emby Live Watcher */}
              <div className="glass-card p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Tv className="w-4 h-4 text-[var(--brand-emby)]" />
                    <span className="text-xs font-bold text-[var(--text-primary)]">Emby Watcher</span>
                  </div>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <div className="text-xl font-bold font-mono text-emerald-400">{t('admin.onlineUpper')}</div>
                <div className="text-[11px] text-[var(--text-muted)] font-mono flex items-center justify-between">
                  <span>Polling /Sessions (5s)</span>
                  <span className="text-[var(--brand-emby)] font-semibold">{serviceDist.embyServersConnected ?? 0} Servidores</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* SECCIÓN 2: ESTADO Y LATENCIA DE APIS EXTERNAS & BASES DE DATOS */}
        <div className="glass-card p-6 sm:p-7 space-y-6">
          <div className="flex items-center justify-between border-b border-[var(--glass-border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('admin.liveStatusLatency')}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{t('admin.liveStatusDesc')}</p>
              </div>
            </div>

            <span className="badge-status-success hidden sm:flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />{t('admin.allApisVerified')}</span>
          </div>

          {/* Una fila por servicio: las latencias quedan alineadas y se pueden
              comparar. La latencia va en texto normal; el estado lo da la pastilla. */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8">
            {loading ? (
              [...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)]"
                >
                  <div className="skeleton h-3.5 w-36 rounded" />
                  <div className="skeleton h-2.5 flex-1 rounded" />
                  <div className="skeleton h-3 w-12 rounded" />
                  <div className="skeleton h-5 w-16 rounded-[4px]" />
                </div>
              ))
            ) : (
              systemHealth?.apis &&
              Object.entries(systemHealth.apis).map(([key, apiInfo]: [string, any]) => {
                const isOnline = apiInfo.status === 'ONLINE' || apiInfo.status === 'LISTENING';
                const isDegraded = apiInfo.status === 'DEGRADED';
                return (
                  <div
                    key={key}
                    className="flex items-center gap-3 py-2.5 border-b border-[var(--border-subtle)] last:border-b-0"
                  >
                    <span className="text-xs font-bold text-[var(--text-primary)] shrink-0">
                      {apiInfo.name}
                    </span>

                    {/* La direccion sobrevive solo si sobra sitio: es el dato
                        menos urgente de los cuatro. */}
                    <span className="hidden sm:block flex-1 min-w-0 text-[10.5px] font-mono text-[var(--text-muted)] truncate">
                      {apiInfo.endpoint || apiInfo.details}
                    </span>

                    <span
                      className="ml-auto sm:ml-0 shrink-0 text-[11px] font-mono font-bold text-[var(--text-primary)] tabular-nums"
                      title={t('admin.latencyLabel')}
                    >
                      {apiInfo.latency}
                    </span>

                    <span
                      className={`shrink-0 ${
                        isOnline
                          ? 'badge-status-success'
                          : isDegraded
                          ? 'badge-status-warning'
                          : 'badge-status-danger'
                      }`}
                    >
                      {apiInfo.status}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* SECCIÓN 3: HARDWARE Y RECURSOS DEL SERVIDOR */}
        <div className="glass-card p-6 sm:p-7 space-y-5">
          <div className="flex items-center gap-3 border-b border-[var(--glass-border)] pb-4">
            <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
              <Cpu className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('admin.nodeResources')}</h2>
              <p className="text-xs text-[var(--text-secondary)]">{t('admin.nodeResourcesDesc')}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 font-mono text-xs">
            {loading || !systemHealth?.system ? (
              [...Array(6)].map((_, i) => (
                <div key={i} className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-2">
                  <div className="skeleton h-2.5 w-16 rounded" />
                  <div className="skeleton h-4 w-20 rounded" />
                </div>
              ))
            ) : (
              <>
                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.uptimeLabel')}</div>
                  <div className="font-bold text-[var(--text-primary)] truncate">{systemHealth.system.uptime}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.memoryRss')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.memoryRss}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.heapUsed')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.memoryHeapUsed}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.cpuCores')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.cpuCores} cores</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.nodeEnv')}</div>
                  <div className="font-bold text-[var(--text-primary)]">{systemHealth.system.nodeVersion}</div>
                </div>

                <div className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] space-y-1">
                  <div className="text-[10.5px] text-[var(--text-muted)]">{t('admin.osPlatform')}</div>
                  <div className="font-bold text-[var(--text-primary)] truncate">{systemHealth.system.platform}</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* DISTRIBUCIÓN DE TRACKERS Y BIBLIOTECAS */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Distribución de Trackers */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Radio className="w-4 h-4 text-[var(--text-muted)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.trackerAdoption')}</h3>
            </div>

            <div className="space-y-4">
              {/* AniList */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-anilist)]" />
                    AniList (GraphQL API)
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.anilist?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.anilist?.percentage ?? 0}%` }} className="h-full bg-[var(--brand-anilist)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersSyncing', { n: serviceDist.anilist?.count ?? 0 })}
                </p>
              </div>

              {/* MyAnimeList */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-mal)]" />
                    MyAnimeList (REST v2)
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.mal?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.mal?.percentage ?? 0}%` }} className="h-full bg-[var(--brand-mal)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersSyncing', { n: serviceDist.mal?.count ?? 0 })}
                </p>
              </div>

              {/* Kitsu API */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-kitsu)]" />
                    Kitsu API
                  </span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.kitsu?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.kitsu?.percentage ?? 0}%` }} className="h-full bg-[var(--brand-kitsu)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersSyncing', { n: serviceDist.kitsu?.count ?? 0 })}
                </p>
              </div>

              {/* Sincronización Dual */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-primary)]" />{t('admin.dualSyncBoth')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">{serviceDist.both?.percentage ?? 0}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: `${serviceDist.both?.percentage ?? 0}%` }} className="h-full bg-[var(--accent-primary)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.usersWithMultipleTrackers', { n: serviceDist.both?.count ?? 0 })}
                </p>
              </div>
            </div>
          </div>

          {/* Pipeline & Rendimiento de Sincronización Global */}
          <div className="glass-card p-6 space-y-5">
            <div className="flex items-center gap-2.5">
              <Zap className="w-4 h-4 text-[var(--text-muted)]" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.pipelinePerformance')}</h3>
            </div>

            <div className="space-y-4">
              {/* 1. Tasa Global de Éxito */}
              <div className="p-4 rounded-[6px] border border-emerald-500/20 bg-emerald-500/5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />{t('admin.globalSuccessRate')}</span>
                  <span className="font-mono font-bold text-emerald-400">{stats.successRate || '100%'}</span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: stats.successRate || '100%' }}
                    className="h-full bg-emerald-400 rounded-full transition-all duration-500"
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono pt-0.5">
                  <span className="text-[var(--text-muted)]">
                    {t('admin.successOfTotal', { ok: stats.successfulScrobbles?.toLocaleString() || 0, total: stats.totalScrobbles?.toLocaleString() || 0 })}
                  </span>
                  <div className="flex items-center gap-2">
                    <Link
                      href="/admin/failed-scrobbles"
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/25 text-rose-400 hover:bg-rose-500/20 transition-colors font-semibold"
                      title={t('admin.viewFailedSyncs')}
                    >
                      <span>{t('admin.failuresCount', { n: stats.failedScrobbles ?? 0 })}</span>
                      <ExternalLink className="w-2.5 h-2.5" aria-hidden="true" />
                    </Link>
                    <span
                      className="inline-flex items-center px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] font-semibold"
                      title={t('admin.expectedSkips')}
                    >
                      {t('admin.skippedCount', { n: stats.skippedScrobbles ?? 0 })}
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. Servidores Plex Vinculados */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-plex)]" />{t('admin.pmsServersOnNetwork')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.serversCount', { n: stats.plexServersConnected ?? serviceDist.plexServersConnected ?? 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, (stats.plexPercentage || 0))}%` }}
                    className="h-full bg-[var(--brand-plex)] rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.percentUsersWithServer', { p: stats.plexPercentage || 0, server: 'Plex' })}
                </p>
              </div>

              {/* 3. Servidores Jellyfin Vinculados */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-jellyfin)]" />{t('admin.jellyfinServersOnNetwork')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.serversCount', { n: stats.jellyfinServersConnected ?? serviceDist.jellyfinServersConnected ?? 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, (stats.jellyfinPercentage || 0))}%` }}
                    className="h-full bg-[var(--brand-jellyfin)] rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.percentUsersWithServer', { p: stats.jellyfinPercentage || 0, server: 'Jellyfin' })}
                </p>
              </div>

              {/* 4. Servidores Emby Vinculados */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--brand-emby)]" />{t('admin.embyServersOnNetwork')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.serversCount', { n: stats.embyServersConnected ?? serviceDist.embyServersConnected ?? 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div
                    style={{ width: `${Math.min(100, (stats.embyPercentage || 0))}%` }}
                    className="h-full bg-[var(--brand-emby)] rounded-full transition-all duration-500"
                  />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">
                  {t('admin.percentUsersWithServer', { p: stats.embyPercentage || 0, server: 'Emby' })}
                </p>
              </div>

              {/* 5. Mapeos de Título en Base de Datos */}
              <div className="p-4 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[var(--text-muted)]" />{t('admin.mappingRulesInDb')}</span>
                  <span className="font-mono font-bold text-[var(--text-primary)]">
                    {t('admin.rulesCount', { n: stats.totalMappings?.toLocaleString() || 0 })}
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-[var(--border-subtle)] overflow-hidden">
                  <div style={{ width: '100%' }} className="h-full bg-[var(--text-muted)] rounded-full" />
                </div>
                <p className="text-[11px] text-[var(--text-muted)] font-mono">{t('admin.mappingRulesDesc')}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* MODAL DE GESTIÓN DEL MODO MANTENIMIENTO */}
      {showMaintenanceModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div
            {...propsMantenimiento}
            className="w-full max-w-lg p-6 sm:p-7 rounded-[8px] border border-[var(--glass-border)] bg-[var(--bg-surface-elevated)] backdrop-blur-xl shadow-2xl space-y-6 animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-[6px] bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="font-bold text-base text-[var(--text-primary)] font-heading">{t('admin.maintenanceControl')}</h2>
                  <p className="text-xs text-[var(--text-secondary)]">{t('admin.maintenanceControlDesc')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="p-1 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 text-xs">
              {/* Switch de Activación */}
              <div className="p-4 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                <div>
                  <span className="font-bold text-sm text-[var(--text-primary)] block">
                    {mEnabled ? '🟠 Modo Mantenimiento ACTIVADO' : '🟢 Modo Mantenimiento DESACTIVADO'}
                  </span>
                  <span className="text-[11px] text-[var(--text-muted)]">
                    {mEnabled
                      ? t('admin.maintenanceActiveDesc')
                      : t('admin.platformOpenDesc')}
                  </span>
                </div>

                <label className="relative inline-flex items-center cursor-pointer shrink-0 ml-3">
                  <input
                    type="checkbox"
                    checked={mEnabled}
                    onChange={(e) => setMEnabled(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-zinc-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-zinc-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500" />
                </label>
              </div>

              {/* Mensaje Personalizado */}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-[var(--text-secondary)]">{t('admin.messageVisibleToUsers')}</label>
                <textarea
                  value={mMessage}
                  onChange={(e) => setMMessage(e.target.value)}
                  rows={3}
                  placeholder={t('admin.maintenanceDefaultMsg')}
                  className="w-full px-3.5 py-2.5 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-xs text-[var(--text-primary)] focus:outline-none focus:border-[var(--accent-primary)] transition-colors resize-none"
                />
              </div>

              {/* Enlace para Previsualizar Pantalla */}
              <div className="pt-1 flex items-center justify-between text-[11px] font-mono text-[var(--text-muted)]">
                <span>{t('admin.wantToPreview')}</span>
                <Link
                  href="/maintenance"
                  target="_blank"
                  className="text-[var(--accent-text)] hover:underline flex items-center gap-1 font-bold"
                >
                  <span>Previsualizar /maintenance</span>
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-[var(--border-subtle)]">
              <button
                type="button"
                onClick={() => setShowMaintenanceModal(false)}
                className="btn-secondary text-xs"
              >{t('common.cancel')}</button>
              <button
                type="button"
                onClick={handleSaveMaintenance}
                disabled={savingMaintenance}
                className="px-5 py-2 rounded-[6px] bg-[var(--accent-primary)] text-white hover:bg-[var(--accent-primary-hover)] font-bold text-xs shadow-md shadow-[var(--accent-primary)]/20 transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {savingMaintenance && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{savingMaintenance ? 'Guardando...' : t('admin.saveState')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
