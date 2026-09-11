'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Topbar } from '@/components/Topbar';
import { ListRow, ListRows } from '@/components/ListRow';
import { useToast } from '@/components/ToastProvider';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { ActivityHeatmap } from '@/components/ActivityHeatmap';
import { GenreOverview } from '@/components/GenreOverview';
import {
  LayoutDashboard,
  Users,
  CheckCircle2,
  Zap,
  TrendingUp,
  BarChart3,
  Tv,
  Server,
  RefreshCw,
  Flame,
  User,
  Check,
  Globe,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from 'recharts';
import { useRouter } from 'next/navigation';

export default function AdminOverviewPage() {
  const router = useRouter();
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [chartType, setChartType] = useState<'area' | 'bar'>('area');
  const [timeframe, setTimeframe] = useState<'1d' | '7d' | '30d' | '1y'>('7d');
  const [chartHistory, setChartHistory] = useState<any[]>([]);
  const [chartLoading, setChartLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAllAdminData();
  }, []);

  const loadAllAdminData = async () => {
    try {
      setLoading(true);
      const meRes = await api.auth.me().catch(() => null);
      const meUser = meRes?.user || meRes;
      if (!meUser || meUser.role !== 'ADMIN') {
        showToast(t('admin.adminRequired'), 'error');
        router.push('/catalog');
        return;
      }

      const dashRes = await api.admin.getDashboard({ timeframe });
      setData(dashRes);
      setChartHistory(dashRes?.chartHistory || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = async (newTf: '1d' | '7d' | '30d' | '1y') => {
    setTimeframe(newTf);
    try {
      setChartLoading(true);
      const res = await api.admin.getChart(newTf);
      setChartHistory(res || []);
    } catch (err: any) {
      showToast(`${t('admin.loadMetricsError')} ` + err.message, 'error');
    } finally {
      setChartLoading(false);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    showToast(t('admin.refreshingMetrics'), 'info');
    await loadAllAdminData();
    setIsRefreshing(false);
    showToast(t('admin.metricsUpdated'), 'success');
  };

  const stats = data?.stats || {};
  const serviceDist = data?.serviceDistribution || {};
  const topShows = data?.topShows || [];

  const timeframeLabels: Record<string, string> = {
    '1d': t('admin.lastTwentyFourHours'),
    '7d': t('admin.lastSevenDays'),
    '30d': t('admin.lastThirtyDays'),
    '1y': t('admin.lastTwelveMonths'),
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--glass-bg)] border border-[var(--glass-border)] p-3 rounded-[6px] shadow-[var(--glass-shadow-lg)] backdrop-blur-xl space-y-1.5 font-mono text-xs text-[var(--text-primary)]">
          <p className="text-[var(--text-secondary)] font-bold border-b border-[var(--glass-border)] pb-1">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                <span className="text-[var(--text-secondary)]">{entry.name}:</span>
              </div>
              <span className="font-bold text-[var(--text-primary)]">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar rootLabel={t('navigation.systemAdmin')} currentLabel={t('admin.metricsTitle')} />

      {/* TOP HEADER (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-4">
        <div className="w-full space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
                  <BarChart3 className="w-4 h-4" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">{t('admin.metricsTitle')}</h1>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mt-1">
                {t('admin.metricsSubtitle')}
              </p>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                onClick={handleRefresh}
                disabled={isRefreshing || loading}
                className="btn-secondary"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>{t('admin.refreshMetrics')}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-8 space-y-8 min-w-0">
        <div className="space-y-8">
          {/* ROW DE 5 STAT CARDS REALES */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
            {/* Stat 1 */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold font-mono tracking-wider text-[var(--text-secondary)] uppercase">
                  {t('admin.totalScrobbles')}
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Tv className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-heading">
                {loading ? '-' : (stats.totalScrobbles ?? 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block"></span>
                <span>{t('admin.syncsRecorded')}</span>
              </div>
            </div>

            {/* Stat 2 */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold font-mono tracking-wider text-[var(--text-secondary)] uppercase">
                  {t('admin.activeUsers')}
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-purple-500/10 text-purple-400 flex items-center justify-center">
                  <Users className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-heading">
                {loading ? '-' : (stats.activeUsers24h ?? 0).toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-purple-400 font-semibold pt-0.5">
                <User className="w-3.5 h-3.5 shrink-0" />
                <span>{stats.totalUsers ?? 0} usuarios en total</span>
              </div>
            </div>

            {/* Stat 3 */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold font-mono tracking-wider text-[var(--text-secondary)] uppercase">
                  {t('admin.successRate')}
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-heading">
                {loading ? '-' : stats.successRate || '100%'}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-semibold pt-0.5">
                <Check className="w-3.5 h-3.5 shrink-0" />
                <span>{t('admin.syncsSuccessful')}</span>
              </div>
            </div>

            {/* Stat 4 */}
            <div className="glass-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10.5px] font-bold font-mono tracking-wider text-[var(--text-secondary)] uppercase">
                  SERVIDORES CONECTADOS
                </span>
                <div className="w-8 h-8 rounded-[6px] bg-sky-500/10 text-sky-400 flex items-center justify-center">
                  <Server className="w-4 h-4" />
                </div>
              </div>
              <div className="text-2xl font-bold text-[var(--text-primary)] tracking-tight font-heading">
                {loading
                  ? '-'
                  : (
                      (serviceDist.plexServersConnected ?? 0) +
                      (serviceDist.jellyfinServersConnected ?? 0) +
                      (serviceDist.embyServersConnected ?? 0)
                    ).toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold pt-0.5">
                <Globe className="w-3.5 h-3.5 shrink-0" />
                <span>Plex, Jellyfin y Emby vinculados</span>
              </div>
            </div>
          </div>

          {/* 1. GRÁFICO RECHARTS PRINCIPAL (ANCHO COMPLETO ARRIBA) */}
          <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-3 py-5 sm:p-6 space-y-6">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--accent-text)]" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.trafficVsSyncs')}{' '}<span className="text-[var(--text-muted)] font-normal text-xs">{timeframeLabels[timeframe]}</span>
                </h2>
              </div>

              <div className="flex items-center justify-between gap-3 w-full sm:w-auto sm:justify-end">
                {/* Rango temporal.
                    Etiqueta corta en movil: "1 Semana" y "Area" juntos no
                    caben en 375 px y el segundo grupo bajaba a otra fila.
                    Con las abreviaturas los dos controles comparten linea. */}
                <div className="flex items-center bg-[var(--bg-surface)] p-1 rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
                  {[
                    { id: '1d', corto: '1D', largo: t('admin.rangeDay') },
                    { id: '7d', corto: '7D', largo: t('admin.rangeWeek') },
                    { id: '30d', corto: '1M', largo: t('admin.rangeMonth') },
                    { id: '1y', corto: '1A', largo: t('admin.rangeYear') },
                  ].map((tf) => (
                    <button
                      key={tf.id}
                      type="button"
                      onClick={() => handleTimeframeChange(tf.id as any)}
                      disabled={chartLoading}
                      aria-pressed={timeframe === tf.id}
                      title={tf.largo}
                      className={`px-2 sm:px-2.5 py-1 rounded-[var(--radius-xs)] text-xs font-bold border transition-colors cursor-pointer select-none ${
                        timeframe === tf.id
                          ? 'bg-[var(--accent-primary)]/15 text-[var(--accent-text)] border-[var(--accent-primary)]/30 shadow-xs'
                          : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] border-transparent'
                      }`}
                    >
                      <span className="sm:hidden">{tf.corto}</span>
                      <span className="hidden sm:inline">{tf.largo}</span>
                    </button>
                  ))}
                </div>

                {/* Tipo de grafico: un solo boton que alterna.
                    Ensena el icono del tipo al que vas, no el que tienes, que
                    es lo que hace un boton: decir que pasa al pulsarlo. Igual
                    que el de rejilla/lista del catalogo. */}
                <button
                  type="button"
                  onClick={() => setChartType(chartType === 'area' ? 'bar' : 'area')}
                  title={chartType === 'area' ? t('admin.showAsBars') : t('admin.showAsArea')}
                  aria-label={chartType === 'area' ? t('admin.showAsBars') : t('admin.showAsArea')}
                  className="shrink-0 p-1.5 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                >
                  {chartType === 'area' ? (
                    <BarChart3 className="w-3.5 h-3.5" aria-hidden="true" />
                  ) : (
                    <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                  )}
                </button>
              </div>
            </div>

            {/* Renderizado Recharts */}
            <div className="w-full h-[320px]">
              {loading || chartLoading ? (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[var(--text-muted)] animate-pulse">
                  Cargando historial de métricas ({timeframeLabels[timeframe]})...
                </div>
              ) : chartHistory.length === 0 ? (
                <div className="w-full h-full flex items-center justify-center text-xs font-mono text-[var(--text-muted)]">{t('admin.noActivityInPeriod')}</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartType === 'area' ? (
                    <AreaChart data={chartHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="scrobbleGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#38bdf8" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#38bdf8" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="ipGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#c084fc" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#c084fc" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="mappingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#34d399" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Area type="monotone" dataKey="scrobbles" name="Scrobbles" stroke="#38bdf8" strokeWidth={2} fillOpacity={1} fill="url(#scrobbleGrad)" />
                      <Area type="monotone" dataKey="uniqueIps" name="Visitas IPs" stroke="#c084fc" strokeWidth={2} fillOpacity={1} fill="url(#ipGrad)" />
                      <Area type="monotone" dataKey="mappings" name="Mappings" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#mappingGrad)" />
                    </AreaChart>
                  ) : (
                    <BarChart data={chartHistory} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" vertical={false} />
                      <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="var(--text-muted)" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip content={<CustomTooltip />} />
                      <Bar dataKey="scrobbles" name="Scrobbles" fill="#38bdf8" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="uniqueIps" name="Visitas IPs" fill="#c084fc" radius={[4, 4, 0, 0]} maxBarSize={32} />
                      <Bar dataKey="mappings" name="Mappings" fill="#34d399" radius={[4, 4, 0, 0]} maxBarSize={32} />
                    </BarChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>

            {/* Leyenda */}
            <div className="flex items-center justify-center gap-6 pt-2 border-t border-[var(--glass-border)] text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-sky-400 inline-block"></span>
                <span className="text-[var(--text-secondary)]">Tráfico &amp; Scrobbles</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-purple-400 inline-block"></span>
                <span className="text-[var(--text-secondary)]">{t('admin.uniqueIpVisits')}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-emerald-400 inline-block"></span>
                <span className="text-[var(--text-secondary)]">Mapeos &amp; Webhooks</span>
              </div>
            </div>
          </div>

          {/* 2. FILA DE 2 COLUMNAS (50% / 50% EN PANTALLA COMPLETA, 100% EN PANTALLAS PEQUEÑAS) */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            {/* MATRIZ DE ACTIVIDAD ANUAL (ESTILO GITHUB & ANILIST) */}
            <ActivityHeatmap
              days={data?.activityHeatmap?.days || []}
              totalYearActivity={data?.activityHeatmap?.totalYearActivity || 0}
              currentStreak={data?.activityHeatmap?.currentStreak || 0}
              maxStreak={data?.activityHeatmap?.maxStreak || 0}
              loading={loading}
            />

            {/* DISTRIBUCIÓN POR GÉNEROS DE ANIME (ESTILO ANILIST GENRE OVERVIEW) */}
            <GenreOverview
              genres={data?.genreOverview?.genres || []}
              totalEntries={data?.genreOverview?.totalEntries || 0}
              loading={loading}
            />
          </div>

          {/* SECCIÓN TOP ANIMES MÁS VISTOS REALES */}
          <div className="glass-card -mx-4 sm:mx-0 rounded-none sm:rounded-[10px] border-x-0 sm:border-x px-3 py-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-[var(--glass-border)]">
              <div className="flex items-center gap-2.5">
                <Flame className="w-4 h-4 text-amber-400" />
                <h2 className="text-sm font-bold text-[var(--text-primary)] font-heading">{t('admin.mostWatchedShows')}</h2>
              </div>
              <span className="text-xs text-[var(--text-muted)] font-mono">{t('admin.aggregatedMetrics')}</span>
            </div>

            {topShows.length === 0 ? (
              <div className="py-8 text-center text-xs font-mono text-[var(--text-muted)]">
                {t('admin.noScrobblesYet')}
              </div>
            ) : (
              <ListRows label={t('admin.mostWatchedShows')}>
                {topShows.map((show: any, i: number) => (
                  <ListRow
                    key={i}
                    density="compact"
                    // El puesto va delante y no en una insignia a la derecha:
                    // es lo que ordena la lista, asi que se lee antes que nada
                    // y deja de gastar 90 px de la fila.
                    media={
                      <span className="w-6 text-right text-xs font-mono font-bold text-[var(--text-muted)]">
                        {i + 1}
                      </span>
                    }
                    title={show.title}
                    meta={[
                      t('admin.showScrobbles', { n: show.totalScrobbles?.toLocaleString() }),
                      t('admin.showUsers', { n: show.activeUsers?.toLocaleString() }),
                      t('admin.showEpisodes', { n: show.episodesTracked }),
                    ]}
                    status={
                      <span className="shrink-0 pointer-events-none inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]">
                        {show.completionRate}
                      </span>
                    }
                  />
                ))}
              </ListRows>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
