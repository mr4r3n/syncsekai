'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { Topbar } from '@/components/Topbar';
import { useSidebar } from '@/components/SidebarProvider';
import { useI18n } from '@/i18n/I18nProvider';
import { Loader2 } from 'lucide-react';
import { ConnectionsHeader } from './_components/ConnectionsHeader';
import { ConnectionsReauthBanner } from './_components/ConnectionsReauthBanner';
import { PlexConnectionCard } from './_components/PlexConnectionCard';
import { JellyfinConnectionCard } from './_components/JellyfinConnectionCard';
import { EmbyConnectionCard } from './_components/EmbyConnectionCard';
import { AnimeTrackersSection } from './_components/AnimeTrackersSection';
import { LibraryPortabilityCard } from './_components/LibraryPortabilityCard';
import { ConnectionsModals } from './_components/ConnectionsModals';

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

  // Selección de librerías de Jellyfin (estado propio, misma forma que el de Plex)
  const [availableJellyfinLibraries, setAvailableJellyfinLibraries] = useState<any[]>([]);
  const [selectedJellyfinLibraries, setSelectedJellyfinLibraries] = useState<string[]>([]);
  const [savingJellyfinLibraries, setSavingJellyfinLibraries] = useState(false);

  // Selección de librerías de Emby (estado propio, misma forma que el de Jellyfin)
  const [availableEmbyLibraries, setAvailableEmbyLibraries] = useState<any[]>([]);
  const [selectedEmbyLibraries, setSelectedEmbyLibraries] = useState<string[]>([]);
  const [savingEmbyLibraries, setSavingEmbyLibraries] = useState(false);

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
      <ConnectionsHeader
        activeServicesCount={activeServicesCount}
        setShowTesterModal={setShowTesterModal}
        handleHealthCheck={handleHealthCheck}
        isRefreshing={isRefreshing}
        loading={loading}
      />

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
              <ConnectionsReauthBanner hubData={hubData} />
            )}

            {/* 1. CARD: PLEX MEDIA SERVER */}
            <PlexConnectionCard
              hubData={hubData}
              isPlexConnected={isPlexConnected}
              servidoresAbiertos={servidoresAbiertos}
              setServidoresAbiertos={setServidoresAbiertos}
              setShowServerModal={setShowServerModal}
              setShowPlexModal={setShowPlexModal}
              loadHubData={loadHubData}
              availableLibraries={availableLibraries}
              selectedLibraries={selectedLibraries}
              refreshingLibraries={refreshingLibraries}
              savingLibraries={savingLibraries}
              handleRefreshLibraries={handleRefreshLibraries}
              handleSaveLibraries={handleSaveLibraries}
              handleToggleLibrary={handleToggleLibrary}
              setShowTesterModal={setShowTesterModal}
            />

            {/* 2. CARD: JELLYFIN MEDIA SERVER */}
            <JellyfinConnectionCard
              hubData={hubData}
              isJellyfinConnected={isJellyfinConnected}
              servidoresAbiertos={servidoresAbiertos}
              setServidoresAbiertos={setServidoresAbiertos}
              setShowJellyfinModal={setShowJellyfinModal}
              loadHubData={loadHubData}
              availableJellyfinLibraries={availableJellyfinLibraries}
              selectedJellyfinLibraries={selectedJellyfinLibraries}
              refreshingJellyfinLibraries={refreshingJellyfinLibraries}
              savingJellyfinLibraries={savingJellyfinLibraries}
              handleRefreshJellyfinLibraries={handleRefreshJellyfinLibraries}
              handleSaveJellyfinLibraries={handleSaveJellyfinLibraries}
              handleToggleJellyfinLibrary={handleToggleJellyfinLibrary}
            />

            {/* 3. CARD: EMBY MEDIA SERVER */}
            <EmbyConnectionCard
              hubData={hubData}
              isEmbyConnected={isEmbyConnected}
              servidoresAbiertos={servidoresAbiertos}
              setServidoresAbiertos={setServidoresAbiertos}
              setShowEmbyModal={setShowEmbyModal}
              loadHubData={loadHubData}
              availableEmbyLibraries={availableEmbyLibraries}
              selectedEmbyLibraries={selectedEmbyLibraries}
              refreshingEmbyLibraries={refreshingEmbyLibraries}
              savingEmbyLibraries={savingEmbyLibraries}
              handleRefreshEmbyLibraries={handleRefreshEmbyLibraries}
              handleSaveEmbyLibraries={handleSaveEmbyLibraries}
              handleToggleEmbyLibrary={handleToggleEmbyLibrary}
            />

            {/* 4. SECCIÓN: CUENTAS DE ANIME VINCULADAS */}
            <AnimeTrackersSection
              hubData={hubData}
              isAnilistConnected={isAnilistConnected}
              isMalConnected={isMalConnected}
              isKitsuConnected={isKitsuConnected}
              setShowAnilistModal={setShowAnilistModal}
              setShowMalModal={setShowMalModal}
              setShowKitsuModal={setShowKitsuModal}
              loadHubData={loadHubData}
            />

            {/* SECCIÓN COMPLEMENTARIA: PORTABILIDAD DE BIBLIOTECA (EXPORTAR & IMPORTAR) */}
            <LibraryPortabilityCard loadHubData={loadHubData} />
          </div>
        )}
      </main>

      <ConnectionsModals
        hubData={hubData}
        loadHubData={loadHubData}
        showPlexModal={showPlexModal}
        setShowPlexModal={setShowPlexModal}
        showServerModal={showServerModal}
        setShowServerModal={setShowServerModal}
        showJellyfinModal={showJellyfinModal}
        setShowJellyfinModal={setShowJellyfinModal}
        showEmbyModal={showEmbyModal}
        setShowEmbyModal={setShowEmbyModal}
        showAnilistModal={showAnilistModal}
        setShowAnilistModal={setShowAnilistModal}
        showMalModal={showMalModal}
        setShowMalModal={setShowMalModal}
        showKitsuModal={showKitsuModal}
        setShowKitsuModal={setShowKitsuModal}
        showTesterModal={showTesterModal}
        setShowTesterModal={setShowTesterModal}
      />
    </div>
  );
}
