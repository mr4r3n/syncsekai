import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { isIP } from 'net';
import { AdminService } from '../../modules/admin/admin.service';

function normalizeIp(value: string): string {
  return value.replace(/^::ffff:/, '').trim();
}

function isPrivateOrReserved(ip: string): boolean {
  return (
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '0.0.0.0' ||
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
 * Una cabecera de IP solo es utilizable si contiene una dirección bien formada y pública.
 *
 * Nginx no filtra CF-Connecting-IP ni True-Client-IP, así que cualquiera que alcance
 * el frontend directamente (está publicado en la LAN) puede inventárselas. Sin esta
 * validación, el valor llega tal cual a la base de datos y provoca una consulta
 * saliente al proveedor GeoIP por cada valor distinto.
 *
 * Una CF-Connecting-IP auténtica siempre es pública: si es privada, viene falsificada.
 */
function isUsableHeaderIp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ip = normalizeIp(value);
  return isIP(ip) !== 0 && !isPrivateOrReserved(ip);
}

function extractClientIp(req: Request): string {
  // 1. Cabeceras de CDN / proxy, en orden de preferencia (Cloudflare, CDN enterprise, Nginx)
  for (const header of ['cf-connecting-ip', 'true-client-ip', 'x-real-ip']) {
    const value = req.headers[header];
    if (isUsableHeaderIp(value)) {
      return normalizeIp(value);
    }
  }

  // 2. X-Forwarded-For: primera entrada que sea una IP pública válida
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const rawList = Array.isArray(forwardedFor) ? forwardedFor.join(',') : String(forwardedFor);
    for (const part of rawList.split(',')) {
      if (isUsableHeaderIp(part)) {
        return normalizeIp(part);
      }
    }
  }

  // 3. Express req.ip o socket. Aquí sí se aceptan direcciones privadas: es el peer
  //    real y el panel las muestra como "Red Local (LAN)".
  const peer = normalizeIp(String(req.ip || req.socket?.remoteAddress || '127.0.0.1'));
  return isIP(peer) !== 0 ? peer : '127.0.0.1';
}

@Injectable()
export class GeoVisitorMiddleware implements NestMiddleware {
  private recentIps = new Map<string, number>();

  // Techo global de IPs nuevas por minuto. Cada IP pública no vista antes
  // provoca una consulta saliente al proveedor GeoIP, que corta el servicio al origen
  // si se abusa. El contador es por proceso y en memoria; si algún día el backend se
  // escala a varias réplicas, esto pasa a ser un contador compartido en Redis.
  private static readonly MAX_NEW_IPS_PER_WINDOW = 60;
  private static readonly RATE_WINDOW_MS = 60 * 1000;
  private windowStartedAt = Date.now();
  private recordedInWindow = 0;

  constructor(private readonly adminService: AdminService) {}

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
      const path = req.path || '';
      // Omitir endpoints de salud, métricas internas y polling del dashboard para evitar bucles
      if (
        path === '/health' ||
        path === '/metrics' ||
        path.startsWith('/api/admin/dashboard') ||
        path.startsWith('/api/admin/chart') ||
        path.startsWith('/api/admin/activity-heatmap') ||
        path.startsWith('/api/covers/')
      ) {
        return next();
      }

      const clientIp = extractClientIp(req);
      const userAgent = req.headers['user-agent']
        ? String(req.headers['user-agent']).slice(0, 512)
        : undefined;
      const user = (req as any).user;

      // Extraer cabeceras geo de Cloudflare o Reverse Proxy
      const countryHeader = req.headers['cf-ipcountry']
        ? String(req.headers['cf-ipcountry']).slice(0, 8).trim().toUpperCase()
        : undefined;
      const cityHeader = req.headers['cf-ipcity']
        ? String(req.headers['cf-ipcity']).slice(0, 128).trim()
        : undefined;
      const regionHeader = req.headers['cf-region']
        ? String(req.headers['cf-region']).slice(0, 128).trim()
        : undefined;

      const geoHeaders = {
        country: countryHeader && countryHeader !== 'XX' && countryHeader !== 'T1' ? countryHeader : undefined,
        city: cityHeader,
        region: regionHeader,
      };

      const now = Date.now();
      const lastRecorded = this.recentIps.get(clientIp) || 0;

      // Throttle de 2 minutos por IP para registrar actividad y no saturar
      if (now - lastRecorded > 2 * 60 * 1000 && this.canRecordNewIp(now)) {
        this.recentIps.set(clientIp, now);
        if (this.recentIps.size > 2_000) {
          const oldest = [...this.recentIps.entries()]
            .sort((a, b) => a[1] - b[1])
            .slice(0, 500);
          for (const [ip] of oldest) this.recentIps.delete(ip);
        }

        this.adminService
          .recordVisitorIp(clientIp, user?.username, userAgent, geoHeaders)
          .catch(() => {});
      }
    } catch {}
    next();
  }
}
