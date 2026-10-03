import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';
import { getRequiredSecret } from '../../common/security/required-secret';

/**
 * A path on this site, or undefined. Resolving it is what catches "/\t/evil.example":
 * browsers drop tabs and newlines from URLs and read it as "//evil.example".
 */
export function safeReturnPath(raw: unknown): string | undefined {
  if (typeof raw !== 'string' || !raw.startsWith('/')) return undefined;
  const base = 'https://return.invalid';
  try {
    const url = new URL(raw, base);
    return url.origin === base ? url.pathname + url.search + url.hash : undefined;
  } catch {
    return undefined;
  }
}

/** Signed, single-use OAuth state, bound to the browser that started the flow. */
@Injectable()
export class OAuthStateService {
  constructor(
    private prisma: PrismaService,
    private configService: ConfigService,
  ) {}

  /**
   * Cryptographically signed OAuth state against CSRF and account hijacking.
   */
  async createOAuthState(payload: {
    returnTo?: string;
    userId?: string;
    provider: 'google' | 'discord';
    intent: 'login' | 'link';
  }): Promise<{ state: string; txSecret: string }> {
    const secret = getRequiredSecret(this.configService, 'OAUTH_STATE_SECRET');
    const cleanReturnTo = safeReturnPath(payload.returnTo) || '/connections';
    const nonce = crypto.randomBytes(32).toString('hex');

    /*
     * Transaction secret: what binds this state TO THE BROWSER that requested it.
     *
     * Without it, the state would only prove "we issued it, it has not expired
     * and it has not been used": nothing would say which browser it started in.
     * Anyone could sign in with THEIR identity, keep their own callback before
     * spending it and get someone else to open it; that browser would end up with
     * the first person's session, and any services it linked afterwards would
     * hang off that foreign account.
     *
     * The secret travels in a browser cookie and only its hash goes inside the
     * signed state, so whoever intercepts the state cannot forge the cookie.
     */
    const txSecret = crypto.randomBytes(32).toString('hex');
    const txHash = crypto.createHash('sha256').update(txSecret).digest('hex');

    const data = JSON.stringify({
      returnTo: cleanReturnTo,
      userId: payload.userId || '',
      provider: payload.provider,
      intent: payload.intent,
      ts: Date.now(),
      nonce,
      txHash,
    });
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    const stateKey = `OAUTH_STATE_${crypto.createHash('sha256').update(nonce).digest('hex')}`;
    const stateValue = crypto.createHash('sha256').update(data).digest('hex');
    await this.prisma.systemSetting.create({
      data: { key: stateKey, value: stateValue, isSecret: true },
    });
    await this.prisma.systemSetting.deleteMany({
      where: {
        key: { startsWith: 'OAUTH_STATE_' },
        updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    return {
      state: Buffer.from(JSON.stringify({ data, sig: hmac })).toString('base64url'),
      txSecret,
    };
  }

  /**
   * Verifies the OAuth state signature and expiry.
   */
  async consumeOAuthState(
    state: string,
    expectedProvider: 'google' | 'discord',
    txSecret: string,
  ): Promise<{ returnTo: string; userId?: string; intent: 'login' | 'link' }> {
    const secret = getRequiredSecret(this.configService, 'OAUTH_STATE_SECRET');
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (typeof decoded.data !== 'string' || !/^[a-f0-9]{64}$/.test(decoded.sig)) {
        throw new Error('Malformed OAuth state');
      }
      const expectedSig = crypto.createHmac('sha256', secret).update(decoded.data).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(decoded.sig, 'hex'))) {
        throw new Error('Invalid OAuth state signature');
      }
      const parsed = JSON.parse(decoded.data);
      if (
        typeof parsed.ts !== 'number' ||
        parsed.ts > Date.now() + 30_000 ||
        Date.now() - parsed.ts > 15 * 60 * 1000 ||
        typeof parsed.nonce !== 'string' ||
        typeof parsed.txHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(parsed.txHash) ||
        parsed.provider !== expectedProvider ||
        !['login', 'link'].includes(parsed.intent) ||
        (parsed.intent === 'link' && (typeof parsed.userId !== 'string' || !parsed.userId.trim())) ||
        (parsed.intent === 'login' && parsed.userId)
      ) {
        throw new Error('Expired or inconsistent OAuth state');
      }
      /*
       * The browser check, before spending the state and before redeeming the code.
       *
       * It goes here on purpose: if it were checked afterwards, a callback
       * presented in another browser would already have burned the state (and
       * with it its owner's chance to use it) even if it were then rejected.
       */
      const receivedTxHash = crypto
        .createHash('sha256')
        .update(txSecret || '')
        .digest('hex');
      if (
        !txSecret ||
        !crypto.timingSafeEqual(
          Buffer.from(receivedTxHash, 'hex'),
          Buffer.from(parsed.txHash, 'hex'),
        )
      ) {
        throw new Error('OAuth state from a different browser');
      }

      const stateKey = `OAUTH_STATE_${crypto.createHash('sha256').update(parsed.nonce).digest('hex')}`;
      const stateValue = crypto.createHash('sha256').update(decoded.data).digest('hex');
      const consumed = await this.prisma.systemSetting.deleteMany({
        where: { key: stateKey, value: stateValue },
      });
      if (consumed.count !== 1) throw new Error('OAuth state already used');
      const cleanReturnTo = safeReturnPath(parsed.returnTo) || '/connections';
      return {
        returnTo: cleanReturnTo,
        userId: parsed.userId ? String(parsed.userId) : undefined,
        intent: parsed.intent,
      };
    } catch {
      throw new UnauthorizedException('Invalid, expired or reused OAuth state.');
    }
  }
}
