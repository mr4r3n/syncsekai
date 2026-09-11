import { Module, Global, forwardRef } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { BackupService } from './backup.service';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../../common/crypto/encryption.service';

@Global()
@Module({
  // Los avatares predeterminados los gestiona AuthService, que es donde vive la
  // tuberia de validacion de imagenes; el panel solo aporta el control de acceso.
  imports: [forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [AdminService, BackupService, EncryptionService],
  exports: [AdminService, BackupService],
})
export class AdminModule {}
