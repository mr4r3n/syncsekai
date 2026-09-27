import { Module, Global, forwardRef } from '@nestjs/common';
import { SiteSettingsService } from './site-settings.service';
import { MetricsService } from './metrics.service';
import { AdminUsersService } from './admin-users.service';
import { SystemHealthService } from './system-health.service';
import { VisitorsService } from './visitors.service';
import { AdminMediaService } from './admin-media.service';
import { SiteLinksService } from './site-links.service';
import { AdminController } from './admin.controller';
import { BackupService } from './backup.service';
import { BackupRestoreService } from './backup-restore.service';
import { AuthModule } from '../auth/auth.module';
import { EncryptionService } from '../../common/crypto/encryption.service';

@Global()
@Module({
  // Default avatars are managed by AvatarsService, where the image validation
  // pipeline lives; the panel only adds access control.
  imports: [forwardRef(() => AuthModule)],
  controllers: [AdminController],
  providers: [
    SiteSettingsService,
    MetricsService,
    AdminUsersService,
    SystemHealthService,
    VisitorsService,
    AdminMediaService,
    SiteLinksService,
    BackupService,
    BackupRestoreService,
    EncryptionService,
  ],
  exports: [VisitorsService, BackupService],
})
export class AdminModule {}
