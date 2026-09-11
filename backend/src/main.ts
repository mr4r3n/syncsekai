import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe, Logger } from '@nestjs/common';
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

  // Configurar encabezados de seguridad HTTP con Helmet
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
      crossOriginEmbedderPolicy: false,
    }),
  );

  // Lista de orígenes de confianza
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

  // Habilitar CORS seguro para los orígenes autorizados
  app.enableCors({
    origin: (origin, callback) => {
      // Permitir peticiones sin origen (como apps móviles, webhooks de Plex directo o Postman)
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

      logger.warn(`CORS bloqueado para origen no autorizado: ${origin}`);
      return callback(new Error('CORS: Origen no permitido por la política de seguridad.'), false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  });

  // Validation pipe global
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
bootstrap();
