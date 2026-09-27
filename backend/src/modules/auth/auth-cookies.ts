import type { Response } from 'express';
import { randomBytes } from 'crypto';

export function setSessionCookie(res: Response, accessToken: string) {
  res.cookie('plexsync_session', accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

/*
 * OAuth transaction cookie.
 *
 * It lives as long as the state (15 minutes) and is only sent to /api/auth,
 * the only place that reads it. `sameSite: 'lax'` is what is needed and as
 * strict as possible: the provider callback arrives as a top-level GET
 * navigation, and in that case Lax does send the cookie; 'strict' would not,
 * and would break sign-in itself.
 */
export function setOAuthTxCookie(res: Response, txSecret: string) {
  res.cookie('plexsync_oauth_tx', txSecret, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 15 * 60 * 1000,
  });
}

export function clearOAuthTxCookie(res: Response) {
  res.clearCookie('plexsync_oauth_tx', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
  });
}

/**
 * Reads a cookie from the raw header.
 *
 * The project does not use cookie-parser: the JWT strategy already splits the
 * header by hand (jwt.strategy.ts), so this does the same instead of adding a
 * dependency to read one value.
 */
export function readCookie(req: any, name: string): string {
  const header: string = req?.headers?.cookie || '';
  const chunk = header
    .split(';')
    .map((p: string) => p.trim())
    .find((p: string) => p.startsWith(`${name}=`));
  return chunk ? decodeURIComponent(chunk.slice(name.length + 1)) : '';
}

export function clearSessionCookie(res: Response) {
  res.clearCookie('plexsync_session', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
  });
}

const DEVICE_COOKIE = 'plexsync_device';

/**
 * Random id of this browser, kept for a year and only sent to /api/auth.
 *
 * Signing in again from the same browser replaces its previous session instead
 * of piling up duplicates. Before, "same browser" was guessed from IP + browser
 * + OS, so two profiles of the same browser on one PC signed each other out.
 */
export function deviceIdFrom(req: any, res: Response): string {
  const current = readCookie(req, DEVICE_COOKIE);
  const deviceId = /^[a-f0-9]{32}$/.test(current) ? current : randomBytes(16).toString('hex');
  res.cookie(DEVICE_COOKIE, deviceId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/api/auth',
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });
  return deviceId;
}
