import { Module } from '@nestjs/common';
import { SetupController } from './setup.controller';
import { SetupService } from './setup.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { EncryptionService } from '../../common/crypto/encryption.service';

@Module({
  imports: [PrismaModule],
  controllers: [SetupController],
  providers: [SetupService, EncryptionService],
  exports: [SetupService],
})
export class SetupModule {}
