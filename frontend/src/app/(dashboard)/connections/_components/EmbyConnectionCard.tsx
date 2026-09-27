'use client';

import { useState } from 'react';
import Link from 'next/link';
import { api } from '@/lib/api';
import { useToast } from '@/components/ToastProvider';
import { useI18n } from '@/i18n/I18nProvider';
import {
  BookOpen,
  KeyRound,
  Unplug,
  ChevronDown,
  RefreshCw,
  Check,
  Loader2,
  Zap,
  Copy,
} from 'lucide-react';

interface EmbyConnectionCardProps {
  hubData: any;
  isEmbyConnected: boolean;
  servidoresAbiertos: Record<string, boolean>;
  setServidoresAbiertos: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setShowEmbyModal: (show: boolean) => void;
  loadHubData: (silent?: boolean) => Promise<void>;
  availableEmbyLibraries: any[];
  selectedEmbyLibraries: string[];
  refreshingEmbyLibraries: boolean;
  savingEmbyLibraries: boolean;
  handleRefreshEmbyLibraries: () => void;
  handleSaveEmbyLibraries: () => void;
  handleToggleEmbyLibrary: (titleOrId: string) => void;
}

export function EmbyConnectionCard({
  hubData,
  isEmbyConnected,
  servidoresAbiertos,
  setServidoresAbiertos,
  setShowEmbyModal,
  loadHubData,
  availableEmbyLibraries,
  selectedEmbyLibraries,
  refreshingEmbyLibraries,
  savingEmbyLibraries,
  handleRefreshEmbyLibraries,
  handleSaveEmbyLibraries,
  handleToggleEmbyLibrary,
}: EmbyConnectionCardProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [copiedEmbyWebhook, setCopiedEmbyWebhook] = useState(false);

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

  return (
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
  );
}
