import { Module } from '@nestjs/common';
import { PlexService } from './plex.service';
import { PlexWebhookService } from './plex-webhook.service';
import { ScrobblePipelineService } from './scrobble-pipeline.service';
import { PlexController } from './plex.controller';
import { PlexWatcherService } from './plex-watcher.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { AnilistModule } from '../anilist/anilist.module';
import { MalModule } from '../mal/mal.module';
import { KitsuModule } from '../kitsu/kitsu.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MappingsModule } from '../mappings/mappings.module';

@Module({
  imports: [ConfigModule, AnilistModule, MalModule, KitsuModule, NotificationsModule, MappingsModule],
  controllers: [PlexController],
  providers: [PlexService, PlexWebhookService, ScrobblePipelineService, PlexWatcherService, EncryptionService],
  exports: [PlexService, PlexWebhookService, ScrobblePipelineService, PlexWatcherService],
})
export class PlexModule {}
