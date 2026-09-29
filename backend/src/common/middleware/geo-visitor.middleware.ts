import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { VisitorsService, type GeoHeaders } from '../../modules/admin/visitors.service';
import { readCookie } from '../../modules/auth/auth-cookies';
import { getRequiredSecret } from '../security/required-secret';
import { requestIp } from '../security/client-ip';

/**
 * Automated clients that are not visitors: search engines, link previewers,
 * monitors and scripts. No User-Agent does not count either; no browser omits
 * it. A short list on purpose: it covers the families that actually show up,
 * and the rest is accepted as the cost of not maintaining a long list.
 */
const AUTOMATED_UA =
  /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python|go-http-client|java\/|okhttp|axios\/|node-fetch|undici|libwww|scrapy|externalhit|preview/i;

/** Media server webhooks: machine-to-machine traffic, not visits. */
const WEBHOOK_PATH = /^\/api\/(plex|jellyfin|emby)\/webhook\//;


@Injectable()
export class GeoVisitorMiddleware implements NestMiddleware {
  private recentIps = new Map<string, number>();

  // Global cap on new IPs per minute. Every public IP not seen before
  // triggers an outbound query to the GeoIP provider, which cuts the origin off
  // if abused. The counter is per process and in memory; if the backend is ever
  // scaled to several replicas, this becomes a shared counter in Redis.
  private static readonly MAX_NEW_IPS_PER_WINDOW = 60;
  private static readonly RATE_WINDOW_MS = 60 * 1000;
  private windowStartedAt = Date.now();
  private recordedInWindow = 0;

  // Middleware runs before the auth guard, so req.user is never set here: the
  // session cookie is read directly (signature and expiry checked, no database).
  private readonly jwt: JwtService;
  private readonly jwtOptions: { issuer: string; audience: string };

  constructor(
    private readonly visitorsService: VisitorsService,
    config: ConfigService,
  ) {
    this.jwt = new JwtService({ secret: getRequiredSecret(config, 'JWT_SECRET') });
    this.jwtOptions = {
      issuer: config.get<string>('JWT_ISSUER') || 'plexsync',
      audience: config.get<string>('JWT_AUDIENCE') || 'plexsync-web',
    };
  }

  private sessionUser(req: Request): { id: string; username: string } | undefined {
    const token = readCookie(req, 'plexsync_session');
    if (!token) return undefined;
    try {
      const payload: any = this.jwt.verify(token, this.jwtOptions);
      return typeof payload?.sub === 'string' && typeof payload?.username === 'string'
        ? { id: payload.sub, username: payload.username }
        : undefined;
    } catch {
      return undefined;
    }
  }

  private canRecordNewIp(now: number): boolean {
    if (now - this.windowStartedAt > GeoVisitorMiddleware.RATE_WINDOW_MS) {
      this.windowStartedAt = now;
      this.recordedInWindow = 0;
    }
    if (this.recordedInWindow >= GeoVisitorMiddleware.MAX_NEW_IPS_PER_WINDOW) {
      return false;
    }
    this.recordedInWindow++;
    return true;
  }

  use(req: Request, _res: Response, next: NextFunction) {
    try {
      // Mounted with a wildcard, Express leaves `req.path` as "/" and the real path
      // in `originalUrl`; with `req.path` none of the exclusions below would match.
      const path = (req.originalUrl || req.url || '').split('?')[0];
      // Skip health endpoints, internal metrics and dashboard polling to avoid loops
      if (
        path === '/health' ||
        path === '/metrics' ||
        path.startsWith('/api/admin/dashboard') ||
        path.startsWith('/api/admin/chart') ||
        path.startsWith('/api/admin/activity-heatmap') ||
        path.startsWith('/api/covers/') ||
        WEBHOOK_PATH.test(path)
      ) {
        return next();
      }

      const userAgent = req.headers['user-agent']
        ? String(req.headers['user-agent']).slice(0, 512)
        : undefined;
      if (!userAgent || AUTOMATED_UA.test(userAgent)) return next();
      // Only what the interface itself sends counts. A scanner crawling /api/
      // with a Chrome User-Agent does not send this header; a browser running
      // the app always does.
      if (req.headers['x-requested-with'] !== 'SyncSekai') return next();

      const ip = requestIp(req);
      const user = this.sessionUser(req);

      // Cloudflare geo headers. Country is always present; city, region and
      // coordinates only with the "visitor location headers" transform enabled.
      const header = (name: string, maxLength: number) =>
        req.headers[name] ? String(req.headers[name]).slice(0, maxLength).trim() : undefined;
      const countryHeader = header('cf-ipcountry', 8)?.toUpperCase();
      const lat = Number(header('cf-iplatitude', 24));
      const lon = Number(header('cf-iplongitude', 24));

      const geoHeaders: GeoHeaders = {
        country: countryHeader && countryHeader !== 'XX' && countryHeader !== 'T1' ? countryHeader : undefined,
        city: header('cf-ipcity', 128),
        region: header('cf-region', 128),
        lat: Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? lat : undefined,
        lon: Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? lon : undefined,
      };

      const now = Date.now();
      // Throttled per account when signed in, so signing in counts at once.
      const throttleKey = user ? `user:${user.id}` : ip;
      const lastRecorded = this.recentIps.get(throttleKey) || 0;

      // 2-minute throttle per IP, to record activity without flooding the database
      if (now - lastRecorded > 2 * 60 * 1000 && this.canRecordNewIp(now)) {
        this.recentIps.set(throttleKey, now);
        if (this.recentIps.size > 2_000) {
          const oldest = [...this.recentIps.entries()]
            .sort((a, b) => a[1] - b[1])
            .slice(0, 500);
          for (const [ip] of oldest) this.recentIps.delete(ip);
        }

        this.visitorsService
          .recordVisitorIp(ip, user, userAgent, geoHeaders)
          .catch(() => {});
      }
    } catch {}
    next();
  }
}
