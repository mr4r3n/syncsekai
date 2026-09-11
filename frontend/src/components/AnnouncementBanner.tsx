'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Sparkles, Megaphone, ExternalLink, ArrowRight } from 'lucide-react';
import { api, getApiBase } from '@/lib/api';
import { useSidebar } from '@/components/SidebarProvider';
import { BannerParticleEngine } from './banner-effects/BannerParticleEngine';
import { useI18n } from '@/i18n/I18nProvider';

export interface AnnouncementData {
  id?: string;
  isActive?: boolean;
  themePreset?: string;
  badgeText?: string | null;
  badgeBgColor?: string | null;
  badgeTextColor?: string | null;
  message: string;
  mediaType?: string;
  mediaUrl?: string | null;
  mediaPosition?: string;
  backgroundType?: string;
  backgroundValue?: string | null;
  textColor?: string | null;
  effectType?: string;
  category?: string;
  enableGlobalAtmosphere?: boolean;
  ctaText?: string | null;
  ctaUrl?: string | null;
  ctaTarget?: string;
  ctaBgColor?: string | null;
  ctaTextColor?: string | null;
  isClosable?: boolean;
  targetAudience?: string;
  startsAt?: string | null;
  endsAt?: string | null;
  dismissExpiryDays?: number;
  updatedAt?: string;
}

interface AnnouncementBannerProps {
  previewData?: AnnouncementData | null;
  isPreview?: boolean;
  isMobilePreview?: boolean;
}

function TickerMessage({ message, ctaUrl, isExternalCta, ctaTarget }: { message: string; ctaUrl?: string | null; isExternalCta?: boolean; ctaTarget?: string }) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const textRef = React.useRef<HTMLSpanElement>(null);
  const [overflowDistance, setOverflowDistance] = React.useState(0);

  const measure = React.useCallback(() => {
    if (!containerRef.current || !textRef.current) return;
    const containerW = containerRef.current.clientWidth;
    const textW = textRef.current.scrollWidth;
    if (textW > containerW + 4) {
      setOverflowDistance(textW - containerW + 16);
    } else {
      setOverflowDistance(0);
    }
  }, []);

  React.useEffect(() => {
    measure();
    const ro = new ResizeObserver(() => {
      measure();
    });
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', measure);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [message, measure]);

  const isOverflowing = overflowDistance > 0;
  // Duración calculada según distancia (velocidad de lectura cómoda ~28px/segundo + 5s de pausa total)
  const animDuration = isOverflowing ? Math.max(7, Math.round(overflowDistance / 28) + 5) : 0;

  const content = (
    <div
      ref={containerRef}
      className="flex-1 min-w-0 overflow-hidden relative select-none cursor-pointer sm:cursor-default"
      style={
        isOverflowing
          ? {
              maskImage: 'linear-gradient(to right, black calc(100% - 16px), transparent)',
              WebkitMaskImage: 'linear-gradient(to right, black calc(100% - 16px), transparent)',
            }
          : undefined
      }
    >
      <div
        className={`whitespace-nowrap font-medium text-xs sm:text-[13.5px] leading-relaxed drop-shadow-xs ${
          isOverflowing ? 'animate-marquee-pause hover:[animation-play-state:paused]' : 'text-center sm:text-left truncate'
        }`}
        style={
          isOverflowing
            ? ({
                '--scroll-dist': `-${overflowDistance}px`,
                animationDuration: `${animDuration}s`,
              } as React.CSSProperties)
            : undefined
        }
      >
        <span ref={textRef} className="inline-block">
          {message}
        </span>
      </div>
    </div>
  );

  if (ctaUrl) {
    if (isExternalCta) {
      return (
        <a
          href={ctaUrl}
          target={ctaTarget || '_blank'}
          rel="noopener noreferrer"
          className="flex-1 min-w-0 flex items-center overflow-hidden hover:opacity-95 transition-opacity"
        >
          {content}
        </a>
      );
    }
    return (
      <Link
        href={ctaUrl}
        target={ctaTarget || '_self'}
        className="flex-1 min-w-0 flex items-center overflow-hidden hover:opacity-95 transition-opacity"
      >
        {content}
      </Link>
    );
  }

  return content;
}

export function AnnouncementBanner({ previewData, isPreview = false, isMobilePreview = false }: AnnouncementBannerProps) {
  const { t } = useI18n();
  const pathname = usePathname();
  const { isCollapsed } = useSidebar();
  const [data, setData] = useState<AnnouncementData | null>(previewData || null);
  const [isDismissed, setIsDismissed] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [isLoaded, setIsLoaded] = useState(isPreview);

  const isAuthPage =
    pathname === '/login' ||
    pathname === '/register' ||
    pathname?.startsWith('/auth') ||
    pathname?.startsWith('/setup') ||
    pathname?.startsWith('/activate') ||
    pathname?.startsWith('/confirm-email') ||
    pathname?.startsWith('/reset-password') ||
    pathname?.startsWith('/forgot-password');

  const needsSidebarPadding = !isPreview && !isAuthPage;

  // Cargar anuncio público si no es modo preview
  useEffect(() => {
    if (isPreview) {
      setData(previewData || null);
      setIsLoaded(true);
      return;
    }

    let isMounted = true;
    api.announcements
      .getActive()
      .then((res: any) => {
        if (!isMounted) return;
        if (res && res.id) {
          // Verificar si el usuario lo cerró anteriormente
          const storageKey = `plexsync_banner_dismissed_${res.id}`;
          const dismissedRaw = localStorage.getItem(storageKey);

          if (dismissedRaw) {
            try {
              const dismissedInfo = JSON.parse(dismissedRaw);
              const expiryMs = (res.dismissExpiryDays || 7) * 24 * 60 * 60 * 1000;
              const isExpired = Date.now() - dismissedInfo.timestamp > expiryMs;
              const hasBeenUpdated = res.updatedAt && dismissedInfo.updatedAt !== res.updatedAt;

              if (!isExpired && !hasBeenUpdated) {
                setIsDismissed(true);
              }
            } catch {
              // Si el formato es viejo, ignorar
            }
          }
          setData(res);
        } else {
          setData(null);
        }
      })
      .catch(() => {
        if (isMounted) setData(null);
      })
      .finally(() => {
        if (isMounted) setIsLoaded(true);
      });

    // Escuchar evento de actualización en tiempo real desde el panel de admin
    const handleUpdate = (e: any) => {
      if (e.detail) {
        setData(e.detail);
        setIsDismissed(false);
      }
    };

    if (typeof window !== 'undefined') {
      window.addEventListener('plexsync:announcement-updated', handleUpdate);
    }

    return () => {
      isMounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener('plexsync:announcement-updated', handleUpdate);
      }
    };
  }, [isPreview, previewData]);

  // Si está en preview, actualizar cuando cambien los datos
  useEffect(() => {
    if (isPreview) {
      setData(previewData || null);
    }
  }, [previewData, isPreview]);

  // Si no hay datos, o no está activo, o ya fue descartado, no mostrar nada
  if (!isLoaded) return null;
  if (!data || !data.message) return null;
  if (!isPreview && (!data.isActive || isDismissed)) return null;

  // Manejar el cierre suave (animación hacia arriba)
  const handleDismiss = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setIsClosing(true);
    setTimeout(() => {
      setIsDismissed(true);
      setIsClosing(false);
      if (data.id && typeof window !== 'undefined') {
        const storageKey = `plexsync_banner_dismissed_${data.id}`;
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            timestamp: Date.now(),
            updatedAt: data.updatedAt,
          }),
        );
      }
    }, 380);
  };

  const bgType = data.backgroundType || 'GRADIENT';
  const bgValue = data.backgroundValue || 'linear-gradient(90deg, #1b4332 0%, #2d6a4f 50%, #b7094c 100%)';

  let containerStyle: React.CSSProperties = {
    color: data.textColor || '#ffffff',
  };

  if (bgType === 'COLOR') {
    containerStyle.backgroundColor = bgValue;
  } else if (bgType === 'GRADIENT') {
    containerStyle.background = bgValue;
  } else if (bgType === 'IMAGE' || bgType === 'GIF') {
    containerStyle.backgroundImage = `url(${bgValue})`;
    containerStyle.backgroundSize = 'cover';
    containerStyle.backgroundPosition = 'center';
  }

  // Resolver URL del archivo multimedia (GIF o Imagen)
  const getFullMediaUrl = (url?: string | null) => {
    if (!url) return null;
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    if (url.startsWith('/')) return `${getApiBase()}${url}`;
    return url;
  };

  const isExternalCta = data.ctaUrl?.startsWith('http://') || data.ctaUrl?.startsWith('https://');

  return (
    <aside
      role="region"
      aria-label={t('common.systemAnnouncement')}
      className={`relative w-full z-40 transition-all duration-400 ease-[cubic-bezier(0.25,1,0.5,1)] shadow-md border-b overflow-hidden ${
        needsSidebarPadding ? (isCollapsed ? 'md:pl-[72px]' : 'md:pl-[260px]') : ''
      } pl-0 ${isPreview ? 'rounded-[8px]' : ''} ${
        isClosing
          ? 'max-h-0 opacity-0 -translate-y-full border-transparent pointer-events-none py-0'
          : 'max-h-60 opacity-100 translate-y-0 border-black/10'
      }`}
      style={containerStyle}
    >
      {/* Capa de Oscurecimiento sutil si el fondo es imagen/gif para garantizar legibilidad */}
      {(bgType === 'IMAGE' || bgType === 'GIF') && (
        <div className="absolute inset-0 bg-black/40 backdrop-blur-[1px] pointer-events-none" />
      )}
      
      {/* Motor de Partículas y Efectos de Temporada */}
      <BannerParticleEngine effectType={data.effectType} />

      <div className="relative z-10 w-full px-3.5 sm:px-6 md:px-8 py-2.5 sm:py-3 flex items-center justify-between gap-3 sm:gap-4 text-xs sm:text-[14px] font-medium min-w-0 min-h-[46px] sm:min-h-[56px]">
        {/* Contenido Central: En móvil solo texto a pantalla completa */}
        <div className="flex-1 flex items-center gap-2 sm:gap-3 min-w-0 overflow-hidden">
          {/* Media Izquierda (Solo Desktop) */}
          {data.mediaUrl && data.mediaPosition === 'LEFT' && !isMobilePreview && (
            <img
              src={getFullMediaUrl(data.mediaUrl)!}
              alt="Banner Media"
              width={48}
              height={32}
              className="h-8 w-auto max-w-[48px] rounded-[5px] object-contain shrink-0 shadow-sm hidden sm:inline-block"
            />
          )}

          {/* Badge Destacado (Solo Desktop) */}
          {data.badgeText && !isMobilePreview && (
            <span
              className="hidden sm:inline-flex px-2.5 py-1 rounded-[5px] font-bold text-xs tracking-wider uppercase shadow-sm shrink-0 items-center gap-1 leading-normal select-none"
              style={{
                backgroundColor: data.badgeBgColor || '#ff4d4f',
                color: data.badgeTextColor || '#ffffff',
              }}
            >
              {data.badgeText}
            </span>
          )}

          {/* Mensaje Principal: Ocupa todo el ancho en móvil con ticker suave y pausas */}
          <TickerMessage
            message={data.message}
            ctaUrl={data.ctaUrl}
            isExternalCta={isExternalCta}
            ctaTarget={data.ctaTarget}
          />

          {/* Media Derecha (Solo Desktop) */}
          {data.mediaUrl && data.mediaPosition === 'RIGHT' && !isMobilePreview && (
            <img
              src={getFullMediaUrl(data.mediaUrl)!}
              alt="Banner Media"
              width={48}
              height={32}
              className="h-8 w-auto max-w-[48px] rounded-[5px] object-contain shrink-0 shadow-sm hidden sm:inline-block"
            />
          )}
        </div>

        {/* Acciones: CTA Button (Solo Desktop) y Botón Cerrar (Siempre visible) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {/* Botón CTA Compacto (Móvil) */}
          {data.ctaText && data.ctaUrl && !isMobilePreview && (
            <div className="inline-flex sm:hidden">
              {isExternalCta ? (
                <a
                  href={data.ctaUrl}
                  target={data.ctaTarget || '_blank'}
                  rel="noopener noreferrer"
                  className="w-7 h-7 rounded-[5px] flex items-center justify-center transition-all shadow-sm shrink-0"
                  style={{
                    backgroundColor: data.ctaBgColor || '#ffffff',
                    color: data.ctaTextColor || '#0ba360',
                  }}
                  title={data.ctaText}
                  aria-label={data.ctaText}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              ) : (
                <Link
                  href={data.ctaUrl}
                  target={data.ctaTarget || '_self'}
                  className="w-7 h-7 rounded-[5px] flex items-center justify-center transition-all shadow-sm shrink-0"
                  style={{
                    backgroundColor: data.ctaBgColor || '#ffffff',
                    color: data.ctaTextColor || '#0ba360',
                  }}
                  title={data.ctaText}
                  aria-label={data.ctaText}
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              )}
            </div>
          )}

          {/* Botón CTA Completo (Desktop) */}
          {data.ctaText && data.ctaUrl && !isMobilePreview && (
            <div className="hidden sm:inline-flex">
              {isExternalCta ? (
                <a
                  href={data.ctaUrl}
                  target={data.ctaTarget || '_blank'}
                  rel="noopener noreferrer"
                  className="px-4 py-1.5 rounded-[6px] text-[13px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-md inline-flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: data.ctaBgColor || '#ffffff',
                    color: data.ctaTextColor || '#0ba360',
                  }}
                >
                  <span>{data.ctaText}</span>
                  {data.ctaTarget === '_blank' ? (
                    <ExternalLink className="w-3.5 h-3.5 opacity-80" />
                  ) : (
                    <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                  )}
                </a>
              ) : (
                <Link
                  href={data.ctaUrl}
                  target={data.ctaTarget || '_self'}
                  className="px-4 py-1.5 rounded-[6px] text-[13px] font-bold transition-all duration-200 hover:scale-105 active:scale-95 shadow-md inline-flex items-center gap-1.5 cursor-pointer select-none whitespace-nowrap shrink-0"
                  style={{
                    backgroundColor: data.ctaBgColor || '#ffffff',
                    color: data.ctaTextColor || '#0ba360',
                  }}
                >
                  <span>{data.ctaText}</span>
                  <ArrowRight className="w-3.5 h-3.5 opacity-80" />
                </Link>
              )}
            </div>
          )}

          {/* Botón de Cierre (X) - Siempre presente a la derecha */}
          {(data.isClosable !== false || isPreview) && (
            <button
              type="button"
              onClick={handleDismiss}
              aria-label={t('common.closeAnnouncement')}
              className="p-1.5 rounded-[6px] hover:bg-black/20 text-current transition-colors shrink-0 cursor-pointer"
            >
              <X className="w-4 h-4 opacity-80 hover:opacity-100" />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
