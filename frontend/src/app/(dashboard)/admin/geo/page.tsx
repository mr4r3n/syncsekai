'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ConfirmModal } from '@/components/ConfirmModal';
import {
  MapPin,
  RefreshCw,
  Globe,
  Users,
  Shield,
  Activity,
  Trash2,
  Navigation,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { CountryFlag } from '@/components/CountryFlag';
import { Paginacion } from '@/components/Paginacion';

// Import dinámico del componente de Mapa Leaflet
const WorldVisitorsMap = dynamic(
  () => import('@/components/WorldVisitorsMap').then((mod) => mod.WorldVisitorsMap),
  {
    ssr: false,
    loading: () => <MapaCargando />,
  }
);

// El "loading" de dynamic() se evalua en ambito de modulo, donde no hay hook.
// Como componente aparte lo renderiza React y si puede traducirse.
function MapaCargando() {
  const { t } = useI18n();
  return (
    <div className="rounded-2xl border border-white/[0.06] bg-[#0c0c0e] p-12 text-center text-xs font-mono text-zinc-500 animate-pulse">
      {t('admin.loadingMap')}
    </div>
  );
}

export default function AdminGeoPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  /*
   * Las dos listas se paginan aqui, no en el servidor.
   *
   * Los datos ya vienen enteros dentro del panel -son los mismos que alimentan
   * el mapa- asi que pedirlos por trozos seria una llamada de mas para recortar
   * un array que ya esta en memoria. Lo que hacia falta era que la tarjeta no
   * creciera sin fin: con 28 paises medía 2284 px de alto, y en produccion hay
   * mas.
   */
  const [paginaPaises, setPaginaPaises] = useState(1);
  const [paginaIps, setPaginaIps] = useState(1);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const dashRes = await api.admin.getDashboard();
      setData(dashRes);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    showToast(t('admin.refreshingGeo'), 'info');
    await loadData();
    setIsRefreshing(false);
    showToast(t('admin.geoUpdated'), 'success');
  };

  const handleResetGeoMetrics = async () => {
    try {
      setIsResetting(true);
      const res = await api.admin.resetGeoMetrics();
      showToast(res.message || t('admin.geoStatsReset'), 'success');
      setShowResetModal(false);
      await loadData();
    } catch (err: any) {
      showToast(err.message || t('admin.geoResetError'), 'error');
    } finally {
      setIsResetting(false);
    }
  };

  const geoVisits = data?.geographicVisits || [];
  const mapLocations = data?.mapLocations || [];
  const recentIps = data?.recentIps || [];
  const totalVisits = geoVisits.reduce((acc: number, curr: any) => acc + (curr.visits || 0), 0);

  // 8 filas: es lo que cabe sin que la tarjeta pase de la altura de la ventana
  // en un portatil, y sigue enseñando el grueso del trafico de un vistazo.
  const POR_PAGINA = 8;

  // La pagina se limita al total en vez de guardarse corregida: si al refrescar
  // hay menos paises, la lista se queda en la ultima que existe y no en blanco.
  const totalPaginasPaises = Math.max(1, Math.ceil(geoVisits.length / POR_PAGINA));
  const totalPaginasIps = Math.max(1, Math.ceil(recentIps.length / POR_PAGINA));
  const pagPaises = Math.min(paginaPaises, totalPaginasPaises);
  const pagIps = Math.min(paginaIps, totalPaginasIps);

  const paisesVisibles = geoVisits.slice((pagPaises - 1) * POR_PAGINA, pagPaises * POR_PAGINA);
  const ipsVisibles = recentIps.slice((pagIps - 1) * POR_PAGINA, pagIps * POR_PAGINA);

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.geoTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <MapPin className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                  {t('admin.geoTitle')}
                </h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">{t('admin.geoSubtitle')}</p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="btn-secondary"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('admin.refreshMap')}</span>
              </button>

              <button
                onClick={() => setShowResetModal(true)}
                disabled={isRefreshing || loading}
                className="px-3 py-1.5 rounded-[6px] border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                <span>{t('admin.resetStats')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        {/* RESUMEN DE MÉTRICAS GEO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <div className="glass-card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{t('admin.totalUniqueVisits')}</div>
              <div className="text-xl font-bold text-[var(--text-primary)] font-heading">{totalVisits}</div>
            </div>
          </div>

          <div className="glass-card p-4 flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-[8px] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
              <Globe className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{t('admin.countriesRecorded')}</div>
              <div className="text-xl font-bold text-[var(--text-primary)] font-heading">{geoVisits.length}</div>
            </div>
          </div>

          <div className="glass-card p-4 flex items-center gap-3.5 col-span-2 sm:col-span-1">
            <div className="w-10 h-10 rounded-[8px] bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
              <Navigation className="w-5 h-5" />
            </div>
            <div>
              <div className="text-[11px] text-[var(--text-muted)] font-mono uppercase tracking-wider">{t('admin.nodesOnMap')}</div>
              <div className="text-xl font-bold text-[var(--text-primary)] font-heading">{mapLocations.length}</div>
            </div>
          </div>
        </div>

        {/* MAPA MUNDIAL LEAFLET */}
        <div className="glass-card p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 pb-2 border-b border-[var(--glass-border)]">
            <div className="flex items-center gap-2.5 min-w-0">
              <Globe className="w-4 h-4 text-[var(--accent-text)] shrink-0" />
              <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.worldMapTitle')}</h2>
              <span className="badge-status-success text-[10px]">{t('admin.oneIpPerDay')}</span>
            </div>
            <span className="text-xs text-[var(--text-muted)] font-mono shrink-0">{t('admin.worldMapSubtitle')}</span>
          </div>

          <WorldVisitorsMap locations={mapLocations} />
        </div>

        {/* TABLA DE TRÁFICO POR PAÍS Y CIUDAD */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Por Países */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--glass-border)]">
              <MapPin className="w-4 h-4 text-emerald-400" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.visitsByCountry')}</h3>
            </div>

            <div className="space-y-3">
              {geoVisits.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)]">{t('admin.noGeoData')}</div>
              ) : (
                paisesVisibles.map((item: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <CountryFlag code={item.code} countryName={item.country} size="md" />
                      <div>
                        <div className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                          <span>{item.country || t('admin.unknownCountry')}</span>
                          {item.code && item.code !== 'LAN' && item.code !== 'XX' && (
                            <span className="font-mono text-[10px] text-[var(--text-muted)] bg-[var(--bg-surface-elevated)] px-1.5 py-0.5 rounded-[4px] border border-[var(--border-subtle)]">
                              {item.code}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] font-mono">
                          {item.code === 'LAN'
                            ? t('admin.localNetwork')
                            : t('admin.isoCode', { code: item.code || 'LOC' })}
                        </div>
                      </div>
                    </div>

                    <div className="text-right font-mono">
                      <div className="text-xs font-bold text-[var(--accent-text)]">
                        {t('admin.visitsCount', { n: item.visits })}
                      </div>
                      <div className="text-[10px] text-emerald-400 font-semibold">
                        {t('admin.percentOfTotal', { p: item.percentage })}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            <Paginacion
              pagina={pagPaises}
              totalPaginas={totalPaginasPaises}
              onCambio={setPaginaPaises}
              resumen={t('admin.countriesCounted', { n: geoVisits.length })}
              etiquetaAnterior={t('mappings.previousPage')}
              etiquetaSiguiente={t('mappings.nextPage')}
            />
          </div>

          {/* Por Ciudades / Sistemas */}
          <div className="glass-card p-6 space-y-4">
            <div className="flex items-center gap-2.5 pb-2 border-b border-[var(--glass-border)]">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                {t('admin.recentLocationsDevices')}
              </h3>
            </div>

            <div className="space-y-3">
              {recentIps.length === 0 ? (
                <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)]">{t('admin.noConnections24h')}</div>
              ) : (
                ipsVisibles.map((entry: any, i: number) => (
                  <div key={i} className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1 flex items-start gap-2.5">
                      <CountryFlag code={entry.code || entry.countryCode || entry.country} countryName={entry.country} size="sm" className="mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-[var(--text-primary)] truncate flex items-center gap-2">
                          <span>{entry.city ? entry.city : entry.country || t('admin.unknownLocation')}</span>
                          {entry.username && (
                            <span className="text-[10px] font-mono text-[var(--accent-text)] bg-[var(--accent-primary)]/10 px-1.5 py-0.5 rounded-[4px]">
                              @{entry.username}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                          <span className="font-semibold text-sky-400">
                            {entry.os || 'Windows / Web'}
                          </span>
                          {entry.isp && (
                            <>
                              <span>•</span>
                              <span className="text-[var(--text-muted)]">{entry.isp}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <span className="badge-pill shrink-0 font-mono text-xs">
                      {t('admin.visitsCount', { n: entry.requests })}
                    </span>
                  </div>
                ))
              )}
            </div>

            <Paginacion
              pagina={pagIps}
              totalPaginas={totalPaginasIps}
              onCambio={setPaginaIps}
              resumen={t('admin.connectionsCounted', { n: recentIps.length })}
              etiquetaAnterior={t('mappings.previousPage')}
              etiquetaSiguiente={t('mappings.nextPage')}
            />
          </div>
        </div>
      </main>

      {/* MODAL DE CONFIRMACIÓN DE REINICIO */}
      <ConfirmModal
        isOpen={showResetModal}
        title={t('admin.resetGeoStats')}
        description={t('admin.resetGeoDescription')}
        confirmText={t('admin.resetGeoConfirm')}
        cancelText={t('admin.cancel')}
        variant="danger"
        loading={isResetting}
        onConfirm={handleResetGeoMetrics}
        onClose={() => setShowResetModal(false)}
      />
    </div>
  );
}
