import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import { isIP } from 'net';

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
 * An IP header is only usable if it holds a well-formed public address.
 *
 * Nginx does not filter CF-Connecting-IP or True-Client-IP, so anyone who
 * reaches the frontend directly (it is published on the LAN) can make them up.
 * Without this validation, the value reaches the database as is and triggers
 * an outbound query to the GeoIP provider for every distinct value.
 *
 * A genuine CF-Connecting-IP is always public: if it is private, it is forged.
 */
function isUsableHeaderIp(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const ip = normalizeIp(value);
  return isIP(ip) !== 0 && !isPrivateOrReserved(ip);
}

/**
 * The visitor's real IP address.
 *
 * Every request reaches the backend through the Next.js rewrite, so the socket
 * peer (and Express's req.ip) is always the frontend container: using it made
 * every session show the same address and put all users in one rate-limit
 * bucket. The address Cloudflare saw is in CF-Connecting-IP.
 */
export function requestIp(req: Request): string {
  // 1. CDN / proxy headers, in order of preference (Cloudflare, enterprise CDN, Nginx)
  for (const header of ['cf-connecting-ip', 'true-client-ip', 'x-real-ip']) {
    const value = req.headers[header];
    if (isUsableHeaderIp(value)) {
      return normalizeIp(value);
    }
  }

  // 2. X-Forwarded-For: first entry that is a valid public IP
  const forwardedFor = req.headers['x-forwarded-for'];
  if (forwardedFor) {
    const rawList = Array.isArray(forwardedFor) ? forwardedFor.join(',') : String(forwardedFor);
    for (const part of rawList.split(',')) {
      if (isUsableHeaderIp(part)) {
        return normalizeIp(part);
      }
    }
  }

  // 3. Express req.ip or the socket. Private addresses are accepted here: it is the
  //    real peer and the panel shows them as "Local network (LAN)".
  const peer = normalizeIp(String(req.ip || req.socket?.remoteAddress || '127.0.0.1'));
  return isIP(peer) !== 0 ? peer : '127.0.0.1';
}

/** Rate limits per visitor, not per frontend container (see requestIp). */
@Injectable()
export class ClientIpThrottlerGuard extends ThrottlerGuard {
  protected async getTracker(req: Record<string, any>): Promise<string> {
    return requestIp(req as Request);
  }
}
