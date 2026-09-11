import { Module, NestModule, MiddlewareConsumer } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { PlexModule } from './modules/plex/plex.module';
import { JellyfinModule } from './modules/jellyfin/jellyfin.module';
import { EmbyModule } from './modules/emby/emby.module';
import { AnilistModule } from './modules/anilist/anilist.module';
import { MalModule } from './modules/mal/mal.module';
import { KitsuModule } from './modules/kitsu/kitsu.module';
import { ConnectionsModule } from './modules/connections/connections.module';
import { CatalogModule } from './modules/catalog/catalog.module';
import { HistoryModule } from './modules/history/history.module';
import { MappingsModule } from './modules/mappings/mappings.module';
import { BlacklistModule } from './modules/blacklist/blacklist.module';
import { AdminModule } from './modules/admin/admin.module';
import { SetupModule } from './modules/setup/setup.module';
import { CoversModule } from './modules/covers/covers.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AnnouncementsModule } from './modules/announcements/announcements.module';
import { TicketsModule } from './modules/tickets/tickets.module';
import { GeoVisitorMiddleware } from './common/middleware/geo-visitor.middleware';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60000, // 60 segundos
        limit: 300, // 300 peticiones por minuto por defecto (5 req/s)
      },
    ]),
    PrismaModule,
    SetupModule,
    CoversModule,
    NotificationsModule,
    AnnouncementsModule,
    TicketsModule,
    AuthModule,
    PlexModule,
    JellyfinModule,
    EmbyModule,
    AnilistModule,
    MalModule,
    KitsuModule,
    ConnectionsModule,
    CatalogModule,
    HistoryModule,
    MappingsModule,
    BlacklistModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(GeoVisitorMiddleware).forRoutes('*');
  }
}
