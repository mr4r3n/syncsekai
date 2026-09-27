import * as crypto from 'crypto';

/** One-time tokens are stored hashed; the plain value only travels by email. */
export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
}
