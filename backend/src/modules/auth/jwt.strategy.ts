import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { getRequiredSecret } from '../../common/security/required-secret';
import { readCookie } from './auth-cookies';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
    private sessionsService: SessionsService,
  ) {
    const jwtSecret = getRequiredSecret(configService, 'JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => readCookie(request, 'plexsync_session') || null,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: jwtSecret,
      issuer: configService.get<string>('JWT_ISSUER') || 'plexsync',
      audience: configService.get<string>('JWT_AUDIENCE') || 'plexsync-web',
    });
  }

  async validate(payload: any) {
    if (
      !payload ||
      typeof payload.sub !== 'string' ||
      typeof payload.sessionToken !== 'string' ||
      typeof payload.userToken !== 'string' ||
      typeof payload.username !== 'string' ||
      !['ADMIN', 'USER'].includes(payload.role) ||
      typeof payload.iat !== 'number' ||
      typeof payload.exp !== 'number'
    ) {
      throw new UnauthorizedException('Invalid or corrupt session token.');
    }

    const user = await this.authService.validateUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('User not found or session expired.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('The user account is not active.');
    }
    if (user.settings?.isSuspended) {
      throw new UnauthorizedException('Your account has been suspended by an administrator.');
    }
    if (user.userToken !== payload.userToken) {
      throw new UnauthorizedException('The user token is invalid or has been renewed.');
    }
    if (user.username !== payload.username || user.role !== payload.role) {
      throw new UnauthorizedException('The account data or privileges have changed.');
    }

    const isValidSession = await this.sessionsService.validateSessionToken(
      user.id,
      payload.sessionToken,
    );
    if (!isValidSession) {
      throw new UnauthorizedException('Your session has been revoked or closed.');
    }
    this.sessionsService.touchSession(payload.sessionToken).catch(() => {});

    return {
      ...user,
      currentSessionToken: payload.sessionToken,
    };
  }
}
