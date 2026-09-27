'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import {
  Image as ImageIcon,
  Check,
  Link as LinkIcon,
  Unlink,
} from 'lucide-react';
import type { MediaItem } from './types';

// LAZY LOAD COMPONENT WITH INTERSECTION OBSERVER (WORDPRESS STYLE)
function LazyMediaThumbnail({
  item,
  isSelected,
  onClick,
}: {
  item: MediaItem;
  isSelected: boolean;
  onClick: () => void;
}) {
  const { t } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setIsLoaded(false);
    setHasError(false);
  }, [item.url]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              setIsVisible(true);
              observer.unobserve(entry.target);
            }
          });
        },
        { rootMargin: '300px' }
      );

      observer.observe(el);
      return () => observer.disconnect();
    } else {
      setIsVisible(true);
    }
  }, [item.url]);

  const handleImageRef = (imgEl: HTMLImageElement | null) => {
    imgRef.current = imgEl;
    if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
      setIsLoaded(true);
    }
  };

  const displayName = item.titleEnglish || item.titleRomaji || item.filename;

  return (
    <div
      ref={containerRef}
      onClick={onClick}
      className={`group relative aspect-square rounded-[8px] border bg-[var(--bg-surface)] overflow-hidden cursor-pointer select-none transition-all duration-200 ${
        isSelected
          ? 'ring-2 ring-[var(--accent-primary)] border-[var(--accent-primary)] shadow-md shadow-[var(--accent-primary)]/20 scale-[1.02]'
          : 'border-[var(--border-subtle)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-surface-hover)]'
      }`}
      title={`${displayName} (${item.formattedSize})`}
    >
      {isVisible ? (
        <>
          {hasError ? (
            <div className="w-full h-full flex flex-col items-center justify-center p-2 text-center bg-zinc-900/40">
              <ImageIcon className="w-5 h-5 text-zinc-500 mb-1" />
              <span className="text-[9px] font-mono text-zinc-400 truncate max-w-full">
                {displayName}
              </span>
            </div>
          ) : (
            <img
              ref={handleImageRef}
              src={item.url}
              alt={displayName}
              loading="lazy"
              onLoad={() => setIsLoaded(true)}
              onError={() => {
                setHasError(true);
                setIsLoaded(true);
              }}
              className={`w-full h-full object-cover transition-all duration-300 ${
                isLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
              } group-hover:scale-105`}
            />
          )}
          {!isLoaded && !hasError && (
            <div className="absolute inset-0 skeleton" />
          )}
        </>
      ) : (
        <div className="w-full h-full bg-[var(--bg-surface-elevated)]/40 flex items-center justify-center">
          <ImageIcon className="w-4 h-4 text-[var(--text-muted)] opacity-20" />
        </div>
      )}

      {/* Selection Indicator */}
      {isSelected && (
        <div className="absolute top-1.5 right-1.5 z-20 w-5 h-5 rounded-[4px] bg-[var(--accent-primary)] text-white flex items-center justify-center shadow-md">
          <Check className="w-3.5 h-3.5 stroke-[3]" />
        </div>
      )}

      {/* Status Badge: Orphan vs In Use */}
      {item.category === t('admin.animeCovers') && (
        <div className="absolute top-1.5 left-1.5 z-10">
          {item.isOrphan ? (
            <span className="px-1.5 py-0.5 rounded-[4px] bg-amber-500/90 text-zinc-950 font-bold text-[8px] font-mono shadow-xs backdrop-blur-xs flex items-center gap-0.5" title={t('admin.orphanTooltip')}>
              <Unlink className="w-2.5 h-2.5" />
              <span>{t('admin.orphan')}</span>
            </span>
          ) : (
            <span className="px-1.5 py-0.5 rounded-[4px] bg-emerald-600/90 text-white font-bold text-[8px] font-mono shadow-xs backdrop-blur-xs flex items-center gap-0.5" title={t('admin.activeUsageReferences', { count: item.usageCount || 1 })}>
              <LinkIcon className="w-2.5 h-2.5" />
              <span>{item.usageCount || 1}</span>
            </span>
          )}
        </div>
      )}

      {/* Bottom overlay with titles and technical metadata */}
      <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/95 via-black/70 to-transparent p-2 pt-6 text-left pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity">
        <p className="text-[11px] font-bold text-white truncate leading-tight">
          {displayName}
        </p>
        {item.titleRomaji && item.titleRomaji !== displayName && (
          <p className="text-[9px] text-zinc-400 truncate italic mt-0.5 font-mono">
            {item.titleRomaji}
          </p>
        )}
        <div className="flex items-center justify-between text-[9px] font-mono text-zinc-300 mt-1">
          <span className="text-zinc-300 font-semibold">{item.formattedSize}</span>
          <span className="uppercase text-[8px] px-1 py-0.2 rounded bg-white/20 text-white font-bold">
            {item.mimeType.split('/')[1] || 'webp'}
          </span>
        </div>
      </div>
    </div>
  );
}

export { LazyMediaThumbnail };
