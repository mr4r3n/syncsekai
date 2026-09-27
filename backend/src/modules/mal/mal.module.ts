import { Module } from '@nestjs/common';
import { MalService } from './mal.service';
import { MalController } from './mal.controller';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [ConfigModule],
  controllers: [MalController],
  providers: [MalService, EncryptionService],
  exports: [MalService],
})
export class MalModule {}
