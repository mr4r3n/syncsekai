'use client';

import { useEffect, useRef } from 'react';
import 'leaflet/dist/leaflet.css';
import { useI18n } from '@/i18n/I18nProvider';
import { nombreRegion } from '@/lib/region';

export interface LocationPoint {
  city: string;
  country: string;
  code: string;
  coords: [number, number];
  visits: number;
  percentage: number;
}

interface WorldVisitorsMapProps {
  locations?: LocationPoint[];
}

export function WorldVisitorsMap({ locations = [] }: WorldVisitorsMapProps) {
  const { t, locale } = useI18n();
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !mapContainerRef.current) return;

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
                <span>${loc.city || nombreRegion(loc.code, locale, loc.country)}</span>
              </div>
              <span style="font-size: 10px; background: rgba(255,255,255,0.1); padding: 2px 6px; border-radius: 4px; color: #38bdf8; font-weight: bold;">${loc.code || 'LOC'}</span>
            </div>
            <div style="font-size: 11px; color: #a1a1aa; margin-bottom: 6px;">${nombreRegion(loc.code, locale, loc.country)}</div>
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
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
    // `t` va en las dependencias porque el texto del globo se escribe una sola
    // vez, al montar el mapa: sin esto, cambiar de idioma dejaba los globos en
    // el anterior hasta que cambiaran las ubicaciones.
  }, [locations, t, locale]);

  return (
    <div className="relative w-full h-[480px] rounded-[6px] overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-app)]">
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
  );
}
