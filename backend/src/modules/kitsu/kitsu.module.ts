import { Module } from '@nestjs/common';
import { KitsuService } from './kitsu.service';
import { KitsuController } from './kitsu.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [PrismaModule, ConfigModule],
  controllers: [KitsuController],
  providers: [KitsuService, EncryptionService],
  exports: [KitsuService],
})
export class KitsuModule {}
