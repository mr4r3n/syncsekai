import { Module, Global } from '@nestjs/common';
import { CoversService } from './covers.service';
import { AnimeMetadataService } from './anime-metadata.service';
import { CoversController } from './covers.controller';

@Global()
@Module({
  controllers: [CoversController],
  providers: [CoversService, AnimeMetadataService],
  exports: [CoversService, AnimeMetadataService],
})
export class CoversModule {}
