import { Module } from '@nestjs/common';
import { MappingsService } from './mappings.service';
import { MappingsController } from './mappings.controller';
import { AnilistModule } from '../anilist/anilist.module';
import { KitsuModule } from '../kitsu/kitsu.module';

@Module({
  imports: [AnilistModule, KitsuModule],
  controllers: [MappingsController],
  providers: [MappingsService],
  exports: [MappingsService],
})
export class MappingsModule {}
