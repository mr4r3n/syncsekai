import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { json, urlencoded } from 'express';

async function bootstrap() {
  const logger = new Logger('SyncSekaiBootstrap');
  const app = await NestFactory.create(AppModule);

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT') || 4000;
  const frontendUrl = configService.get<string>('FRONTEND_URL') || 'http://localhost:3000';
  const trustProxyHops = Number(configService.get<string>('TRUST_PROXY_HOPS') || '0');
  app.getHttpAdapter().getInstance().set(
    'trust proxy',
    Number.isInteger(trustProxyHops) && trustProxyHops > 0 ? trustProxyHops : false,
  );
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '64kb', parameterLimit: 100 }));

  // HTTP security headers with Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Trusted origins
  const allowedOrigins = new Set([
    frontendUrl.replace(/\/$/, ''),
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:4000',
    'http://127.0.0.1:4000',
  ]);

  const appDomain = configService.get<string>('APP_DOMAIN');
  if (appDomain) {
    allowedOrigins.add(appDomain.replace(/\/$/, ''));
  }

  // Secure CORS for the authorized origins
  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests without an origin (mobile apps, direct Plex webhooks, Postman)
      if (!origin) return callback(null, true);

      const normalizedOrigin = origin.replace(/\/$/, '');
      const isDev = process.env.NODE_ENV !== 'production';

      if (
        allowedOrigins.has(normalizedOrigin) ||
        (isDev &&
          /^http:\/\/(192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+|172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+)(:\d+)?$/.test(
            normalizedOrigin,
          ))
      ) {
        return callback(null, true);
      }

      logger.warn(`CORS blocked for unauthorized origin: ${origin}`);
      return callback(new ForbiddenException('CORS: origin not allowed by the security policy.'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port, '0.0.0.0');
  logger.log(`=========================================`);
  logger.log(`  SyncSekai Backend API running on port ${port}`);
  logger.log(`  Health & Auth: http://localhost:${port}/api/auth/check-domain`);
  logger.log(`  Connections: http://localhost:${port}/api/connections/hub`);
  logger.log(`=========================================`);
}
bootstrap().catch((error) => {
  console.error(error);
  process.exit(1);
});
