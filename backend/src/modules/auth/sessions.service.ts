import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { detectDeviceInfo } from './device-info';
import { randomBytes } from 'crypto';
import { Cron, CronExpression } from '@nestjs/schedule';

/** Active sessions per device: validation, listing and revocation. */
@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  /**
   * Opens a session after a successful sign-in. A previous session of the same
   * browser (same `deviceId` cookie) is replaced, so signing in again does not
   * pile up duplicates; other browsers and profiles keep theirs.
   */
  async createSession(userId: string, clientIp: string, userAgent: string, deviceId: string | null, defaultAgent: string) {
    const sessionToken = `ses_live_${randomBytes(24).toString('hex')}`;
    const deviceInfo = detectDeviceInfo(userAgent);
    if (deviceId) {
      await this.prisma.session.deleteMany({ where: { userId, deviceId } }).catch(() => undefined);
    }
    await this.prisma.session.create({
      data: {
        userId,
        sessionToken,
        deviceId,
        ipAddress: clientIp,
        userAgent: userAgent || defaultAgent,
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        iconType: deviceInfo.iconType,
        lastActiveAt: new Date(),
      },
    });
    return sessionToken;
  }

  /**
   * Sessions whose sign-in token can no longer be valid (it lasts 7 days by
   * default; 30 days of inactivity leaves a wide margin). Without this, a browser
   * that lost its device cookie would leave its old session listed forever.
   */
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async purgeStaleSessions() {
    const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.session.deleteMany({ where: { lastActiveAt: { lt: cutoff } } });
    return count;
  }

  // Active sessions and devices
  async validateSessionToken(userId: string, sessionToken: string): Promise<boolean> {
    if (!userId || !sessionToken) return false;
    const session = await this.prisma.session.findFirst({
      where: { userId, sessionToken },
    });
    return !!session;
  }

  /** Marks the session as used; at most one write a minute, enough for "online now". */
  async touchSession(sessionToken: string) {
    try {
      await this.prisma.session.updateMany({
        where: { sessionToken, lastActiveAt: { lt: new Date(Date.now() - 60_000) } },
        data: { lastActiveAt: new Date() },
      });
    } catch {}
  }

  async getSessions(userId: string, currentSessionToken?: string, clientIp = '127.0.0.1', userAgent = '') {
    let sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });

    // If no sessions are stored yet, record the current one
    if (sessions.length === 0 && currentSessionToken) {
      const deviceInfo = detectDeviceInfo(userAgent);
      const fallbackSession = await this.prisma.session.create({
        data: {
          userId,
          sessionToken: currentSessionToken,
          ipAddress: clientIp,
          userAgent: userAgent || 'Web browser',
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          iconType: deviceInfo.iconType,
          lastActiveAt: new Date(),
        },
      });
      sessions = [fallbackSession];
    }

    return sessions.map((s) => ({
      id: s.id,
      sessionToken: s.sessionToken,
      ipAddress: s.ipAddress || '127.0.0.1',
      userAgent: s.userAgent,
      deviceName: s.deviceName || 'Unknown device',
      deviceType: s.deviceType || 'DESKTOP',
      browser: s.browser || 'Web browser',
      os: s.os || 'Unknown',
      iconType: s.iconType || 'DEFAULT',
      isCurrent: currentSessionToken ? s.sessionToken === currentSessionToken : false,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('The session does not exist or was already closed.');
    }
    await this.prisma.session.delete({ where: { id: sessionId } });
    return { message: 'Session revoked.' };
  }

  async revokeOtherSessions(userId: string, currentSessionToken?: string) {
    if (currentSessionToken) {
      await this.prisma.session.deleteMany({
        where: {
          userId,
          sessionToken: { not: currentSessionToken },
        },
      });
    } else {
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    }
    return { message: 'All other sessions have been signed out.' };
  }

  async revokeSessionByToken(userId: string, sessionToken: string) {
    // No silent catch: "signed out" while the session stays valid would be worse than an error.
    await this.prisma.session.deleteMany({
      where: { userId, sessionToken },
    });
    return { message: 'Signed out.' };
  }
}
