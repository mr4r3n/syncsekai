import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { MailService } from './mail.service';
import { SessionsService } from './sessions.service';
import { OAuthStateService } from './oauth-state.service';
import { AvatarsService } from './avatars.service';
import { RegistrationService } from './registration.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import { TwoFactorService } from './two-factor.service';
import { AccountService } from './account.service';
import { AuthController } from './auth.controller';
import { SocialAuthController } from './social-auth.controller';
import { JwtStrategy } from './jwt.strategy';

import { EncryptionService } from '../../common/crypto/encryption.service';
import { getRequiredSecret } from '../../common/security/required-secret';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => {
        const secret = getRequiredSecret(configService, 'JWT_SECRET');
        return {
          secret,
          signOptions: {
            expiresIn: (configService.get<string>('JWT_EXPIRES_IN') || '7d') as any,
            issuer: configService.get<string>('JWT_ISSUER') || 'plexsync',
            audience: configService.get<string>('JWT_AUDIENCE') || 'plexsync-web',
          },
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController, SocialAuthController],
  providers: [
    AuthService,
    MailService,
    SessionsService,
    OAuthStateService,
    AvatarsService,
    RegistrationService,
    AccountLifecycleService,
    TwoFactorService,
    AccountService,
    JwtStrategy,
    EncryptionService,
  ],
  exports: [AvatarsService, JwtModule, PassportModule],
})
export class AuthModule {}
