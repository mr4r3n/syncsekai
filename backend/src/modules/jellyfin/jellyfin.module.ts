import { Module } from '@nestjs/common';
import { JellyfinService } from './jellyfin.service';
import { JellyfinController } from './jellyfin.controller';
import { JellyfinWatcherService } from './jellyfin-watcher.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { PlexModule } from '../plex/plex.module';

@Module({
  // PlexModule se importa por PlexService.processScrobbleEvent(): la tubería
  // genérica de scrobble vive ahí (ver el comentario ponytail en plex.service.ts).
  imports: [ConfigModule, PlexModule],
  controllers: [JellyfinController],
  providers: [JellyfinService, JellyfinWatcherService, EncryptionService],
  exports: [JellyfinService, JellyfinWatcherService],
})
export class JellyfinModule {}
