import { Module } from '@nestjs/common';
import { EmbyService } from './emby.service';
import { EmbyController } from './emby.controller';
import { EmbyWatcherService } from './emby-watcher.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { PlexModule } from '../plex/plex.module';

@Module({
  // PlexModule is imported for ScrobblePipelineService.processScrobbleEvent(): the
  // generic scrobble pipeline lives in the Plex module.
  imports: [ConfigModule, PlexModule],
  controllers: [EmbyController],
  providers: [EmbyService, EmbyWatcherService, EncryptionService],
  exports: [EmbyService, EmbyWatcherService],
})
export class EmbyModule {}
