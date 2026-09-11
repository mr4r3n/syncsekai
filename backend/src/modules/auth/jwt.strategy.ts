import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService } from './auth.service';
import { getRequiredSecret } from '../../common/security/required-secret';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    const jwtSecret = getRequiredSecret(configService, 'JWT_SECRET');
    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        (request: Request) => {
          const rawCookie = request?.headers?.cookie;
          if (!rawCookie) return null;
          const cookie = rawCookie
            .split(';')
            .map((part) => part.trim())
            .find((part) => part.startsWith('plexsync_session='));
          return cookie
            ? decodeURIComponent(cookie.slice('plexsync_session='.length))
            : null;
        },
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
      throw new UnauthorizedException('Token de sesión no válido o corrupto.');
    }

    const user = await this.authService.validateUserById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('Usuario no encontrado o sesión caducada.');
    }
    if (!user.isActive) {
      throw new UnauthorizedException('La cuenta de usuario no está activa.');
    }
    if (user.settings?.isSuspended) {
      throw new UnauthorizedException('Tu cuenta ha sido suspendida por un administrador.');
    }
    if (user.userToken !== payload.userToken) {
      throw new UnauthorizedException('El token de usuario es inválido o ha sido renovado.');
    }
    if (user.username !== payload.username || user.role !== payload.role) {
      throw new UnauthorizedException('Los datos o privilegios de la cuenta han cambiado.');
    }

    const isValidSession = await this.authService.validateSessionToken(
      user.id,
      payload.sessionToken,
    );
    if (!isValidSession) {
      throw new UnauthorizedException('Tu sesión ha sido revocada o cerrada.');
    }
    this.authService.touchSession(payload.sessionToken).catch(() => {});

    return {
      ...user,
      currentSessionToken: payload.sessionToken,
    };
  }
}
