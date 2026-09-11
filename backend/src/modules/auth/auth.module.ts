import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
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
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EncryptionService],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
