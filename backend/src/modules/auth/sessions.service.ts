import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { detectDeviceInfo } from './device-info';

/** Active sessions per device: validation, listing and revocation. */
@Injectable()
export class SessionsService {
  constructor(
    private prisma: PrismaService,
  ) {}

  // Active sessions and devices
  async validateSessionToken(userId: string, sessionToken: string): Promise<boolean> {
    if (!userId || !sessionToken) return false;
    const session = await this.prisma.session.findFirst({
      where: { userId, sessionToken },
    });
    return !!session;
  }

  async touchSession(sessionToken: string) {
    try {
      await this.prisma.session.update({
        where: { sessionToken },
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
      const deviceInfo = detectDeviceInfo(userAgent, clientIp);
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
    try {
      await this.prisma.session.deleteMany({
        where: { userId, sessionToken },
      });
    } catch {}
    return { message: 'Signed out.' };
  }
}
