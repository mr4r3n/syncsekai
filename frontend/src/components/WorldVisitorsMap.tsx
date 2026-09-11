'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';
import { Globe, MapPin, Users, Zap, Maximize2 } from 'lucide-react';
import { useI18n } from '@/i18n/I18nProvider';

export interface LocationPoint {
  city: string;
  country: string;
  code: string;
  coords: [number, number];
  visits: number;
  percentage: number;
}

interface WorldVisitorsMapProps {
  totalVisits?: number;
  locations?: LocationPoint[];
}

export function WorldVisitorsMap({ totalVisits = 0, locations = [] }: WorldVisitorsMapProps) {
  const { t } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const [activeLocation, setActiveLocation] = useState<LocationPoint | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

    let isMounted = true;

    const initMap = async () => {
      const L = (await import('leaflet')).default;

      if (!mapContainerRef.current) return;

      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }

      // Vista centrada y fluida con fondo oscuro integrado
      const map = L.map(mapContainerRef.current, {
        center: [25, 0],
        zoom: 2,
        minZoom: 1.5,
        maxZoom: 8,
        worldCopyJump: true,
        zoomControl: false,
        attributionControl: false,
      });

      // Controles de Zoom arriba a la derecha
      L.control.zoom({ position: 'topright' }).addTo(map);

      // Capa base cartográfica oscura Esri Canvas (100% gratuita, sin marcas de agua ni API key)
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ).addTo(map);

      // Etiquetas y fronteras nítidas de países y ciudades
      L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 16,
        }
      ).addTo(map);

      // Marcadores reales pasados por props
      const validPoints = locations.filter((loc) => {
        if (!loc.coords || loc.coords.length !== 2) return false;
        const [lat, lon] = loc.coords;
        if (typeof lat !== 'number' || typeof lon !== 'number') return false;
        if (isNaN(lat) || isNaN(lon)) return false;
        if (lat === 0 && lon === 0) return false;
        if (lat === 20 && lon === 0) return false;
        return true;
      });

      validPoints.forEach((loc) => {
        const customPulseIcon = L.divIcon({
          className: 'custom-map-pulse-marker',
          html: `
            <div class="relative flex items-center justify-center w-6 h-6 -translate-x-1/2 -translate-y-1/2 cursor-pointer group">
              <span class="absolute w-6 h-6 rounded-full bg-sky-500/30 animate-ping"></span>
              <span class="absolute w-4 h-4 rounded-full bg-sky-400/50"></span>
              <span class="relative w-2.5 h-2.5 rounded-full bg-sky-300 border border-white shadow-[0_0_8px_#38bdf8]"></span>
            </div>
          `,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });

        const cleanCode = (loc.code || '').trim().toUpperCase();
        const flagImg =
          cleanCode && cleanCode !== 'LAN' && cleanCode !== 'LOC' && cleanCode !== 'XX' && cleanCode.length === 2
            ? `<img src="https://flagcdn.com/w40/${cleanCode.toLowerCase()}.png" alt="${cleanCode}" style="width: 18px; height: 13px; object-fit: cover; border-radius: 2px; display: inline-block; vertical-align: middle; margin-right: 6px; box-shadow: 0 1px 3px rgba(0,0,0,0.5);" />`
            : '<span style="margin-right: 5px;">🌐</span>';

        const popupContent = `
          <div style="background-color: #0c0c0e; color: #ffffff; padding: 10px 14px; border-radius: 10px; border: 1px solid rgba(56, 189, 248, 0.3); font-family: monospace; min-width: 180px; box-shadow: 0 10px 25px rgba(0,0,0,0.8);">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; gap: 8px;">
              <div style="display: flex; align-items: center; font-weight: bold; font-size: 12px; color: #ffffff;">
                ${flagImg}
                <span>${loc.city || loc.country}</span>
              </div>
              <span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-weight: bold;">${loc.code || 'LOC'}</span>
            </div>
            <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 6px;">${loc.country}</div>
            <div style="display: flex; align-items: center; justify-content: space-between; font-size: 11px; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 6px;">
              <span style="color: #38bdf8; font-weight: bold;">${t('admin.ipsCount', { n: loc.visits })}</span>
              <span style="color: #10b981; font-weight: bold;">${t('admin.percentOfTotal', { p: loc.percentage })}</span>
            </div>
          </div>
        `;

        const marker = L.marker(loc.coords, { icon: customPulseIcon }).addTo(map);
        marker.bindPopup(popupContent, {
          closeButton: false,
          className: 'custom-leaflet-dark-popup',
        });

        marker.on('click', () => {
          if (isMounted) setActiveLocation(loc);
        });
      });

      if (validPoints.length === 1) {
        map.setView(validPoints[0].coords, 3);
      } else if (validPoints.length > 1) {
        const bounds = L.latLngBounds(validPoints.map((p) => p.coords));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 });
      }

      mapInstanceRef.current = map;
    };

    initMap();

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // `t` va en las dependencias porque el texto del globo se escribe una sola
    // vez, al montar el mapa: sin esto, cambiar de idioma dejaba los globos en
    // el anterior hasta que cambiaran las ubicaciones.
  }, [locations, t]);

  return (
    <div className="glass-card p-6 space-y-4 overflow-hidden relative">
      {/* Header del Mapa */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-[6px] bg-[var(--nav-active-bg)] text-[var(--nav-active-text)] border border-[var(--nav-active-border)] flex items-center justify-center">
            <Globe className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 font-heading">
              <span>{t('admin.worldMapTitle')}</span>
              <span className="badge-status-success text-[10px]">{t('admin.oneIpPerDay')}</span>
            </h3>
            <p className="text-xs text-[var(--text-secondary)] font-mono">{t('admin.worldMapSubtitle')}</p>
          </div>
        </div>

        {/* Resumen rápido de ubicaciones */}
        <div className="flex items-center gap-3 text-xs font-mono">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <Users className="w-3.5 h-3.5 text-sky-400" />
            <span className="text-[var(--text-primary)] font-bold">{totalVisits?.toLocaleString() || 0}</span>
            <span className="text-[var(--text-muted)]">{t('admin.dedupedIps')}</span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-subtle)]">
            <MapPin className="w-3.5 h-3.5 text-emerald-400" />
            <span className="text-[var(--text-primary)] font-bold">{locations.length}</span>
            <span className="text-[var(--text-muted)]">{t('admin.activeNodes')}</span>
          </div>
        </div>
      </div>

      {/* Contenedor del Mapa Real Leaflet */}
      <div className="relative w-full h-[360px] rounded-[6px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-app)]">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Leyenda flotante */}
        <div className="absolute bottom-3 left-3 z-20 bg-[var(--glass-bg)] backdrop-blur-xl px-3.5 py-2 rounded-[6px] border border-[var(--glass-border)] text-[11px] font-mono flex items-center gap-4 shadow-lg text-[var(--text-primary)]">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block shadow-[0_0_6px_#38bdf8]" />
            <span className="text-[var(--text-secondary)] font-semibold">{t('admin.activeAccessHubs')}</span>
          </div>
          <div className="flex items-center gap-1.5 text-[var(--text-muted)]">
            <span>{t('admin.dragAndZoom')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
