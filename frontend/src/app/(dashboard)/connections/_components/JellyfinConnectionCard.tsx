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

interface JellyfinConnectionCardProps {
  hubData: any;
  isJellyfinConnected: boolean;
  openServers: Record<string, boolean>;
  setOpenServers: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
  setShowJellyfinModal: (show: boolean) => void;
  loadHubData: (silent?: boolean) => Promise<void>;
  availableJellyfinLibraries: any[];
  selectedJellyfinLibraries: string[];
  refreshingJellyfinLibraries: boolean;
  savingJellyfinLibraries: boolean;
  handleRefreshJellyfinLibraries: () => void;
  handleSaveJellyfinLibraries: () => void;
  handleToggleJellyfinLibrary: (titleOrId: string) => void;
}

export function JellyfinConnectionCard({
  hubData,
  isJellyfinConnected,
  openServers,
  setOpenServers,
  setShowJellyfinModal,
  loadHubData,
  availableJellyfinLibraries,
  selectedJellyfinLibraries,
  refreshingJellyfinLibraries,
  savingJellyfinLibraries,
  handleRefreshJellyfinLibraries,
  handleSaveJellyfinLibraries,
  handleToggleJellyfinLibrary,
}: JellyfinConnectionCardProps) {
  const { showToast } = useToast();
  const { t } = useI18n();
  const [copiedJellyfinWebhook, setCopiedJellyfinWebhook] = useState(false);

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

  return (
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

        {/* Collapsed on mobile: when card is closed only name
            and status are needed; buttons are part of expanded content,
            and uncollapsed they wrapped into two disjointed rows. */}
        <div
          className={`grid grid-cols-2 md:flex md:items-center gap-2 md:gap-2.5 md:flex-wrap ${
            openServers.jellyfin ? 'grid' : 'hidden'
          }`}
        >
          <Link
            href="/docs?section=jellyfin"
            className="btn-secondary text-xs"
            title={t('connections.jellyfinGuideWebhook')}
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

      {/* On mobile body collapses; button describes action. */}
      <button
        type="button"
        onClick={() =>
          setOpenServers((prev) => ({ ...prev, jellyfin: !prev.jellyfin }))
        }
        aria-expanded={!!openServers.jellyfin}
        className="md:hidden -mt-0.5 w-full flex items-center justify-center gap-1.5 py-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-surface)] text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
      >
        <span>
          {openServers.jellyfin
            ? t('connections.hideDetails')
            : t('connections.showDetails')}
        </span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${
            openServers.jellyfin ? 'rotate-180' : ''
          }`}
          aria-hidden="true"
        />
      </button>

      {/* Collapse animates via grid row height: from 0fr to 1fr.
          Only way to animate to intrinsic content height without
          hardcoded measurements, which vary depending on library count.
          On desktop container reverts to normal block without animation. */}
      <div
        className={`grid md:block transition-[grid-template-rows,margin-top] duration-300 ease-out ${
          openServers.jellyfin
            ? 'grid-rows-[1fr]'
            : 'grid-rows-[0fr] -mt-3.5 md:mt-0'
        }`}
      >
        <div className="overflow-hidden md:overflow-visible">
          <div className="flex flex-col gap-6">
      {/* State when Jellyfin is not connected */}
      {!isJellyfinConnected && (
        <div className="p-6 rounded-[6px] border border-dashed border-[var(--border-subtle)] bg-[var(--bg-surface)] text-center space-y-2">
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">{t('connections.noJellyfinLinked')}</p>
        </div>
      )}

      {/* Jellyfin Categories to Monitor */}
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

          {/* Libraries Grid */}
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
                          {['show', 'tvshows'].includes(lib.type) ? t('connections.badgeSeriesTv') : ['movie', 'movies'].includes(lib.type) ? t('connections.badgeMovies') : t('connections.badgeLibrary')}
                        </span>
                      </div>
                      {lib.path && (
                        <p className="text-[10px] text-[var(--text-muted)] font-mono truncate">{lib.path}</p>
                      )}
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
                title={t('connections.viewJellyfinGuide')}
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
  );
}
