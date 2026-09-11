import { Module } from '@nestjs/common';
import { EmbyService } from './emby.service';
import { EmbyController } from './emby.controller';
import { EmbyWatcherService } from './emby-watcher.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { PlexModule } from '../plex/plex.module';

@Module({
  // PlexModule se importa por PlexService.processScrobbleEvent(): la tubería
  // genérica de scrobble vive ahí (ver el comentario ponytail en plex.service.ts).
  imports: [ConfigModule, PlexModule],
  controllers: [EmbyController],
  providers: [EmbyService, EmbyWatcherService, EncryptionService],
  exports: [EmbyService, EmbyWatcherService],
})
export class EmbyModule {}
