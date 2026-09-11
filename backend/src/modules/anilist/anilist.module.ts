import { Module } from '@nestjs/common';
import { AnilistService } from './anilist.service';
import { AnilistController } from './anilist.controller';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [AnilistController],
  providers: [AnilistService, EncryptionService],
  exports: [AnilistService],
})
export class AnilistModule {}
