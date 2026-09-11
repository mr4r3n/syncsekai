import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';
import { AnilistModule } from '../anilist/anilist.module';
import { MalModule } from '../mal/mal.module';
import { KitsuModule } from '../kitsu/kitsu.module';

@Module({
  imports: [ConfigModule, AnilistModule, MalModule, KitsuModule],
  controllers: [CatalogController],
  providers: [CatalogService, EncryptionService],
  exports: [CatalogService],
})
export class CatalogModule {}
