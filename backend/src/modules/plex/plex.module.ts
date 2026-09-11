import { Module } from '@nestjs/common';
import { PlexService } from './plex.service';
import { PlexController } from './plex.controller';
import { PlexWatcherService } from './plex-watcher.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { AnilistModule } from '../anilist/anilist.module';
import { MalModule } from '../mal/mal.module';
import { KitsuModule } from '../kitsu/kitsu.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [ConfigModule, AnilistModule, MalModule, KitsuModule, NotificationsModule],
  controllers: [PlexController],
  providers: [PlexService, PlexWatcherService, EncryptionService],
  exports: [PlexService, PlexWatcherService],
})
export class PlexModule {}
