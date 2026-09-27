import { Module } from '@nestjs/common';
import { HistoryService } from './history.service';
import { HistoryController } from './history.controller';
import { AnilistModule } from '../anilist/anilist.module';
import { MalModule } from '../mal/mal.module';
import { KitsuModule } from '../kitsu/kitsu.module';

@Module({
  imports: [AnilistModule, MalModule, KitsuModule],
  controllers: [HistoryController],
  providers: [HistoryService],
  exports: [HistoryService],
})
export class HistoryModule {}
