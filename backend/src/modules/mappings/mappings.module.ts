import { Module } from '@nestjs/common';
import { MappingsService } from './mappings.service';
import { MappingsController } from './mappings.controller';
import { CommunityMappingService } from './community-mapping.service';
import { CommunityMappingController } from './community-mapping.controller';
import { AnilistModule } from '../anilist/anilist.module';
import { KitsuModule } from '../kitsu/kitsu.module';

@Module({
  imports: [AnilistModule, KitsuModule],
  controllers: [MappingsController, CommunityMappingController],
  providers: [MappingsService, CommunityMappingService],
  exports: [MappingsService, CommunityMappingService],
})
export class MappingsModule {}
