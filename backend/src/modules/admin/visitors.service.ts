import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { MetricsService } from './metrics.service';

const ISO_COUNTRY_DATA: Record<string, { name: string; coords: [number, number] }> = {
  ES: { name: 'Spain', coords: [40.4637, -3.7492] },
  MX: { name: 'Mexico', coords: [23.6345, -102.5528] },
  US: { name: 'United States', coords: [37.0902, -95.7129] },
  CL: { name: 'Chile', coords: [-35.6751, -71.543] },
  AR: { name: 'Argentina', coords: [-38.4161, -63.6167] },
  CO: { name: 'Colombia', coords: [4.5709, -74.2973] },
  PE: { name: 'Peru', coords: [-9.19, -75.0152] },
  VE: { name: 'Venezuela', coords: [6.4238, -66.5897] },
  EC: { name: 'Ecuador', coords: [-1.8312, -78.1834] },
  BO: { name: 'Bolivia', coords: [-16.2902, -63.5887] },
  UY: { name: 'Uruguay', coords: [-32.5228, -55.7658] },
  PY: { name: 'Paraguay', coords: [-23.4425, -58.4438] },
  CR: { name: 'Costa Rica', coords: [9.7489, -83.7534] },
  PA: { name: 'Panama', coords: [8.5379, -80.7821] },
  DO: { name: 'Dominican Republic', coords: [18.7357, -70.1627] },
  GT: { name: 'Guatemala', coords: [15.7835, -90.2308] },
  HN: { name: 'Honduras', coords: [15.1999, -86.2419] },
  SV: { name: 'El Salvador', coords: [13.7942, -88.8965] },
  NI: { name: 'Nicaragua', coords: [12.8654, -85.2072] },
  PR: { name: 'Puerto Rico', coords: [18.2208, -66.5901] },
  BR: { name: 'Brasil', coords: [-14.235, -51.9253] },
  DE: { name: 'Germany', coords: [51.1657, 10.4515] },
  FR: { name: 'France', coords: [46.2276, 2.2137] },
  GB: { name: 'United Kingdom', coords: [55.3781, -3.436] },
  IT: { name: 'Italy', coords: [41.8719, 12.5674] },
  PT: { name: 'Portugal', coords: [39.3999, -8.2245] },
  CA: { name: 'Canada', coords: [56.1304, -106.3468] },
  JP: { name: 'Japan', coords: [36.2048, 138.2529] },
  KR: { name: 'South Korea', coords: [35.9078, 127.7669] },
  NL: { name: 'Netherlands', coords: [52.1326, 5.2913] },
  BE: { name: 'Belgium', coords: [50.5039, 4.4699] },
  CH: { name: 'Switzerland', coords: [46.8182, 8.2275] },
  AT: { name: 'Austria', coords: [47.5162, 14.5501] },
  SE: { name: 'Sweden', coords: [60.1282, 18.6435] },
  NO: { name: 'Norway', coords: [60.472, 8.4689] },
  FI: { name: 'Finland', coords: [61.9241, 25.7482] },
  DK: { name: 'Denmark', coords: [56.2639, 9.5018] },
  IE: { name: 'Ireland', coords: [53.1424, -7.6921] },
  PL: { name: 'Poland', coords: [51.9194, 19.1451] },
  RU: { name: 'Russia', coords: [61.524, 105.3188] },
  AU: { name: 'Australia', coords: [-25.2744, 133.7751] },
  NZ: { name: 'New Zealand', coords: [-40.9006, 174.886] },
};

/** Geolocation Cloudflare adds at the edge; the middleware reads it from the headers. */
export interface GeoHeaders {
  country?: string;
  city?: string;
  region?: string;
  lat?: number;
  lon?: number;
}

/** Visit counter without IPs, with geolocation by country. */
@Injectable()
export class VisitorsService {
  private readonly logger = new Logger(VisitorsService.name);

  private ipGeoCache = new Map<string, any>();
  // Daily rotating salt: generated randomly and NOT stored anywhere.
  private dailySalt: { date: string; value: Buffer } | null = null;

  constructor(
    private prisma: PrismaService,
    private metricsService: MetricsService,
  ) {}

  private detectOS(ua?: string): string {
    if (!ua) return 'Unknown system';
    const lower = ua.toLowerCase();
    if (lower.includes('windows nt 10.0')) return 'Windows 10/11';
    if (lower.includes('windows nt 6.3')) return 'Windows 8.1';
    if (lower.includes('windows nt 6.1')) return 'Windows 7';
    if (lower.includes('windows')) return 'Windows';
    if (lower.includes('iphone')) return 'iOS (iPhone)';
    if (lower.includes('ipad')) return 'iPadOS';
    if (lower.includes('android')) return 'Android';
    if (lower.includes('macintosh') || lower.includes('mac os x')) return 'macOS';
    if (lower.includes('linux')) return 'Linux';
    if (lower.includes('cros')) return 'ChromeOS';
    if (lower.includes('plexmediaserver') || lower.includes('plex')) return 'Plex Media Server';
    return 'Web browser';
  }

  private detectBrowser(ua?: string): string {
    if (!ua) return 'Web browser';
    const lower = ua.toLowerCase();
    if (lower.includes('edg/')) return 'Microsoft Edge';
    if (lower.includes('opr/') || lower.includes('opera')) return 'Opera';
    if (lower.includes('chrome/') && !lower.includes('edg/')) return 'Google Chrome';
    if (lower.includes('firefox/')) return 'Mozilla Firefox';
    if (lower.includes('safari/') && !lower.includes('chrome/')) return 'Apple Safari';
    if (lower.includes('curl/')) return 'cURL CLI';
    if (lower.includes('plexmediaserver') || lower.includes('plex')) return 'Plex Webhook';
    return 'Web browser';
  }

  /**
   * Order: Cloudflare with coordinates -> external providers -> Cloudflare
   * country only. Cloudflare resolves at the edge with the real IP and no rate
   * limit; the free providers cut off by quota (ip-api: 45/min), and then the
   * visit would fall back to the country centroid, which looks like a city on
   * the map. With the full headers enabled, no query goes out.
   */
  async resolveGeoIp(ip: string, geoHeaders?: GeoHeaders) {
    if (this.ipGeoCache.has(ip)) {
      return this.ipGeoCache.get(ip);
    }

    let geoData: any = null;

    // 1. Cloudflare with coordinates ("visitor location headers" transform)
    if (geoHeaders?.country && geoHeaders.lat !== undefined && geoHeaders.lon !== undefined) {
      const code = geoHeaders.country.toUpperCase();
      const isoInfo = ISO_COUNTRY_DATA[code];
      const country = isoInfo?.name || code;
      geoData = {
        city: geoHeaders.city ? `${geoHeaders.city} (${geoHeaders.region || country})` : geoHeaders.region || country,
        country,
        code,
        region: geoHeaders.region || '',
        lat: geoHeaders.lat,
        lon: geoHeaders.lon,
        isp: '',
      };
    }

    // 2. External provider: ip-api.com
    if (!geoData) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(
          `http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,countryCode,region,regionName,city,lat,lon,timezone,isp,org,as,query`,
          { signal: controller.signal },
        );
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.status === 'success') {
            const code = (json.countryCode || 'XX').toUpperCase();
            const isoInfo = ISO_COUNTRY_DATA[code];
            geoData = {
              city: json.city ? `${json.city} (${json.regionName || json.country || ''})` : json.regionName || json.country || 'Unknown',
              country: isoInfo?.name || json.country || 'Unknown',
              code,
              region: json.regionName || '',
              lat: Number(json.lat) || 0,
              lon: Number(json.lon) || 0,
              isp: json.isp || json.org || json.as || '',
            };
          }
        }
      } catch {}
    }

    // 3. External provider: ipwho.is
    if (!geoData) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.success) {
            const code = (json.country_code || 'XX').toUpperCase();
            const isoInfo = ISO_COUNTRY_DATA[code];
            geoData = {
              city: json.city ? `${json.city} (${json.region || json.country || ''})` : json.region || json.country || 'Unknown',
              country: isoInfo?.name || json.country || 'Unknown',
              code,
              region: json.region || '',
              lat: Number(json.latitude) || 0,
              lon: Number(json.longitude) || 0,
              isp: json.connection?.isp || json.connection?.org || '',
            };
          }
        }
      } catch {}
    }

    // 4. External provider: freeipapi.com
    if (!geoData) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3500);
        const res = await fetch(`https://freeipapi.com/api/json/${encodeURIComponent(ip)}`, {
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (res.ok) {
          const json = await res.json();
          if (json.countryCode) {
            const code = (json.countryCode || 'XX').toUpperCase();
            const isoInfo = ISO_COUNTRY_DATA[code];
            geoData = {
              city: json.cityName || json.regionName || 'Unknown',
              country: isoInfo?.name || json.countryName || 'Unknown',
              code,
              region: json.regionName || '',
              lat: Number(json.latitude) || 0,
              lon: Number(json.longitude) || 0,
              isp: '',
            };
          }
        }
      } catch {}
    }

    // 5. Cloudflare country only: coordinates of the country centroid
    if (!geoData && geoHeaders?.country) {
      const code = geoHeaders.country.toUpperCase();
      const isoInfo = ISO_COUNTRY_DATA[code];
      geoData = {
        city: geoHeaders.city || geoHeaders.region || (isoInfo?.name || code),
        country: isoInfo?.name || code,
        code,
        region: geoHeaders.region || '',
        lat: isoInfo?.coords[0] || 0,
        lon: isoInfo?.coords[1] || 0,
        isp: 'Cloudflare Edge Proxy',
      };
    }

    if (geoData) {
      this.ipGeoCache.set(ip, geoData);
      if (this.ipGeoCache.size > 5000) {
        this.ipGeoCache.clear();
      }
    }

    return geoData;
  }

  private isLocalNetwork(ip: string): boolean {
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(ip) ||
      ip.startsWith('169.254.') ||
      ip.startsWith('fe80:') ||
      ip.startsWith('fc') ||
      ip.startsWith('fd')
    );
  }

  /**
   * Visitor identifier valid only for the current day.
   *
   * It counts one visit per person per day without storing their IP: the same
   * visitor produces the same key within the day, and once the salt changes
   * yesterday's value cannot be reproduced, so nobody can be followed across
   * days.
   *
   * Since nothing is stored on the visitor's device (no cookie, no
   * fingerprint), it falls outside article 5.3 of ePrivacy and needs no consent
   * banner. It is the same approach Plausible and Fathom use.
   *
   * The salt lives in process memory. When the backend restarts it changes,
   * and that day's visitors are counted once more. That small deviation is
   * acceptable compared to persisting it; if it ever matters, it goes to Redis
   * with expiry at midnight.
   */
  private dailyVisitorKey(ip: string, userAgent: string | undefined, date: string): string {
    if (!this.dailySalt || this.dailySalt.date !== date) {
      this.dailySalt = { date, value: crypto.randomBytes(32) };
    }
    return crypto
      .createHmac('sha256', this.dailySalt.value)
      .update(`${ip}|${userAgent || ''}`)
      .digest('hex')
      .slice(0, 40);
  }

  async recordVisitorIp(rawIp: string, username?: string, userAgent?: string, geoHeaders?: GeoHeaders) {
    try {
      if (!rawIp) return;
      const ip = rawIp.replace(/^::ffff:/, '').trim();
      // The local network is not visitors: it is the administrator, the containers
      // talking to each other and tests. Counting them skews the metric and adds
      // nothing to the panel.
      if (this.isLocalNetwork(ip)) return;

      const detectedOs = this.detectOS(userAgent);
      const detectedBrowser = this.detectBrowser(userAgent);
      const deviceFingerprint = crypto
        .createHash('md5')
        .update(`${userAgent || 'unknown'}`)
        .digest('hex')
        .slice(0, 8);

      const todayStr = new Date().toISOString().split('T')[0];
      // The country is resolved BEFORE discarding the IP: the country identifies
      // nobody, the IP does.
      const geoData = await this.resolveGeoIp(ip, geoHeaders);
      const visitorKey = this.dailyVisitorKey(ip, userAgent, todayStr);

      // 1. Was this visit already recorded today?
      const existing = await this.prisma.systemMetric.findFirst({
        where: {
          metricKey: 'UNIQUE_IP_VISIT',
          ipAddress: visitorKey,
          dateKey: todayStr,
        },
      });

      if (existing) {
        // Same visitor today: update the last activity without inflating the counter
        const currentMeta = (existing.metadata as any) || {};
        await this.prisma.systemMetric.update({
          where: { id: existing.id },
          data: {
            value: 1,
            metadata: {
              ...currentMeta,
              lastSeenAt: new Date().toISOString(),
              username: username || currentMeta.username || null,
              os: detectedOs !== 'Web browser' && detectedOs !== 'Unknown system' ? detectedOs : currentMeta.os || detectedOs,
              browser: detectedBrowser,
              device: deviceFingerprint,
            },
          },
        });
        return;
      }

      // 2. New visit for the day
      await this.prisma.systemMetric.create({
        data: {
          metricKey: 'UNIQUE_IP_VISIT',
          ipAddress: visitorKey,
          dateKey: todayStr,
          value: 1,
          metadata: {
            city: geoData?.city || 'Unknown',
            country: geoData?.country || 'Unknown',
            code: geoData?.code || 'XX',
            region: geoData?.region || '',
            lat: geoData?.lat || 0,
            lon: geoData?.lon || 0,
            isp: geoData?.isp || '',
            os: detectedOs,
            browser: detectedBrowser,
            device: deviceFingerprint,
            username: username || null,
            firstSeenAt: new Date().toISOString(),
            lastSeenAt: new Date().toISOString(),
          },
        },
      });
    } catch (err: any) {
      this.logger.warn(`Error recording GeoIP for ${rawIp}: ${err.message}`);
    }
  }

  /**
   * Resets all Geo IP statistics and records.
   */
  async resetGeoMetrics() {
    const deleted = await this.prisma.systemMetric.deleteMany({
      where: { metricKey: 'UNIQUE_IP_VISIT' },
    });
    this.ipGeoCache.clear();
    this.metricsService.clearMetricsCache();
    return {
      success: true,
      count: deleted.count,
      message: `Geo IP statistics reset (${deleted.count} records deleted).`,
    };
  }
}
