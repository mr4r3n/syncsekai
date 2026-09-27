'use client';

import React, { useState } from 'react';
import {
  Unlink,
  Link as LinkIcon,
  X,
  Eye,
  ExternalLink,
  Check,
  Copy,
  Loader2,
  RotateCw,
  Trash2,
  Info,
} from 'lucide-react';
import { api } from '@/lib/api';
import type { MediaItem } from './types';

interface MediaInspectorDrawerProps {
  selectedItem: MediaItem | null;
  setSelectedItem: (item: MediaItem | null) => void;
  loadMedia: () => Promise<void>;
  showToast: (message: string, type?: 'success' | 'warning' | 'error' | 'info') => void;
  handleDeleteClick: (item: MediaItem) => void;
  t: (key: string, values?: any) => string;
}

export function MediaInspectorDrawer({
  selectedItem,
  setSelectedItem,
  loadMedia,
  showToast,
  handleDeleteClick,
  t,
}: MediaInspectorDrawerProps) {
  const [isRefreshingItem, setIsRefreshingItem] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Acciones en Medios
  const handleRefreshCover = async (item: MediaItem) => {
    try {
      setIsRefreshingItem(true);
      const res = await api.admin.refreshMedia(item.filename);
      showToast(res.message || t('admin.coverRefreshed'), 'success');
      await loadMedia();
    } catch (err: any) {
      showToast(`${t('admin.refreshCoverError')} ` + err.message, 'error');
    } finally {
      setIsRefreshingItem(false);
    }
  };

  const handleCopyUrl = (url: string) => {
    const fullUrl = typeof window !== 'undefined' ? `${window.location.origin}${url}` : url;
    navigator.clipboard.writeText(fullUrl);
    setCopiedUrl(url);
    showToast(t('admin.linkCopied'), 'info');
    setTimeout(() => setCopiedUrl(null), 2000);
  };
  return (
    <>
      {/* ANIMATED SIDE DRAWER WITH FULL METADATA (ENGLISH / ROMAJI / PLEX / TRACKERS) */}
      {selectedItem && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 transition-opacity duration-300 animate-in fade-in cursor-pointer"
          onClick={() => setSelectedItem(null)}
        />
      )}

      <div
        className={`fixed inset-y-0 right-0 z-50 w-full sm:w-[460px] bg-[var(--bg-surface-elevated)] border-l border-[var(--border-subtle)] shadow-2xl p-6 flex flex-col justify-between overflow-y-auto transform transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          selectedItem ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
      >
        {selectedItem && (
          <div className="space-y-5">
            {/* Viewer Header */}
            <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-3">
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-xs uppercase tracking-wider text-[var(--text-secondary)] font-mono flex items-center gap-2">
                  <Info className="w-4 h-4 text-sky-400" />
                  <span>{t('admin.coverInspection')}</span>
                </h3>
                {selectedItem.isOrphan ? (
                  <span className="px-2 py-0.5 rounded-[4px] bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <Unlink className="w-3 h-3" />{t('admin.orphan')}</span>
                ) : (
                  <span className="px-2 py-0.5 rounded-[4px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-mono font-bold flex items-center gap-1">
                    <LinkIcon className="w-3 h-3" />
                    {t('admin.inUseCount', { count: selectedItem.usageCount || 1 })}
                  </span>
                )}
              </div>

              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 rounded-[6px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-surface-hover)] transition-colors cursor-pointer"
                title={t('admin.closePanelEsc')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Full Uncropped Preview */}
            <div className="relative w-full h-80 rounded-[8px] overflow-hidden border border-[var(--border-subtle)] bg-black/60 flex items-center justify-center p-3 group shadow-inner">
              <img
                src={selectedItem.url}
                alt={selectedItem.titleEnglish || selectedItem.titleRomaji || selectedItem.filename}
                className="max-h-full max-w-full w-auto h-auto object-contain rounded-[4px] shadow-lg transition-transform duration-300 group-hover:scale-105"
              />
              <a
                href={selectedItem.url}
                target="_blank"
                rel="noreferrer"
                className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 text-white text-xs font-semibold backdrop-blur-xs"
              >
                <Eye className="w-4 h-4" />
                <span>{t('admin.openAtOriginalSize')}</span>
              </a>
            </div>

            {/* Metadatos de Anime Enriquecidos */}
            <div className="space-y-3.5 text-xs">
              {/* English Title */}
              {selectedItem.titleEnglish && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono text-[var(--text-muted)]">
                    <span>{t('admin.englishTitle')}</span>
                    <span className="text-sky-400 font-bold">EN</span>
                  </div>
                  <div className="font-heading font-bold text-sm text-[var(--text-primary)] bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                    {selectedItem.titleEnglish}
                  </div>
                </div>
              )}

              {/* Romaji Title */}
              {selectedItem.titleRomaji && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-[10px] uppercase font-mono text-[var(--text-muted)]">
                    <span>{t('admin.romajiTitle')}</span>
                    <span className="text-purple-400 font-bold">ROMAJI</span>
                  </div>
                  <div className="font-sans font-semibold text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                    {selectedItem.titleRomaji}
                  </div>
                </div>
              )}

              {/* Associated Plex Titles */}
              {selectedItem.plexTitles && selectedItem.plexTitles.length > 0 && (
                <div className="space-y-1.5">
                  <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">{t('admin.linkedPlexTitles')}</span>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedItem.plexTitles.map((pt, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-1 rounded-[4px] bg-[#e5a00d]/10 text-[#e5a00d] border border-[#e5a00d]/30 font-mono text-[11px] font-semibold flex items-center gap-1"
                      >
                        <span>🎬</span>
                        <span>{pt}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Identificadores en Trackers (AniList & MAL) */}
              {(selectedItem.anilistId || selectedItem.malId) && (
                <div className="grid grid-cols-2 gap-2.5 pt-1">
                  {selectedItem.anilistId && (
                    <a
                      href={`https://anilist.co/anime/${selectedItem.anilistId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-sky-500/50 hover:bg-sky-500/5 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-[9px] uppercase font-mono text-[var(--text-muted)] block">AniList ID</span>
                        <span className="text-xs font-mono font-bold text-sky-400">#{selectedItem.anilistId}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-sky-400" />
                    </a>
                  )}

                  {selectedItem.malId && (
                    <a
                      href={`https://myanimelist.net/anime/${selectedItem.malId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)] hover:border-blue-500/50 hover:bg-blue-500/5 transition-all flex items-center justify-between group"
                    >
                      <div>
                        <span className="text-[9px] uppercase font-mono text-[var(--text-muted)] block">MyAnimeList ID</span>
                        <span className="text-xs font-mono font-bold text-blue-400">#{selectedItem.malId}</span>
                      </div>
                      <ExternalLink className="w-3.5 h-3.5 text-zinc-500 group-hover:text-blue-400" />
                    </a>
                  )}
                </div>
              )}

              {/* Technical File Metadata */}
              <div className="space-y-1 pt-2 border-t border-[var(--border-subtle)]">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">{t('admin.fileOnDisk')}</span>
                <div className="font-mono font-bold text-[var(--text-primary)] break-all text-xs bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]" title={selectedItem.filename}>
                  {selectedItem.filename}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase">{t('admin.format')}</span>
                  <span className="text-emerald-400 font-bold uppercase">{selectedItem.mimeType.split('/')[1] || 'webp'}</span>
                </div>
                <div className="bg-[var(--bg-surface)] p-2.5 rounded-[6px] border border-[var(--border-subtle)]">
                  <span className="text-[10px] text-[var(--text-muted)] block uppercase">{t('admin.size')}</span>
                  <span className="text-[var(--text-primary)] font-bold">{selectedItem.formattedSize}</span>
                </div>
              </div>

              {/* Direct URL to Copy */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-mono text-[var(--text-muted)] block">{t('admin.localPublicLink')}</span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={typeof window !== 'undefined' ? `${window.location.origin}${selectedItem.url}` : selectedItem.url}
                    className="glass-input text-[11px] font-mono py-1.5 px-2.5 w-full text-[var(--text-secondary)] select-all"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopyUrl(selectedItem.url)}
                    className="btn-secondary p-2 shrink-0 cursor-pointer"
                    title={t('admin.copyLink')}
                  >
                    {copiedUrl === selectedItem.url ? (
                      <Check className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Cover Actions */}
            <div className="pt-4 border-t border-[var(--border-subtle)] flex flex-col gap-2.5">
              {selectedItem.category === t('admin.animeCovers') && (
                <button
                  type="button"
                  disabled={isRefreshingItem}
                  onClick={() => handleRefreshCover(selectedItem)}
                  className="w-full btn-secondary text-xs flex items-center justify-center gap-2 py-2 cursor-pointer font-semibold disabled:opacity-50"
                >
                  {isRefreshingItem ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--accent-text)]" />
                  ) : (
                    <RotateCw className="w-3.5 h-3.5 text-[var(--accent-text)]" />
                  )}
                  <span>{t('admin.refreshCoverFromTracker')}</span>
                </button>
              )}

              <div className="flex items-center justify-between gap-3">
                <a
                  href={selectedItem.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn-secondary text-xs flex items-center gap-1.5 flex-1 justify-center"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>{t('admin.viewOriginal')}</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleDeleteClick(selectedItem)}
                  className="px-3.5 py-2 rounded-[6px] bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-all flex-1 justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{t('common.delete')}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
