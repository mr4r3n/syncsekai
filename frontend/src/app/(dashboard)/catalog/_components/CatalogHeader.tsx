'use client';

import { useI18n } from '@/i18n/I18nProvider';
import { CustomSelect } from '@/components/CustomSelect';
import {
  Search,
  X,
  RefreshCw,
  List,
  LayoutGrid,
} from 'lucide-react';

interface CatalogHeaderProps {
  catalogResponse: any;
  selectedTracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL';
  setSelectedTracker: (tracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL') => void;
  pagination: any;
  vistaCatalogo: 'grid' | 'list';
  alternarVista: () => void;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  handleRefresh: () => void;
  refreshing: boolean;
  loading: boolean;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  setCurrentPage: (page: number) => void;
  isAnilistActive: boolean;
  isMalActive: boolean;
  isKitsuActive: boolean;
}

export function CatalogHeader({
  catalogResponse,
  selectedTracker,
  setSelectedTracker,
  pagination,
  vistaCatalogo,
  alternarVista,
  searchQuery,
  setSearchQuery,
  handleRefresh,
  refreshing,
  loading,
  statusFilter,
  setStatusFilter,
  setCurrentPage,
  isAnilistActive,
  isMalActive,
  isKitsuActive,
}: CatalogHeaderProps) {
  const { t } = useI18n();

  const handleTrackerChange = (tracker: 'ANILIST' | 'MAL' | 'KITSU' | 'LOCAL') => {
    setSelectedTracker(tracker);
    if (typeof window !== 'undefined') {
      /*
       * "Local" no se recuerda entre visitas, y los trackers si.
       *
       * Local no es un destino, es lo que queda cuando no hay tracker
       * vinculado, o un vistazo puntual a lo que hay en la base sin pasar por
       * nadie. Guardado como preferencia se quedaba fijo para siempre: quien lo
       * hubiera pulsado una vez -o quien lo tuviera de cuando aun no habia
       * vinculado nada- entraba al catalogo en Local aunque tuviera AniList
       * conectado, y sin ninguna pista de que eso era una eleccion suya y no un
       * fallo de deteccion. Al no guardarlo, la siguiente visita vuelve al
       * tracker, que es lo que espera cualquiera.
       */
      if (tracker === 'LOCAL') {
        localStorage.removeItem('plexsync_catalog_tracker');
      } else {
        localStorage.setItem('plexsync_catalog_tracker', tracker);
      }
      const url = new URL(window.location.href);
      url.searchParams.set('tracker', tracker);
      window.history.replaceState({}, '', url.toString());
    }
  };

  // Rejilla: 2 -> 3 -> 4 -> 5 -> 6 -> 8 columnas segun el ancho.
  // El nombre de la cuenta del catalogo, que se pinta en dos sitios segun el
  // ancho: una sola fuente para las dos.
  const nombreCuentaCatalogo =
    catalogResponse?.username ||
    (selectedTracker === 'MAL'
      ? 'MyAnimeList'
      : selectedTracker === 'KITSU'
      ? 'Kitsu'
      : selectedTracker === 'LOCAL'
      ? t('catalog.localTracker')
      : 'AniList');

  const handleStatusChange = (newStatus: string) => {
    setStatusFilter(newStatus);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('plexsync_catalog_page', '1');
      localStorage.setItem('plexsync_catalog_status_filter', newStatus);
      const url = new URL(window.location.href);
      url.searchParams.set('status', newStatus);
      url.searchParams.set('page', '1');
      window.history.replaceState({}, '', url.toString());
    }
  };

  const counts = catalogResponse?.counts || {
    all: 0,
    watching: 0,
    completed: 0,
    planning: 0,
    paused: 0,
    dropped: 0,
  };

  return (
    <div className="relative sm:sticky sm:top-16 z-20 w-full px-4 sm:px-6 md:px-8 py-3.5 sm:py-4 border-b border-[var(--glass-border)] bg-[var(--glass-bg)] backdrop-blur-xl shadow-sm space-y-3 sm:space-y-4 transition-all">
      <div className="w-full space-y-3 sm:space-y-4">
        {/* Título, Perfil & Buscador */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4">
          <div className="space-y-1 w-full lg:flex-1 min-w-0">
            {/* Titulo a la izquierda y la cuenta al otro extremo: son dos
                cosas distintas -donde estas y con que cuenta- y pegadas
                parecian una sola etiqueta larga. */}
            <div className="flex items-center justify-between gap-3 w-full">
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary)] font-heading min-w-0 truncate">
                {t('catalog.title')}
              </h1>

              {/* En lg la cabecera se pone en una fila y esta pastilla queda
                  justo a la izquierda de los controles, pero alineada con el
                  titulo: dos dedos mas arriba que todo lo que tiene al lado.
                  Ahi se pinta dentro del grupo de controles, que es donde se
                  centra con ellos; por debajo de lg sigue en la linea del
                  titulo, que es donde hace falta. */}
              {catalogResponse?.connected && (
                <span className="lg:hidden badge-pill text-[var(--text-primary)] text-[11px] shrink-0">
                  ● @{nombreCuentaCatalogo}
                </span>
              )}
            </div>

            {/*
              Oculto en móvil: en 375px los controles ocupaban el 44% de la pantalla
              antes del primer anime. Este texto repite datos que ya están a la vista
              —el total aparece en la pestaña "Todos (N)" y el tracker en las píldoras
              de abajo—, así que es la línea que menos cuesta recuperar.
            */}
            <p className="hidden sm:block text-xs text-[var(--text-secondary)]">
              {catalogResponse?.connected
                ? t('catalog.syncedLiveFrom', {
                    n: pagination.totalItems || counts.all,
                    tracker: selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? t('catalog.localBase') : 'AniList',
                  })
                : t('catalog.linkInHubHint')}
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {catalogResponse?.connected && (
              <span className="hidden lg:inline-flex badge-pill text-[var(--text-primary)] text-[11px] shrink-0">
                ● @{nombreCuentaCatalogo}
              </span>
            )}
            {/* Un solo boton que alterna rejilla y lista.
                Ensena el icono de la vista a la que vas, no la que tienes:
                un boton dice que hace al pulsarlo. */}
            <button
              type="button"
              onClick={alternarVista}
              title={vistaCatalogo === 'grid' ? t('catalog.viewAsList') : t('catalog.viewAsGrid')}
              aria-label={vistaCatalogo === 'grid' ? t('catalog.viewAsList') : t('catalog.viewAsGrid')}
              className="btn-secondary text-xs px-2.5 py-1.5 sm:py-2 shrink-0 order-last sm:order-none"
            >
              {vistaCatalogo === 'grid' ? (
                <List className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              ) : (
                <LayoutGrid className="w-3.5 h-3.5 text-[var(--accent-text)]" aria-hidden="true" />
              )}
            </button>

            {/* Buscador y refresco en la misma fila. */}
            <label className="flex-1 min-w-0 sm:flex-initial flex items-center gap-2 px-3 py-1.5 sm:py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] backdrop-blur-md text-xs sm:min-w-[140px] cursor-text focus-within:border-[var(--border-focus)]">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] shrink-0" />
              <input
                suppressHydrationWarning
                type="text"
                autoComplete="off"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('catalog.searchPlaceholder')}
                className="bg-transparent outline-none text-xs w-full sm:w-56 lg:w-72 xl:w-80 text-[var(--text-primary)]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="Limpiar búsqueda"
                  className="shrink-0 w-6 h-6 flex items-center justify-center rounded text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                >
                  <X className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              )}
            </label>

            {/* Botón Refrescar */}
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading || !catalogResponse?.connected}
              className="btn-secondary text-xs px-2.5 sm:px-3 py-1.5 sm:py-2"
              title={`Sincronizar ahora con ${selectedTracker === 'MAL' ? 'MyAnimeList' : selectedTracker === 'KITSU' ? 'Kitsu' : selectedTracker === 'LOCAL' ? 'Base Local' : 'AniList'}`}
            >
              <RefreshCw className={`w-3.5 h-3.5 text-[var(--accent-text)] ${refreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline font-semibold">{refreshing ? t('catalog.refreshing') : t('catalog.refresh')}</span>
            </button>
          </div>
        </div>

        {/* FILA 2: estado a la izquierda, tracker a la derecha.

            En escritorio son pildoras, que dejan ver de un golpe todos los
            estados con sus cuentas. En movil eso eran dos filas enteras de la
            cabecera -y la de estados ni siquiera cabia, se cortaba a media
            palabra-, asi que ahi se convierten en dos desplegables que
            comparten una sola fila.

            Las listas se declaran una vez y las usan las dos vistas: antes
            eran seis botones copiados con el texto en castellano escrito a
            mano y cuatro pestanas mas al lado. */}
        {catalogResponse?.connected && (() => {
          const estados = [
            { id: 'ALL', etiqueta: t('catalog.filterAll'), cuenta: counts.all, activo: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'CURRENT', etiqueta: t('catalog.filterWatching'), cuenta: counts.watching, activo: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'COMPLETED', etiqueta: t('catalog.filterCompleted'), cuenta: counts.completed, activo: 'border-[var(--status-success)]/30 bg-[var(--status-success-bg)] text-[var(--status-success)]' },
            { id: 'PLANNING', etiqueta: t('catalog.filterPlanning'), cuenta: counts.planning, activo: 'border-[var(--nav-active-border)] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)]' },
            { id: 'PAUSED_DROPPED', etiqueta: t('catalog.filterPausedDropped'), cuenta: (counts.paused || 0) + (counts.dropped || 0), activo: 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]' },
            { id: 'FAVORITES', etiqueta: t('catalog.filterFavorites'), cuenta: counts.favorites, activo: 'border-[var(--status-warning)]/30 bg-[var(--status-warning-bg)] text-[var(--status-warning)]' },
          ];

          const trackers = [
            { id: 'LOCAL', nombre: t('catalog.localLibrary'), punto: 'bg-[var(--text-muted)]', activo: 'bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border-[var(--nav-active-border)]', conectado: true },
            { id: 'ANILIST', nombre: 'AniList', punto: 'bg-[var(--brand-anilist)]', activo: 'bg-sky-500/15 text-sky-600 dark:text-sky-300 border-sky-500/30', conectado: isAnilistActive },
            { id: 'MAL', nombre: 'MAL', punto: 'bg-[var(--brand-mal)]', activo: 'bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 border-indigo-500/30', conectado: isMalActive },
            { id: 'KITSU', nombre: 'Kitsu', punto: 'bg-[var(--brand-kitsu)]', activo: 'bg-[var(--brand-kitsu)]/15 text-[var(--brand-kitsu)] border-[var(--brand-kitsu)]/30', conectado: isKitsuActive },
          ];

          const punto = (clase: string) => (
            <span className={`w-2 h-2 rounded-full shrink-0 ${clase}`} />
          );

          const desplegableEstado = (
            <CustomSelect
              value={statusFilter}
              onChange={(v: string) => handleStatusChange(v)}
              options={estados.map((e) => ({
                value: e.id,
                label: e.etiqueta,
                badge: String(e.cuenta ?? 0),
              }))}
            />
          );

          const pastillasTrackers = (
            <div
              role="tablist"
              aria-label={t('catalog.selectProvider')}
              className="inline-flex items-center p-1 rounded-[var(--radius-md)] bg-[var(--bg-surface)] border border-[var(--border-subtle)] gap-1 shrink-0"
            >
              {trackers.map((tr) => {
                const seleccionado = selectedTracker === tr.id;
                return (
                  <button
                    key={tr.id}
                    type="button"
                    role="tab"
                    aria-selected={seleccionado}
                    disabled={!tr.conectado}
                    onClick={() => handleTrackerChange(tr.id as any)}
                    title={tr.conectado ? tr.nombre : t('catalog.trackerNotLinked', { tracker: tr.nombre })}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-[var(--radius-xs)] text-xs font-semibold border transition-colors select-none ${
                      !tr.conectado
                        ? 'border-transparent text-[var(--text-muted)] opacity-40 cursor-not-allowed'
                        : seleccionado
                        ? `${tr.activo} shadow-xs font-bold cursor-pointer`
                        : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] cursor-pointer'
                    }`}
                  >
                    {punto(tr.punto)}
                    <span>{tr.nombre}</span>
                  </button>
                );
              })}
            </div>
          );

          return (
            <>
              {/* MOVIL: dos desplegables en una fila */}
              <div className="grid grid-cols-2 gap-2 sm:hidden pt-0.5">
                {desplegableEstado}
                <CustomSelect
                  value={selectedTracker}
                  onChange={(v: string) => handleTrackerChange(v as any)}
                  options={trackers.map((tr) => ({
                    value: tr.id,
                    label: tr.nombre,
                    icon: punto(tr.punto),
                    disabled: !tr.conectado,
                    disabledReason: t('catalog.trackerNotLinked', { tracker: tr.nombre }),
                  }))}
                />
              </div>

              {/* TABLET: los seis estados no caben en pastillas al lado del
                  grupo de trackers -se cortaban a media palabra-, asi que aqui
                  el estado es un desplegable y los trackers se quedan como
                  estan, que si caben. */}
              <div className="hidden sm:flex lg:hidden items-center justify-between gap-2.5 pt-0.5">
                <div className="w-[220px] shrink-0">{desplegableEstado}</div>
                {pastillasTrackers}
              </div>

              {/* ESCRITORIO: todo en pildoras */}
              <div className="hidden lg:flex lg:items-center justify-between gap-2.5 pt-0.5">
                {/* Una tira que se desplaza, no seis pastillas que envuelven.
                    A 768 px los seis estados se partian en tres lineas y el
                    grupo de trackers quedaba encajado en medio, con
                    "Favoritos" solo en la tercera. Sin envolver, la cabecera
                    mide siempre lo mismo y los estados se recorren de lado. */}
                <div
                  role="tablist"
                  aria-label={t('catalog.filterByStatus')}
                  className="flex items-center gap-1.5 flex-nowrap overflow-x-auto no-scrollbar min-w-0 flex-1 text-xs -mx-1 px-1"
                >
                  {estados.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      role="tab"
                      aria-selected={statusFilter === e.id}
                      onClick={() => handleStatusChange(e.id)}
                      className={`px-3 py-1.5 rounded-[var(--radius-md)] font-semibold border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                        statusFilter === e.id
                          ? `${e.activo} font-bold shadow-sm`
                          : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)]'
                      }`}
                    >
                      {e.etiqueta} ({e.cuenta ?? 0})
                    </button>
                  ))}
                </div>

                {pastillasTrackers}
              </div>
            </>
          );
        })()}
      </div>
    </div>
  );
}
