'use client';

import { useEffect, useRef } from 'react';
import 'jsvectormap/dist/jsvectormap.css';
import { useI18n } from '@/i18n/I18nProvider';
import { regionName } from '@/lib/region';

export interface LocationPoint {
  city: string;
  country: string;
  code: string;
  coords: [number, number];
  visits: number;
  percentage: number;
}

export interface CountryVisits {
  code: string;
  country: string;
  visits: number;
  percentage: number;
}

interface WorldVisitorsMapProps {
  locations?: LocationPoint[];
  countries?: CountryVisits[];
}

// Push pin (ball and needle), drawn as an inline SVG image (no request). jsVectorMap
// draws images 23×23 centred on the point; the offset puts the needle's tip on the city.
const pin = (fill: string) => ({
  url: `data:image/svg+xml,${encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><line x1="12" y1="12" x2="12" y2="22" stroke="#9ca3af" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="7" r="5" fill="${fill}" stroke="#fff" stroke-width="1.5"/></svg>`,
  )}`,
  offset: [0, -10],
});

const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const isCountryCode = (code: string | undefined) =>
  !!code && /^[A-Z]{2}$/.test(code.trim().toUpperCase()) && !['XX'].includes(code.trim().toUpperCase());

/**
 * Flat SVG world map (jsVectorMap): countries shaded by their share of visits and
 * one small dot per city. Colours come from the theme through CSS (see the
 * `.visitors-map` rules in globals.css), so it follows light and dark by itself.
 * The map drawing ships inside the library; only the flags come from flagcdn.com.
 */
export function WorldVisitorsMap({ locations = [], countries = [] }: WorldVisitorsMapProps) {
  const { t, locale } = useI18n();
  const containerRef = useRef<HTMLDivElement>(null);

  const points = locations.filter(({ coords }) => {
    if (!coords || coords.length !== 2) return false;
    const [lat, lon] = coords;
    if (typeof lat !== 'number' || typeof lon !== 'number' || isNaN(lat) || isNaN(lon)) return false;
    return !(lat === 0 && lon === 0) && !(lat === 20 && lon === 0);
  });
  const byCode = new Map(countries.filter((c) => isCountryCode(c.code)).map((c) => [c.code.trim().toUpperCase(), c]));
  const maxShare = Math.max(1, ...[...byCode.values()].map((c) => c.percentage || 0));

  // Same tag the globe had: flag and short country name on the left, share on the right.
  const tag = (code: string, name: string, percentage: number) => `
    <div class="visitors-map-tag">
      <span class="flex items-center gap-1.5">
        ${isCountryCode(code) ? `<img src="https://flagcdn.com/w40/${code.trim().toLowerCase()}.png" alt="" class="w-4 h-3 object-cover rounded-[1px]" />` : ''}
        <span class="max-w-[9rem] truncate">${escapeHtml(name)}</span>
      </span>
      <span class="text-[var(--accent-primary)]">${percentage}%</span>
    </div>`;

  // Rebuilt only when the data or the language changes; `t` and `locale` go together.
  const dataKey = JSON.stringify([points, [...byCode.values()], locale]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    let map: any = null;
    let cancelled = false;
    // jsVectorMap measures its container only once; redraw whenever the box changes
    // (window resize, sidebar toggle, late styles), or the drawing spills out of it.
    const resize = new ResizeObserver(() => map?.updateSize());
    resize.observe(container);

    (async () => {
      const jsVectorMap = (await import('jsvectormap')).default;
      // The map file registers itself on window.jsVectorMap, which the import above sets.
      await import('jsvectormap/dist/maps/world.js');
      if (cancelled) return;

      map = new jsVectorMap({
        selector: container,
        map: 'world',
        zoomButtons: true,
        zoomOnScroll: true,
        markerStyle: {
          initial: { image: pin(getComputedStyle(document.documentElement).getPropertyValue('--accent-primary').trim() || '#FF634A') },
        },
        markers: points.map((p) => ({ name: p.city || p.country, coords: p.coords })),
        onRegionTooltipShow(event: Event, tooltip: any, code: string) {
          const c = byCode.get(code);
          if (!c) return event.preventDefault();
          tooltip.text(tag(code, regionName(code, locale, c.country, 'short'), c.percentage), true);
        },
        onMarkerTooltipShow(_event: Event, tooltip: any, index: string) {
          const p = points[Number(index)];
          tooltip.text(tag(p.code, p.city || regionName(p.code, locale, p.country, 'short'), p.percentage), true);
        },
      });

      // Shade each country by its share: the strongest one gets the full accent colour.
      for (const [code, c] of byCode) {
        const node = map.regions?.[code]?.element?.shape?.node as SVGElement | undefined;
        if (!node) continue;
        node.classList.add('has-visits');
        node.style.setProperty('--share', String(0.2 + 0.6 * ((c.percentage || 0) / maxShare)));
      }
    })();

    return () => {
      cancelled = true;
      resize.disconnect();
      map?.destroy();
      // destroy() leaves the drawing in place: without this, the map rebuilt when the data
      // arrives lands under the first, empty one and the page shows no countries.
      container.replaceChildren();
      // destroy() leaves the shared tooltip in <body> when the last map goes.
      document.querySelectorAll('.jvm-tooltip').forEach((el) => el.remove());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataKey]);

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={t('admin.mapAriaLabel', { n: byCode.size })}
      className="visitors-map relative w-full aspect-[900/441]"
    />
  );
}
