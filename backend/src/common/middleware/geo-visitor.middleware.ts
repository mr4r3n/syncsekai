import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';
import { isIP } from 'net';
import { AdminService, type GeoHeaders } from '../../modules/admin/admin.service';

/**
 * Clientes automáticos que no son visitantes: buscadores, previsualizadores de
 * enlaces, monitores y scripts. Sin User-Agent tampoco cuenta; ningún navegador
 * lo omite. Lista corta a propósito: se cubren las familias que llegan de
 * verdad y el resto se acepta como el coste de no mantener una lista larga.
 */
const UA_AUTOMATICO =
  /bot|crawl|spider|slurp|headless|lighthouse|pingdom|uptime|monitor|curl\/|wget\/|python|go-http-client|java\/|okhttp|axios\/|node-fetch|undici|libwww|scrapy|externalhit|preview/i;

/** Webhooks de los servidores multimedia: tráfico máquina a máquina, no visitas. */
const RUTA_WEBHOOK = /^\/api\/(plex|jellyfin|emby)\/webhook\//;

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
        path.startsWith('/api/covers/') ||
        RUTA_WEBHOOK.test(path)
      ) {
        return next();
      }

      const userAgent = req.headers['user-agent']
        ? String(req.headers['user-agent']).slice(0, 512)
        : undefined;
      if (!userAgent || UA_AUTOMATICO.test(userAgent)) return next();

      const clientIp = extractClientIp(req);
      const user = (req as any).user;

      // Cabeceras geo de Cloudflare. País viene siempre; ciudad, región y
      // coordenadas solo con la transformación "visitor location headers" activa.
      const cabecera = (nombre: string, largo: number) =>
        req.headers[nombre] ? String(req.headers[nombre]).slice(0, largo).trim() : undefined;
      const countryHeader = cabecera('cf-ipcountry', 8)?.toUpperCase();
      const lat = Number(cabecera('cf-iplatitude', 24));
      const lon = Number(cabecera('cf-iplongitude', 24));

      const geoHeaders: GeoHeaders = {
        country: countryHeader && countryHeader !== 'XX' && countryHeader !== 'T1' ? countryHeader : undefined,
        city: cabecera('cf-ipcity', 128),
        region: cabecera('cf-region', 128),
        lat: Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? lat : undefined,
        lon: Number.isFinite(lat) && Number.isFinite(lon) && (lat !== 0 || lon !== 0) ? lon : undefined,
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
