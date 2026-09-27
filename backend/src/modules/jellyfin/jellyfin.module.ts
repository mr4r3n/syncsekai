import { Module } from '@nestjs/common';
import { JellyfinService } from './jellyfin.service';
import { JellyfinController } from './jellyfin.controller';
import { JellyfinWatcherService } from './jellyfin-watcher.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { PlexModule } from '../plex/plex.module';

@Module({
  // PlexModule is imported for ScrobblePipelineService.processScrobbleEvent(): the
  // generic scrobble pipeline lives in the Plex module.
  imports: [ConfigModule, PlexModule],
  controllers: [JellyfinController],
  providers: [JellyfinService, JellyfinWatcherService, EncryptionService],
  exports: [JellyfinService, JellyfinWatcherService],
})
export class JellyfinModule {}
