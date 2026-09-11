import { Module } from '@nestjs/common';
import { ConnectionsService } from './connections.service';
import { ConnectionsController } from './connections.controller';
import { PlexModule } from '../plex/plex.module';
import { JellyfinModule } from '../jellyfin/jellyfin.module';
import { EmbyModule } from '../emby/emby.module';
import { AnilistModule } from '../anilist/anilist.module';
import { MalModule } from '../mal/mal.module';
import { KitsuModule } from '../kitsu/kitsu.module';

@Module({
  imports: [PlexModule, JellyfinModule, EmbyModule, AnilistModule, MalModule, KitsuModule],
  controllers: [ConnectionsController],
  providers: [ConnectionsService],
  exports: [ConnectionsService],
})
export class ConnectionsModule {}
