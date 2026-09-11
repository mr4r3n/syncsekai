'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Topbar } from '@/components/Topbar';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { PlexPinModal } from '@/components/PlexPinModal';
import { PlexServerModal } from '@/components/PlexServerModal';
import { JellyfinModal } from '@/components/JellyfinModal';
import { EmbyModal } from '@/components/EmbyModal';
import { AniListModal } from '@/components/AniListModal';
import { MalModal } from '@/components/MalModal';
import { KitsuModal } from '@/components/KitsuModal';
import { ScrobbleTesterModal } from '@/components/ScrobbleTesterModal';
import Link from 'next/link';
import {
  Server,
  Tv,
  Film,
  Folder,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ShieldCheck,
  Zap,
  Activity,
  Play,
  Check,
  Loader2,
  RefreshCw,
  Unplug,
  Edit2,
  Radio,
  Sparkles,
  KeyRound,
  Download,
  Upload,
  FileText,
  FileSpreadsheet,
  FileCode,
  FolderSync,
  BookOpen,
  ChevronDown,
} from 'lucide-react';

export default function ConnectionsPage() {
  const { isCollapsed } = useSidebar();
  const { showToast } = useToast();
  const { t } = useI18n();
  const [loading, setLoading] = useState(true);
  const [hubData, setHubData] = useState<any>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshingLibraries, setRefreshingLibraries] = useState(false);
  const [refreshingJellyfinLibraries, setRefreshingJellyfinLibraries] = useState(false);
  const [refreshingEmbyLibraries, setRefreshingEmbyLibraries] = useState(false);
  const [malAvatarError, setMalAvatarError] = useState(false);
  const [anilistAvatarError, setAnilistAvatarError] = useState(false);

  // Portabilidad de Biblioteca (Exportar & Importar)
  const [exportLoading, setExportLoading] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);

  const handleExport = async (format: 'mal_xml' | 'json' | 'csv') => {
    try {
      setExportLoading(format);
      showToast(`Generando archivo de exportación (${format.toUpperCase()})...`, 'info');
      const res = await api.catalog.exportData(format);

      const blob = new Blob([res.content], { type: res.contentType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast(`¡Biblioteca exportada con éxito como ${res.filename}!`, 'success');
    } catch (err: any) {
      showToast(`${t('connections.exportError')} ` + err.message, 'error');
    } finally {
      setExportLoading(null);
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setImportLoading(true);
      showToast(t('connections.processingImport'), 'info');
      const text = await file.text();
      const res = await api.catalog.importData(text);

      showToast(res.message, 'success');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.importLibraryError')} ` + err.message, 'error');
    } finally {
      setImportLoading(false);
      if (importFileRef.current) {
        importFileRef.current.value = '';
      }
    }
  };

  // Modals
  const [showPlexModal, setShowPlexModal] = useState(false);
  const [showServerModal, setShowServerModal] = useState(false);

  /*
   * Que servidores estan desplegados, y solo importa en movil.
   *
   * Los tres se pintan enteros -cabecera, bibliotecas, webhook y ayuda-, que en
   * 375 px son 3320 px de pagina: cuatro pantallas de scroll para llegar a las
   * cuentas de anime, que estan al final. En escritorio caben de sobra y no se
   * tocan.
   *
   * Arrancan cerrados: se entra aqui a mirar o cambiar UNO.
   */
  const [servidoresAbiertos, setServidoresAbiertos] = useState<Record<string, boolean>>({});
  const [showJellyfinModal, setShowJellyfinModal] = useState(false);
  const [showEmbyModal, setShowEmbyModal] = useState(false);
  const [showAnilistModal, setShowAnilistModal] = useState(false);
  const [showMalModal, setShowMalModal] = useState(false);
  const [showKitsuModal, setShowKitsuModal] = useState(false);
  const [showTesterModal, setShowTesterModal] = useState(false);

  // Library selection state
  const [availableLibraries, setAvailableLibraries] = useState<any[]>([]);
  const [selectedLibraries, setSelectedLibraries] = useState<string[]>([]);
  const [savingLibraries, setSavingLibraries] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  // Selección de librerías de Jellyfin (estado propio, misma forma que el de Plex)
  const [availableJellyfinLibraries, setAvailableJellyfinLibraries] = useState<any[]>([]);
  const [selectedJellyfinLibraries, setSelectedJellyfinLibraries] = useState<string[]>([]);
  const [savingJellyfinLibraries, setSavingJellyfinLibraries] = useState(false);
  const [copiedJellyfinWebhook, setCopiedJellyfinWebhook] = useState(false);

  // Selección de librerías de Emby (estado propio, misma forma que el de Jellyfin)
  const [availableEmbyLibraries, setAvailableEmbyLibraries] = useState<any[]>([]);
  const [selectedEmbyLibraries, setSelectedEmbyLibraries] = useState<string[]>([]);
  const [savingEmbyLibraries, setSavingEmbyLibraries] = useState(false);
  const [copiedEmbyWebhook, setCopiedEmbyWebhook] = useState(false);

  useEffect(() => {
    loadHubData();
  }, []);

  const loadHubData = async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const data = await api.connections.getHub();
      setHubData(data);

      const libs = data.plex?.availableLibraries || [];
      setAvailableLibraries(libs);

      const monitored = data.plex?.monitoredLibraries || [];
      setSelectedLibraries(monitored);

      const jellyfinLibs = data.jellyfin?.availableLibraries || [];
      setAvailableJellyfinLibraries(jellyfinLibs);

      const jellyfinMonitored = data.jellyfin?.monitoredLibraries || [];
      setSelectedJellyfinLibraries(jellyfinMonitored);

      const embyLibs = data.emby?.availableLibraries || [];
      setAvailableEmbyLibraries(embyLibs);

      const embyMonitored = data.emby?.monitoredLibraries || [];
      setSelectedEmbyLibraries(embyMonitored);
    } catch (err: any) {
      if (!silent) {
        showToast(`${t('connections.loadConnectionsError')} ` + err.message, 'error');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  };

  const handleRefreshLibraries = async () => {
    setRefreshingLibraries(true);
    try {
      const libs = await api.plex.getLibraries();
      setAvailableLibraries(libs);
      const monitored = libs.filter((l: any) => l.monitored).map((l: any) => l.title);
      if (monitored.length > 0) {
        setSelectedLibraries(monitored);
      }
      showToast(`Categorías actualizadas desde Plex (${libs.length} detectadas)`, 'success');
    } catch (err: any) {
      showToast(`${t('connections.queryPlexLibrariesError')} ` + err.message, 'error');
    } finally {
      setRefreshingLibraries(false);
    }
  };

  const handleRefreshJellyfinLibraries = async () => {
    setRefreshingJellyfinLibraries(true);
    try {
      const libs = await api.jellyfin.getLibraries();
      setAvailableJellyfinLibraries(libs);
      const monitored = libs.filter((l: any) => l.monitored).map((l: any) => l.title);
      if (monitored.length > 0) {
        setSelectedJellyfinLibraries(monitored);
      }
      showToast(`${t('connections.jellyfinLibrariesRefreshed')} (${libs.length})`, 'success');
    } catch (err: any) {
      showToast(`${t('connections.queryJellyfinLibrariesError')} ` + err.message, 'error');
    } finally {
      setRefreshingJellyfinLibraries(false);
    }
  };

  const handleRefreshEmbyLibraries = async () => {
    setRefreshingEmbyLibraries(true);
    try {
      const libs = await api.emby.getLibraries();
      setAvailableEmbyLibraries(libs);
      const monitored = libs.filter((l: any) => l.monitored).map((l: any) => l.title);
      if (monitored.length > 0) {
        setSelectedEmbyLibraries(monitored);
      }
      showToast(`${t('connections.embyLibrariesRefreshed')} (${libs.length})`, 'success');
    } catch (err: any) {
      showToast(`${t('connections.queryEmbyLibrariesError')} ` + err.message, 'error');
    } finally {
      setRefreshingEmbyLibraries(false);
    }
  };

  const handleHealthCheck = async () => {
    setIsRefreshing(true);
    try {
      const res = await api.connections.runHealthCheck();

      /* Se muestra lo que contestó el backend: un tracker sin vincular devuelve
       * latencia 0, y un valor por defecto aquí lo haría parecer conectado. */
      const lineas = ([
        ['AniList', res.services?.anilist],
        ['MyAnimeList', res.services?.mal],
        ['Kitsu', res.services?.kitsu],
      ] as Array<[string, any]>)
        .filter(([, s]) => s)
        .map(([nombre, s]) => {
          const conectado = s.connected ?? s.status === 'connected';
          const ms = Number(s.latencyMs);
          const estado = !conectado
            ? t('connections.healthNotLinked')
            : Number.isFinite(ms) && ms > 0
            ? t('connections.healthConnected', { ms })
            : t('connections.healthFailed');
          return t('connections.healthLine', { service: nombre, estado });
        });

      showToast(
        lineas.length > 0
          ? `${t('connections.healthDone')} — ${lineas.join(' · ')}`
          : t('connections.healthNothingLinked'),
        'info',
      );
      loadHubData();
    } catch (err: any) {
      showToast('Diagnóstico: ' + err.message, 'info');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleToggleLibrary = (titleOrId: string) => {
    if (selectedLibraries.includes(titleOrId)) {
      setSelectedLibraries(selectedLibraries.filter((t) => t !== titleOrId));
    } else {
      setSelectedLibraries([...selectedLibraries, titleOrId]);
    }
  };

  const handleToggleJellyfinLibrary = (titleOrId: string) => {
    if (selectedJellyfinLibraries.includes(titleOrId)) {
      setSelectedJellyfinLibraries(selectedJellyfinLibraries.filter((t) => t !== titleOrId));
    } else {
      setSelectedJellyfinLibraries([...selectedJellyfinLibraries, titleOrId]);
    }
  };

  const handleToggleEmbyLibrary = (titleOrId: string) => {
    if (selectedEmbyLibraries.includes(titleOrId)) {
      setSelectedEmbyLibraries(selectedEmbyLibraries.filter((t) => t !== titleOrId));
    } else {
      setSelectedEmbyLibraries([...selectedEmbyLibraries, titleOrId]);
    }
  };

  const handleSaveLibraries = async () => {
    setSavingLibraries(true);
    try {
      await api.plex.updateLibraries(selectedLibraries);
      showToast(t('connections.librariesSaved'), 'success');
    } catch (err: any) {
      showToast(`${t('connections.saveLibrariesError')} ` + err.message, 'error');
    } finally {
      setSavingLibraries(false);
    }
  };

  const handleSaveJellyfinLibraries = async () => {
    setSavingJellyfinLibraries(true);
    try {
      await api.jellyfin.updateLibraries(selectedJellyfinLibraries);
      showToast(t('connections.librariesSaved'), 'success');
    } catch (err: any) {
      showToast(`${t('connections.saveLibrariesError')} ` + err.message, 'error');
    } finally {
      setSavingJellyfinLibraries(false);
    }
  };

  const handleSaveEmbyLibraries = async () => {
    setSavingEmbyLibraries(true);
    try {
      await api.emby.updateLibraries(selectedEmbyLibraries);
      showToast(t('connections.librariesSaved'), 'success');
    } catch (err: any) {
      showToast(`${t('connections.saveLibrariesError')} ` + err.message, 'error');
    } finally {
      setSavingEmbyLibraries(false);
    }
  };

  const handleDisconnectPlex = async () => {
    if (!confirm(t('connections.confirmDisconnectPlex'))) return;
    try {
      await api.plex.disconnect();
      showToast(t('connections.plexDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectPlexError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectJellyfin = async () => {
    if (!confirm(t('connections.confirmDisconnectJellyfin'))) return;
    try {
      await api.jellyfin.disconnect();
      showToast(t('connections.jellyfinDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectJellyfinError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectEmby = async () => {
    if (!confirm(t('connections.confirmDisconnectEmby'))) return;
    try {
      await api.emby.disconnect();
      showToast(t('connections.embyDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectEmbyError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectAnilist = async () => {
    if (!confirm(t('connections.confirmDisconnectAniList'))) return;
    try {
      await api.anilist.disconnect();
      showToast(t('connections.aniListDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectAniListError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectMal = async () => {
    if (!confirm(t('connections.confirmDisconnectMal'))) return;
    try {
      await api.mal.disconnect();
      showToast(t('connections.malDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectMalError')} ` + err.message, 'error');
    }
  };

  const handleDisconnectKitsu = async () => {
    if (!confirm(t('connections.confirmDisconnectKitsu'))) return;
    try {
      await api.kitsu.disconnect();
      showToast(t('connections.kitsuDisconnected'), 'info');
      loadHubData();
    } catch (err: any) {
      showToast(`${t('connections.disconnectKitsuError')} ` + err.message, 'error');
    }
  };

  const getDisplayWebhookUrl = () => {
    if (hubData?.webhookUrl && !hubData.webhookUrl.includes('localhost') && !hubData.webhookUrl.includes('127.0.0.1')) {
      return hubData.webhookUrl;
    }
    if (typeof window !== 'undefined' && window.location.origin) {
      const token = hubData?.webhookToken || hubData?.plex?.webhookToken;
      if (token) {
        return `${window.location.origin}/api/plex/webhook/${token}`;
      }
    }
    return hubData?.webhookUrl || 'https://syncsekai.com/api/plex/webhook/whk_live_...';
  };

  const copyWebhookUrl = () => {
    const url = getDisplayWebhookUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedWebhook(true);
    showToast(t('connections.webhookCopied'), 'success');
    setTimeout(() => setCopiedWebhook(false), 2500);
  };

  const getDisplayJellyfinWebhookUrl = () => {
    if (hubData?.jellyfin?.webhookUrl && !hubData.jellyfin.webhookUrl.includes('localhost') && !hubData.jellyfin.webhookUrl.includes('127.0.0.1')) {
      return hubData.jellyfin.webhookUrl;
    }
    if (typeof window !== 'undefined' && window.location.origin) {
      const token = hubData?.jellyfin?.webhookToken || hubData?.webhookToken;
      if (token) {
        return `${window.location.origin}/api/jellyfin/webhook/${token}`;
      }
    }
    return hubData?.jellyfin?.webhookUrl || 'https://syncsekai.com/api/jellyfin/webhook/whk_live_...';
  };

  const copyJellyfinWebhookUrl = () => {
    const url = getDisplayJellyfinWebhookUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedJellyfinWebhook(true);
    showToast(t('connections.webhookCopied'), 'success');
    setTimeout(() => setCopiedJellyfinWebhook(false), 2500);
  };

  const getDisplayEmbyWebhookUrl = () => {
    if (hubData?.emby?.webhookUrl && !hubData.emby.webhookUrl.includes('localhost') && !hubData.emby.webhookUrl.includes('127.0.0.1')) {
      return hubData.emby.webhookUrl;
    }
    if (typeof window !== 'undefined' && window.location.origin) {
      const token = hubData?.emby?.webhookToken || hubData?.webhookToken;
      if (token) {
        return `${window.location.origin}/api/emby/webhook/${token}`;
      }
    }
    return hubData?.emby?.webhookUrl || 'https://syncsekai.com/api/emby/webhook/whk_live_...';
  };

  const copyEmbyWebhookUrl = () => {
    const url = getDisplayEmbyWebhookUrl();
    if (!url) return;
    navigator.clipboard.writeText(url);
    setCopiedEmbyWebhook(true);
    showToast(t('connections.webhookCopied'), 'success');
    setTimeout(() => setCopiedEmbyWebhook(false), 2500);
  };

  const isPlexConnected = !!hubData?.plex?.connected;
  const isJellyfinConnected = !!hubData?.jellyfin?.connected;
  const isEmbyConnected = !!hubData?.emby?.connected;
  const isAnilistConnected = !!hubData?.anilist?.connected;
  const isMalConnected = !!hubData?.mal?.connected;
  const isKitsuConnected = !!hubData?.kitsu?.connected;

  const activeServicesCount = [isPlexConnected, isJellyfinConnected, isEmbyConnected, isAnilistConnected, isMalConnected, isKitsuConnected].filter(Boolean).length;

  return (
    <div
      className={`min-h-screen bg-[var(--bg-app)] text-[var(--text-primary)] transition-all duration-500 ease-[cubic-bezier(0.25,1,0.5,1)] ${
        isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]'
      } pl-0 flex flex-col`}
    >
      <Topbar
        rootLabel={t('topbar.settings')}
        currentLabel={t('connections.title')}
        onRefresh={handleHealthCheck}
        isRefreshing={isRefreshing}
      />

      {/* HEADER DE LA SECCIÓN (STATIC EN MÓVIL, STICKY EN DESKTOP) */}
      <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-2">
        <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading">
                {t('connections.title')}
              </h1>
              <span className="badge-status-success">
                ● {activeServicesCount} {t('connections.activeServices')}
              </span>
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              {t('connections.subtitle')}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowTesterModal(true)}
              className="btn-secondary text-xs"
            >
              <Play className="w-3.5 h-3.5 fill-current text-[var(--accent-text)]" />
              <span>{t('connections.scrobbleSimulator')}</span>
            </button>

            <button
              onClick={handleHealthCheck}
              disabled={isRefreshing || loading}
              className="btn-secondary text-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[#02a9ff] ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{t('connections.apiDiagnostics')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* CONTENIDO PRINCIPAL: USO COMPLETO DEL CONTENEDOR */}
      <main className="w-full px-4 sm:px-6 md:px-8 py-6 sm:py-8 space-y-8 min-w-0">
        {loading ? (
          <div className="py-32 flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-[var(--accent-text)]" />
            <span className="text-xs font-mono text-[var(--text-muted)]">{t('connections.queryingServices')}</span>
          </div>
        ) : (
          <div className="space-y-8">
            {/* BANNER DE RECONEXIÓN REQUERIDA (Para cuentas heredadas o sesiones antiguas) */}
            {hubData?.reconnectionRequiredCount > 0 && (
              <div className="p-4 sm:p-5 rounded-2xl border border-rose-500/30 bg-gradient-to-r from-rose-500/10 via-amber-500/10 to-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-lg animate-in fade-in">
                <div className="flex items-start gap-3.5 min-w-0">
                  <div className="w-10 h-10 rounded-xl bg-rose-500/20 text-rose-400 border border-rose-500/30 flex items-center justify-center shrink-0">
                    <AlertCircle className="w-5 h-5 animate-pulse" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 flex-wrap">
                      <span>{t('connections.reauthRequiredHeading')}</span>
                      <span className="bg-rose-500 text-white text-[10.5px] font-extrabold px-2 py-0.5 rounded-full animate-pulse shadow-sm tracking-tight">
                        {hubData.reconnectionRequiredCount} servicio(s)
                      </span>
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-1 leading-relaxed">
                      Detectamos que tus conexiones ({hubData.servicesNeedingReauth?.join(', ')}) fueron creadas en una versión previa. Para sincronizar tu avatar oficial, tu ID de usuario y disfrutar de todas las nuevas funciones, haz clic en <strong>&quot;Reconectar&quot;</strong>{' '}{t('connections.onCardsBelow')}</p>
                  </div>
                </div>
              </div>
            )}

            {/* 1. CARD: PLEX MEDIA SERVER */}
            <div className="glass-card card-sin-borde-movil p-4 sm:p-7 flex flex-col gap-3.5 sm:gap-6">
              {/* Cabecera Plex */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <img
                    src="/plex.svg"
                    alt="Plex"
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-[6px] shadow-md shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">1. Plex Media Server</h2>
                      <span className={isPlexConnected ? 'badge-status-success' : 'badge-pill'}>
                        {isPlexConnected ? `● ${t('connections.connected')}` : t('connections.notConnected')}
                      </span>
                      {hubData?.plex?.needsReconnection && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                          ⚠ {t('connections.relink')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {isPlexConnected ? (
                        <>
                          <span>{t('connections.server')}: <strong className="text-[var(--text-primary)] font-semibold">{hubData.plex?.serverName || 'Plex'}</strong></span>
                          <span className="hidden sm:inline opacity-40">•</span>
                          <span className="break-all opacity-80 select-all">{hubData.plex?.serverUrl || 'Local Server'}</span>
                        </>
                      ) : (
                        <span>{t('connections.noServerLinked')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plegado en movil: cuando la tarjeta esta cerrada solo hacen
                    falta el nombre y el estado; los botones son parte de lo que
                    se abre, y sueltos ahi partian en dos filas descuadradas. */}
                <div
                  className={`grid grid-cols-2 md:flex md:items-center gap-2 md:gap-2.5 md:flex-wrap ${
                    servidoresAbiertos.plex ? 'grid' : 'hidden'
                  }`}
                >
                  <Link
                    href="/docs?section=plex"
                    className="btn-secondary text-xs"
                    title="Ver guía de configuración del webhook de Plex"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                    <span>{t('connections.guide')}</span>
                  </Link>

                  {isPlexConnected && (
                    <button
                      onClick={() => setShowServerModal(true)}
                      className="btn-secondary text-xs"
                      title={t('connections.changeServer')}
                    >
                      <Server className="w-3.5 h-3.5 text-[#e5a00d]" />
                      <span>{t('connections.changeServer')}</span>
                    </button>
                  )}

                  <button
                    onClick={() => setShowPlexModal(true)}
                    className="btn-secondary text-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                    <span>{isPlexConnected ? t('connections.relinkAccount') : t('connections.linkServer')}</span>
                  </button>

                  {isPlexConnected && (
                    <button
                      onClick={handleDisconnectPlex}
                      className="btn-danger btn-icon w-full md:w-auto"
                      title={t('connections.disconnectServer')}
                    >
                      <Unplug className="w-4 h-4 text-rose-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* En movil el cuerpo se pliega; el boton dice que hace. */}
              <button
                type="button"
                onClick={() =>
                  setServidoresAbiertos((prev) => ({ ...prev, plex: !prev.plex }))
                }
                aria-expanded={!!servidoresAbiertos.plex}
                className="md:hidden -mt-0.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span>
                  {servidoresAbiertos.plex
                    ? t('connections.hideDetails')
                    : t('connections.showDetails')}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    servidoresAbiertos.plex ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* El plegado se anima con la altura de una fila de rejilla:
                  de 0fr a 1fr. Es la unica forma de animar hasta "lo que mida
                  el contenido" sin fijar una altura a mano, que aqui cambia
                  segun tengas bibliotecas o no. En escritorio el contenedor
                  vuelve a ser un bloque normal y no hay nada que animar. */}
              <div
                className={`grid md:block transition-[grid-template-rows,margin-top] duration-300 ease-out ${
                  servidoresAbiertos.plex
                    ? 'grid-rows-[1fr]'
                    : 'grid-rows-[0fr] -mt-3.5 md:mt-0'
                }`}
              >
                <div className="overflow-hidden md:overflow-visible">
                  <div className="flex flex-col gap-6">
              {/* Estado cuando Plex no está conectado */}
              {!isPlexConnected && (
                <div className="p-6 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-2">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('connections.noPlexLinked')}{' '}<strong className="text-[var(--text-primary)]">&quot;{t('connections.linkServer')}&quot;</strong>{' '}{t('connections.noPlexLinkedRest')}</p>
                </div>
              )}

              {/* Categorías de Plex a Monitorear */}
              {isPlexConnected && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                        <span>{t('connections.librariesToMonitor')}</span>
                        {/*
                          Cuando Plex no responde, la lista de categorías llega vacía y
                          el contador mostraba "(1 de 0 seleccionadas)": tu selección
                          guardada frente a una lista de cero. Sin librerías que contar,
                          se indica cuántas tienes guardadas y ya.
                        */}
                        <span className="font-mono font-semibold text-[var(--text-muted)]">
                          {availableLibraries.length > 0
                            ? t('connections.librariesSelectedCount', { selected: selectedLibraries.length, total: availableLibraries.length })
                            : selectedLibraries.length > 0
                              ? t('connections.librariesSavedNoConnection', { count: selectedLibraries.length })
                              : ''}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-secondary)]">{t('connections.librariesToMonitorDesc')}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRefreshLibraries}
                        disabled={refreshingLibraries}
                        className="btn-secondary"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingLibraries ? 'animate-spin' : ''}`} />
                        <span>{t('connections.refresh')}</span>
                      </button>

                      <button
                        onClick={handleSaveLibraries}
                        disabled={savingLibraries}
                        className="btn-primary"
                      >
                        {savingLibraries ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>{t('connections.saveSelection')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid de Librerías */}
                  {availableLibraries.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                      {availableLibraries.map((lib) => {
                        const isSelected = selectedLibraries.includes(lib.title);
                        const isAnime = lib.title.toLowerCase().includes('anime');
                        return (
                          <div
                            key={lib.key || lib.title}
                            onClick={() => handleToggleLibrary(lib.title)}
                            className={`p-3.5 rounded-[6px] border cursor-pointer transition-all flex items-start gap-3 select-none ${
                              isSelected
                                ? 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] shadow-sm'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-80 hover:opacity-100 hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-[4px] mt-0.5 flex items-center justify-center border transition-colors shrink-0 ${
                                isSelected
                                  ? 'bg-[var(--btn-primary-bg)] border-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold'
                                  : 'border-[var(--border-strong)] bg-transparent'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {lib.title}
                                </span>
                                <span className="badge-pill">
                                  {lib.type === 'show' ? 'SERIES TV' : 'PELÍCULAS'}
                                </span>
                              </div>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                                {lib.path || (isAnime ? '/mnt/media/Animes' : '/mnt/media/TV')}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t('connections.noLibrariesDetected')}
                      </p>
                    </div>
                  )}

                  {/* Webhook Privado Box */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] space-y-2 mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('connections.privateWebhookUrl')}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <Link
                          href="/docs?section=plex"
                          className="text-amber-400 hover:underline text-xs flex items-center gap-1 font-medium"
                          title="Ver guía detallada"
                        >
                          <BookOpen className="w-3 h-3" />
                          <span>{t('connections.webhookGuide')}</span>
                        </Link>
                        <button
                          onClick={() => setShowTesterModal(true)}
                          className="text-[var(--accent-text)] hover:underline text-xs flex items-center gap-1 font-medium cursor-pointer"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{t('connections.testWithSimulator')}</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={getDisplayWebhookUrl()}
                        className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] px-3 py-2 text-xs font-mono text-[var(--text-primary)] outline-none select-all"
                      />
                      <button
                        onClick={copyWebhookUrl}
                        className="btn-secondary"
                      >
                        {copiedWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedWebhook ? t('connections.copied') : t('connections.copy')}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)]">
                      {t('connections.plexWebhookHint')}
                    </p>
                  </div>
                </div>
              )}
                  </div>
                </div>
              </div>
            </div>

            {/* 2. CARD: JELLYFIN MEDIA SERVER */}
            <div className="glass-card card-sin-borde-movil p-4 sm:p-7 flex flex-col gap-3.5 sm:gap-6">
              {/* Cabecera Jellyfin */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <img
                    src="/jellyfin.svg"
                    alt="Jellyfin"
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-[6px] shadow-md shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('connections.jellyfinTitle')}</h2>
                      <span className={isJellyfinConnected ? 'badge-status-success' : 'badge-pill'}>
                        {isJellyfinConnected ? `● ${t('connections.connected')}` : t('connections.notConnected')}
                      </span>
                      {hubData?.jellyfin?.needsReconnection && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                          ⚠ {t('connections.relink')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {isJellyfinConnected ? (
                        <>
                          <span>{t('connections.server')}: <strong className="text-[var(--text-primary)] font-semibold">{hubData.jellyfin?.serverName || 'Jellyfin'}</strong></span>
                          <span className="hidden sm:inline opacity-40">•</span>
                          <span className="break-all opacity-80 select-all">{hubData.jellyfin?.serverUrl || 'Local Server'}</span>
                        </>
                      ) : (
                        <span>{t('connections.noServerLinked')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plegado en movil: cuando la tarjeta esta cerrada solo hacen
                    falta el nombre y el estado; los botones son parte de lo que
                    se abre, y sueltos ahi partian en dos filas descuadradas. */}
                <div
                  className={`grid grid-cols-2 md:flex md:items-center gap-2 md:gap-2.5 md:flex-wrap ${
                    servidoresAbiertos.jellyfin ? 'grid' : 'hidden'
                  }`}
                >
                  <Link
                    href="/docs?section=jellyfin"
                    className="btn-secondary text-xs"
                    title="Ver guía y plantilla JSON del webhook de Jellyfin"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[var(--brand-jellyfin)]" />
                    <span>{t('connections.guide')}</span>
                  </Link>

                  <button
                    onClick={() => setShowJellyfinModal(true)}
                    className="btn-secondary text-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[var(--brand-jellyfin)]" />
                    <span>{isJellyfinConnected ? t('connections.relinkAccount') : t('connections.jellyfinLinkServer')}</span>
                  </button>

                  {isJellyfinConnected && (
                    <button
                      onClick={handleDisconnectJellyfin}
                      className="btn-danger btn-icon w-full md:w-auto"
                      title={t('connections.disconnectJellyfin')}
                    >
                      <Unplug className="w-4 h-4 text-rose-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* En movil el cuerpo se pliega; el boton dice que hace. */}
              <button
                type="button"
                onClick={() =>
                  setServidoresAbiertos((prev) => ({ ...prev, jellyfin: !prev.jellyfin }))
                }
                aria-expanded={!!servidoresAbiertos.jellyfin}
                className="md:hidden -mt-0.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span>
                  {servidoresAbiertos.jellyfin
                    ? t('connections.hideDetails')
                    : t('connections.showDetails')}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    servidoresAbiertos.jellyfin ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* El plegado se anima con la altura de una fila de rejilla:
                  de 0fr a 1fr. Es la unica forma de animar hasta "lo que mida
                  el contenido" sin fijar una altura a mano, que aqui cambia
                  segun tengas bibliotecas o no. En escritorio el contenedor
                  vuelve a ser un bloque normal y no hay nada que animar. */}
              <div
                className={`grid md:block transition-[grid-template-rows,margin-top] duration-300 ease-out ${
                  servidoresAbiertos.jellyfin
                    ? 'grid-rows-[1fr]'
                    : 'grid-rows-[0fr] -mt-3.5 md:mt-0'
                }`}
              >
                <div className="overflow-hidden md:overflow-visible">
                  <div className="flex flex-col gap-6">
              {/* Estado cuando Jellyfin no está conectado */}
              {!isJellyfinConnected && (
                <div className="p-6 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-2">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('connections.noJellyfinLinked')}</p>
                </div>
              )}

              {/* Categorías de Jellyfin a Monitorear */}
              {isJellyfinConnected && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                        <span>{t('connections.jellyfinLibrariesToMonitor')}</span>
                        <span className="font-mono font-semibold text-[var(--text-muted)]">
                          {availableJellyfinLibraries.length > 0
                            ? t('connections.librariesSelectedCount', { selected: selectedJellyfinLibraries.length, total: availableJellyfinLibraries.length })
                            : selectedJellyfinLibraries.length > 0
                              ? t('connections.librariesSavedNoConnection', { count: selectedJellyfinLibraries.length })
                              : ''}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-secondary)]">{t('connections.jellyfinLibrariesToMonitorDesc')}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRefreshJellyfinLibraries}
                        disabled={refreshingJellyfinLibraries}
                        className="btn-secondary"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingJellyfinLibraries ? 'animate-spin' : ''}`} />
                        <span>{t('connections.refresh')}</span>
                      </button>

                      <button
                        onClick={handleSaveJellyfinLibraries}
                        disabled={savingJellyfinLibraries}
                        className="btn-primary"
                      >
                        {savingJellyfinLibraries ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>{t('connections.saveSelection')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid de Librerías */}
                  {availableJellyfinLibraries.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                      {availableJellyfinLibraries.map((lib) => {
                        const isSelected = selectedJellyfinLibraries.includes(lib.title);
                        return (
                          <div
                            key={lib.key || lib.title}
                            onClick={() => handleToggleJellyfinLibrary(lib.title)}
                            className={`p-3.5 rounded-[6px] border cursor-pointer transition-all flex items-start gap-3 select-none ${
                              isSelected
                                ? 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] shadow-sm'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-80 hover:opacity-100 hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-[4px] mt-0.5 flex items-center justify-center border transition-colors shrink-0 ${
                                isSelected
                                  ? 'bg-[var(--btn-primary-bg)] border-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold'
                                  : 'border-[var(--border-strong)] bg-transparent'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {lib.title}
                                </span>
                                <span className="badge-pill">
                                  {lib.type === 'CollectionFolder' ? 'LIBRERÍA' : 'SERIES TV'}
                                </span>
                              </div>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                                {lib.path || '/media/anime'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t('connections.noLibrariesDetected')}
                      </p>
                    </div>
                  )}

                  {/* Webhook Privado Box */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] space-y-2 mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('connections.jellyfinPrivateWebhookUrl')}</span>
                      </div>
                      <Link
                        href="/docs?section=jellyfin"
                        className="text-[var(--brand-jellyfin)] hover:underline text-xs flex items-center gap-1 font-medium"
                        title="Ver guía y plantilla JSON"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{t('connections.webhookGuide')}</span>
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={getDisplayJellyfinWebhookUrl()}
                        className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] px-3 py-2 text-xs font-mono text-[var(--text-primary)] outline-none select-all"
                      />
                      <button
                        onClick={copyJellyfinWebhookUrl}
                        className="btn-secondary"
                      >
                        {copiedJellyfinWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedJellyfinWebhook ? t('connections.copied') : t('connections.copy')}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)]">{t('connections.jellyfinWebhookHint')}</p>
                  </div>
                </div>
              )}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. CARD: EMBY MEDIA SERVER */}
            <div className="glass-card card-sin-borde-movil p-4 sm:p-7 flex flex-col gap-3.5 sm:gap-6">
              {/* Cabecera Emby */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5 min-w-0">
                  <img
                    src="/emby.svg"
                    alt="Emby"
                    width={44}
                    height={44}
                    className="w-11 h-11 rounded-[6px] shadow-md shrink-0 object-contain"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('connections.embyTitle')}</h2>
                      <span className={isEmbyConnected ? 'badge-status-success' : 'badge-pill'}>
                        {isEmbyConnected ? `● ${t('connections.connected')}` : t('connections.notConnected')}
                      </span>
                      {hubData?.emby?.needsReconnection && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 border border-rose-500/30 animate-pulse">
                          ⚠ {t('connections.relink')}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-[var(--text-muted)] font-mono mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                      {isEmbyConnected ? (
                        <>
                          <span>{t('connections.server')}: <strong className="text-[var(--text-primary)] font-semibold">{hubData.emby?.serverName || 'Emby'}</strong></span>
                          <span className="hidden sm:inline opacity-40">•</span>
                          <span className="break-all opacity-80 select-all">{hubData.emby?.serverUrl || 'Local Server'}</span>
                        </>
                      ) : (
                        <span>{t('connections.noServerLinked')}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Plegado en movil: cuando la tarjeta esta cerrada solo hacen
                    falta el nombre y el estado; los botones son parte de lo que
                    se abre, y sueltos ahi partian en dos filas descuadradas. */}
                <div
                  className={`grid grid-cols-2 md:flex md:items-center gap-2 md:gap-2.5 md:flex-wrap ${
                    servidoresAbiertos.emby ? 'grid' : 'hidden'
                  }`}
                >
                  <Link
                    href="/docs?section=emby"
                    className="btn-secondary text-xs"
                    title="Ver guía y watcher de sesiones de Emby"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-[var(--brand-emby)]" />
                    <span>{t('connections.guide')}</span>
                  </Link>

                  <button
                    onClick={() => setShowEmbyModal(true)}
                    className="btn-secondary text-xs"
                  >
                    <KeyRound className="w-3.5 h-3.5 text-[var(--brand-emby)]" />
                    <span>{isEmbyConnected ? t('connections.relinkAccount') : t('connections.embyLinkServer')}</span>
                  </button>

                  {isEmbyConnected && (
                    <button
                      onClick={handleDisconnectEmby}
                      className="btn-danger btn-icon w-full md:w-auto"
                      title={t('connections.disconnectEmby')}
                    >
                      <Unplug className="w-4 h-4 text-rose-400" />
                    </button>
                  )}
                </div>
              </div>

              {/* En movil el cuerpo se pliega; el boton dice que hace. */}
              <button
                type="button"
                onClick={() =>
                  setServidoresAbiertos((prev) => ({ ...prev, emby: !prev.emby }))
                }
                aria-expanded={!!servidoresAbiertos.emby}
                className="md:hidden -mt-0.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              >
                <span>
                  {servidoresAbiertos.emby
                    ? t('connections.hideDetails')
                    : t('connections.showDetails')}
                </span>
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform duration-200 ${
                    servidoresAbiertos.emby ? 'rotate-180' : ''
                  }`}
                  aria-hidden="true"
                />
              </button>

              {/* El plegado se anima con la altura de una fila de rejilla:
                  de 0fr a 1fr. Es la unica forma de animar hasta "lo que mida
                  el contenido" sin fijar una altura a mano, que aqui cambia
                  segun tengas bibliotecas o no. En escritorio el contenedor
                  vuelve a ser un bloque normal y no hay nada que animar. */}
              <div
                className={`grid md:block transition-[grid-template-rows,margin-top] duration-300 ease-out ${
                  servidoresAbiertos.emby
                    ? 'grid-rows-[1fr]'
                    : 'grid-rows-[0fr] -mt-3.5 md:mt-0'
                }`}
              >
                <div className="overflow-hidden md:overflow-visible">
                  <div className="flex flex-col gap-6">
              {/* Estado cuando Emby no está conectado */}
              {!isEmbyConnected && (
                <div className="p-6 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-2">
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('connections.noEmbyLinked')}</p>
                </div>
              )}

              {/* Categorías de Emby a Monitorear */}
              {isEmbyConnected && (
                <div className="space-y-3 pt-2">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-[var(--text-primary)]">
                        <span>{t('connections.embyLibrariesToMonitor')}</span>
                        <span className="font-mono font-semibold text-[var(--text-muted)]">
                          {availableEmbyLibraries.length > 0
                            ? t('connections.librariesSelectedCount', { selected: selectedEmbyLibraries.length, total: availableEmbyLibraries.length })
                            : selectedEmbyLibraries.length > 0
                              ? t('connections.librariesSavedNoConnection', { count: selectedEmbyLibraries.length })
                              : ''}
                        </span>
                      </div>
                      <p className="text-[11.5px] text-[var(--text-secondary)]">{t('connections.embyLibrariesToMonitorDesc')}</p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleRefreshEmbyLibraries}
                        disabled={refreshingEmbyLibraries}
                        className="btn-secondary"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshingEmbyLibraries ? 'animate-spin' : ''}`} />
                        <span>{t('connections.refresh')}</span>
                      </button>

                      <button
                        onClick={handleSaveEmbyLibraries}
                        disabled={savingEmbyLibraries}
                        className="btn-primary"
                      >
                        {savingEmbyLibraries ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>{t('connections.saveSelection')}</span>
                      </button>
                    </div>
                  </div>

                  {/* Grid de Librerías */}
                  {availableEmbyLibraries.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 pt-1">
                      {availableEmbyLibraries.map((lib) => {
                        const isSelected = selectedEmbyLibraries.includes(lib.title);
                        return (
                          <div
                            key={lib.key || lib.title}
                            onClick={() => handleToggleEmbyLibrary(lib.title)}
                            className={`p-3.5 rounded-[6px] border cursor-pointer transition-all flex items-start gap-3 select-none ${
                              isSelected
                                ? 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] shadow-sm'
                                : 'border-[var(--border-subtle)] bg-[var(--bg-surface)] opacity-80 hover:opacity-100 hover:border-[var(--border-strong)]'
                            }`}
                          >
                            <div
                              className={`w-4 h-4 rounded-[4px] mt-0.5 flex items-center justify-center border transition-colors shrink-0 ${
                                isSelected
                                  ? 'bg-[var(--btn-primary-bg)] border-[var(--btn-primary-bg)] text-[var(--btn-primary-text)] font-bold'
                                  : 'border-[var(--border-strong)] bg-transparent'
                              }`}
                            >
                              {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                            </div>

                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className={`text-xs font-bold truncate ${isSelected ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}`}>
                                  {lib.title}
                                </span>
                                <span className="badge-pill">
                                  {lib.type === 'tvshows' ? 'SERIES TV' : 'LIBRERÍA'}
                                </span>
                              </div>
                              <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">
                                {lib.path || '/media/anime'}
                              </p>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center">
                      <p className="text-xs text-[var(--text-secondary)]">
                        {t('connections.noLibrariesDetected')}
                      </p>
                    </div>
                  )}

                  {/* Webhook Privado Box */}
                  <div className="p-4 rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-surface-elevated)] space-y-2 mt-4">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 font-semibold text-[var(--text-primary)]">
                        <Zap className="w-3.5 h-3.5 text-amber-400" />
                        <span>{t('connections.embyPrivateWebhookUrl')}</span>
                      </div>
                      <Link
                        href="/docs?section=emby"
                        className="text-[var(--brand-emby)] hover:underline text-xs flex items-center gap-1 font-medium"
                        title="Ver guía de Emby"
                      >
                        <BookOpen className="w-3 h-3" />
                        <span>{t('connections.webhookGuide')}</span>
                      </Link>
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={getDisplayEmbyWebhookUrl()}
                        className="flex-1 bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-[6px] px-3 py-2 text-xs font-mono text-[var(--text-primary)] outline-none select-all"
                      />
                      <button
                        onClick={copyEmbyWebhookUrl}
                        className="btn-secondary"
                      >
                        {copiedEmbyWebhook ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{copiedEmbyWebhook ? t('connections.copied') : t('connections.copy')}</span>
                      </button>
                    </div>

                    <p className="text-[11px] text-[var(--text-muted)]">{t('connections.embyWebhookHint')}</p>
                  </div>
                </div>
              )}
                  </div>
                </div>
              </div>
            </div>

            {/* 4. SECCIÓN: CUENTAS DE ANIME VINCULADAS */}
            <section className="space-y-4">
              {/* Cabecera Sección Anime */}
              <div className="space-y-1">
                <h2 className="text-base font-bold text-[var(--text-primary)] font-heading">{t('connections.linkedAnimeAccounts')}</h2>
                <p className="text-xs text-[var(--text-secondary)]">{t('connections.bothAtOnce')}</p>
              </div>

              {/* Grid con AniList, MyAnimeList y Kitsu lado a lado */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {/* 2.1 Tarjeta AniList */}
                <div className="glass-card card-sin-borde-movil p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isAnilistConnected && hubData?.anilist?.avatarUrl && !anilistAvatarError ? (
                          <img
                            src={hubData.anilist.avatarUrl}
                            alt="Avatar AniList"
                            onError={() => setAnilistAvatarError(true)}
                            className="w-11 h-11 rounded-[6px] object-cover border border-sky-400/40 shadow-sm shrink-0"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-[6px] flex items-center justify-center font-bold text-sm text-white shadow-sm shrink-0"
                            style={{ backgroundColor: isAnilistConnected ? 'var(--brand-anilist)' : 'var(--border-subtle)' }}
                          >
                            AL
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-primary)]">AniList (GraphQL API)</span>
                            {isAnilistConnected && (
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {hubData?.anilist?.lastLatencyMs || 10}ms
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-mono font-bold block ${
                              isAnilistConnected ? 'text-[var(--brand-anilist)]' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {isAnilistConnected
                              ? `@${hubData?.anilist?.remoteUsername || hubData?.anilist?.username || 'Usuario'}`
                              : '@Sin vincular'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${isAnilistConnected ? 'text-sky-400' : 'text-[var(--text-muted)]'}`}
                      />
                      <span>
                        {isAnilistConnected
                          ? t('connections.tokenValidId', { id: hubData?.anilist?.remoteUserId || t('connections.detecting') })
                          : t('connections.requiresAuth')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5">
                    {hubData?.anilist?.needsReconnection ? (
                      <span className="badge-pill bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-semibold">{t('connections.reconnectionRequired')}</span>
                    ) : (
                      <span className={isAnilistConnected ? 'badge-status-success' : 'badge-pill'}>
                        ● {isAnilistConnected ? t('connections.syncOk') : 'Inactivo'}
                      </span>
                    )}

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {isAnilistConnected && (
                        <button
                          onClick={handleDisconnectAnilist}
                          className="btn-danger text-xs"
                        >
                          {t('connections.disconnect')}
                        </button>
                      )}

                      <button
                        onClick={() => setShowAnilistModal(true)}
                        className={`text-xs ${
                          hubData?.anilist?.needsReconnection
                            ? 'btn-primary bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse shadow-md'
                            : 'btn-primary'
                        }`}
                      >
                        {hubData?.anilist?.needsReconnection
                          ? t('connections.reconnectNow')
                          : isAnilistConnected
                          ? t('connections.reauthenticate')
                          : t('connections.linkAniList')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2.2 Tarjeta MyAnimeList */}
                <div className="glass-card card-sin-borde-movil p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isMalConnected && hubData?.mal?.avatarUrl && !malAvatarError ? (
                          <img
                            src={hubData.mal.avatarUrl}
                            alt="Avatar MAL"
                            onError={() => setMalAvatarError(true)}
                            className="w-11 h-11 rounded-[6px] object-cover border border-indigo-400/40 shadow-sm shrink-0"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-[6px] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0"
                            style={{ backgroundColor: isMalConnected ? 'var(--brand-mal)' : 'var(--border-subtle)' }}
                          >
                            MAL
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-primary)]">MyAnimeList (REST v2)</span>
                            {isMalConnected && (
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {hubData?.mal?.lastLatencyMs || 10}ms
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-mono font-bold block ${
                              isMalConnected ? 'text-[var(--brand-mal)]' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {isMalConnected
                              ? `@${hubData?.mal?.remoteUsername || hubData?.mal?.username || 'Usuario'}`
                              : '@Sin vincular'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${isMalConnected ? 'text-indigo-400' : 'text-[var(--text-muted)]'}`}
                      />
                      <span>
                        {isMalConnected ? t('connections.tokenValidSession') : t('connections.requiresAuth')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5">
                    {hubData?.mal?.needsReconnection ? (
                      <span className="badge-pill bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-semibold">{t('connections.reconnectionRequired')}</span>
                    ) : (
                      <span className={isMalConnected ? 'badge-status-success' : 'badge-pill'}>
                        ● {isMalConnected ? t('connections.syncOk') : 'Inactivo'}
                      </span>
                    )}

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {isMalConnected && (
                        <button
                          onClick={handleDisconnectMal}
                          className="btn-danger text-xs"
                        >
                          {t('connections.disconnect')}
                        </button>
                      )}

                      <button
                        onClick={() => setShowMalModal(true)}
                        className={`text-xs ${
                          hubData?.mal?.needsReconnection
                            ? 'btn-primary bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse shadow-md'
                            : 'btn-primary'
                        }`}
                      >
                        {hubData?.mal?.needsReconnection
                          ? t('connections.reconnectNow')
                          : isMalConnected
                          ? t('connections.reauthenticate')
                          : t('connections.linkMal')}
                      </button>
                    </div>
                  </div>
                </div>

                {/* 2.3 Tarjeta Kitsu */}
                <div className="glass-card card-sin-borde-movil p-4 sm:p-5 space-y-4 flex flex-col justify-between">
                  <div className="space-y-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {isKitsuConnected && hubData?.kitsu?.avatarUrl ? (
                          <img
                            src={hubData.kitsu.avatarUrl}
                            alt="Avatar Kitsu"
                            className="w-11 h-11 rounded-[6px] object-cover border border-[#fd755c]/40 shadow-sm shrink-0"
                          />
                        ) : (
                          <div
                            className="w-11 h-11 rounded-[6px] flex items-center justify-center font-bold text-xs text-white shadow-sm shrink-0"
                            style={{ backgroundColor: isKitsuConnected ? '#fd755c' : 'var(--border-subtle)' }}
                          >
                            KT
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-[var(--text-primary)]">Kitsu (JSON:API v2)</span>
                            {isKitsuConnected && (
                              <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                {hubData?.kitsu?.lastLatencyMs || 15}ms
                              </span>
                            )}
                          </div>
                          <span
                            className={`text-xs font-mono font-bold block ${
                              isKitsuConnected ? 'text-[#fd755c]' : 'text-[var(--text-muted)]'
                            }`}
                          >
                            {isKitsuConnected
                              ? `@${hubData?.kitsu?.remoteUsername || hubData?.kitsu?.username || 'Usuario'}`
                              : '@Sin vincular'}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-[11px] font-mono text-[var(--text-muted)] flex items-center gap-1.5 pt-1">
                      <ShieldCheck
                        className={`w-3.5 h-3.5 ${isKitsuConnected ? 'text-[#fd755c]' : 'text-[var(--text-muted)]'}`}
                      />
                      <span>
                        {isKitsuConnected ? t('connections.tokenValidSync') : t('connections.requiresAuth')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--glass-border)] flex flex-wrap items-center justify-between gap-2.5">
                    {hubData?.kitsu?.needsReconnection ? (
                      <span className="badge-pill bg-rose-500/15 text-rose-400 border-rose-500/30 animate-pulse font-semibold">{t('connections.reconnectionRequired')}</span>
                    ) : (
                      <span className={isKitsuConnected ? 'badge-status-success' : 'badge-pill'}>
                        ● {isKitsuConnected ? t('connections.syncOk') : 'Inactivo'}
                      </span>
                    )}

                    <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
                      {isKitsuConnected && (
                        <button
                          onClick={handleDisconnectKitsu}
                          className="btn-danger text-xs"
                        >
                          {t('connections.disconnect')}
                        </button>
                      )}

                      <button
                        onClick={() => setShowKitsuModal(true)}
                        className={`text-xs ${
                          hubData?.kitsu?.needsReconnection
                            ? 'btn-primary bg-rose-600 hover:bg-rose-500 text-white font-bold animate-pulse shadow-md'
                            : 'btn-primary'
                        }`}
                      >
                        {hubData?.kitsu?.needsReconnection
                          ? t('connections.reconnectNow')
                          : isKitsuConnected
                          ? t('connections.reauthenticate')
                          : t('connections.linkKitsu')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* SECCIÓN COMPLEMENTARIA: PORTABILIDAD DE BIBLIOTECA (EXPORTAR & IMPORTAR) */}
            <div className="glass-card card-plana-movil px-0 py-5 sm:p-6 space-y-5">
              <div className="flex items-center gap-2.5">
                <FolderSync className="w-4 h-4 text-[var(--accent-text)]" />
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] font-heading">
                    {t('connections.libraryPortability')}
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">{t('connections.exportImportDesc')}</p>
                </div>
              </div>

              {/* ACCIONES DE EXPORTACIÓN */}
              <div className="space-y-3 pt-1">
                <span className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase font-mono tracking-wider">
                  {t('connections.exportWatched')}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <button
                    type="button"
                    onClick={() => handleExport('mal_xml')}
                    disabled={!!exportLoading}
                    className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-[#2e51a2] hover:bg-[var(--bg-surface-hover)] transition-all text-left space-y-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-[#2e51a2] flex items-center gap-1.5">
                        <FileCode className="w-3.5 h-3.5 text-[#2e51a2]" /> MAL XML
                      </span>
                      {exportLoading === 'mal_xml' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                      )}
                    </div>
                    <p className="text-[10.5px] text-[var(--text-muted)] leading-tight">{t('connections.xmlCompatible')}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('json')}
                    disabled={!!exportLoading}
                    className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-amber-400/50 hover:bg-[var(--bg-surface-hover)] transition-all text-left space-y-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-amber-400 flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-amber-400" /> JSON
                      </span>
                      {exportLoading === 'json' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                      )}
                    </div>
                    <p className="text-[10.5px] text-[var(--text-muted)] leading-tight">{t('connections.jsonCompatible')}</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleExport('csv')}
                    disabled={!!exportLoading}
                    className="p-3.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-emerald-400/50 hover:bg-[var(--bg-surface-hover)] transition-all text-left space-y-1 group cursor-pointer"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)] group-hover:text-emerald-400 flex items-center gap-1.5">
                        <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> CSV
                      </span>
                      {exportLoading === 'csv' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--text-muted)]" />
                      ) : (
                        <Download className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)]" />
                      )}
                    </div>
                    <p className="text-[10.5px] text-[var(--text-muted)] leading-tight">{t('connections.csvCompatible')}</p>
                  </button>
                </div>
              </div>

              {/* ACCIONES DE IMPORTACIÓN */}
              <div className="space-y-3 pt-3 border-t border-[var(--border-subtle)]">
                <span className="block text-[11px] font-bold text-[var(--text-secondary)] uppercase font-mono tracking-wider">
                  {t('connections.importHistory')}
                </span>
                
                <input
                  ref={importFileRef}
                  type="file"
                  accept=".xml,.json,.csv,text/xml,application/json,text/csv"
                  onChange={handleImportFile}
                  className="hidden"
                />

                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <button
                    type="button"
                    onClick={() => importFileRef.current?.click()}
                    disabled={importLoading}
                    className="btn-secondary w-full sm:w-auto px-4 py-2.5 text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {importLoading ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Upload className="w-3.5 h-3.5" />
                    )}
                    <span>{t('connections.uploadAnimeFile')}</span>
                  </button>
                  <span className="text-[11px] text-[var(--text-muted)] text-center sm:text-left">{t('connections.acceptsOfficialExports')}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* MODALS */}
      {showPlexModal && (
        <PlexPinModal
          isOpen={showPlexModal}
          onClose={() => setShowPlexModal(false)}
          onSuccess={() => {
            setShowPlexModal(false);
            loadHubData(true);
            showToast(t('connections.plexLinked'), 'success');
          }}
        />
      )}

      {showServerModal && (
        <PlexServerModal
          isOpen={showServerModal}
          onClose={() => setShowServerModal(false)}
          onSuccess={() => {
            setShowServerModal(false);
            loadHubData(true);
          }}
          currentServerName={hubData?.plex?.serverName}
          currentServerUrl={hubData?.plex?.serverUrl}
        />
      )}

      {showJellyfinModal && (
        <JellyfinModal
          isOpen={showJellyfinModal}
          onClose={() => setShowJellyfinModal(false)}
          onSuccess={() => {
            setShowJellyfinModal(false);
            loadHubData(true);
          }}
        />
      )}

      {showEmbyModal && (
        <EmbyModal
          isOpen={showEmbyModal}
          onClose={() => setShowEmbyModal(false)}
          onSuccess={() => {
            setShowEmbyModal(false);
            loadHubData(true);
          }}
        />
      )}

      {showAnilistModal && (
        <AniListModal
          isOpen={showAnilistModal}
          onClose={() => setShowAnilistModal(false)}
          onSuccess={() => {
            setShowAnilistModal(false);
            loadHubData(true);
            showToast(t('connections.aniListLinked'), 'success');
          }}
        />
      )}

      {showMalModal && (
        <MalModal
          isOpen={showMalModal}
          onClose={() => setShowMalModal(false)}
          onSuccess={() => {
            setShowMalModal(false);
            loadHubData(true);
            showToast(t('connections.malLinked'), 'success');
          }}
        />
      )}

      {showKitsuModal && (
        <KitsuModal
          isOpen={showKitsuModal}
          onClose={() => setShowKitsuModal(false)}
          onSuccess={() => {
            setShowKitsuModal(false);
            loadHubData(true);
            showToast(t('connections.kitsuLinked'), 'success');
          }}
        />
      )}

      {showTesterModal && (
        <ScrobbleTesterModal
          isOpen={showTesterModal}
          onClose={() => setShowTesterModal(false)}
          onSuccess={() => {
            setShowTesterModal(false);
            loadHubData(true);
          }}
        />
      )}
    </div>
  );
}
