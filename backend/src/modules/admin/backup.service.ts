import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface BackupItem {
  filename: string;
  sizeBytes: number;
  sizeFormatted: string;
  createdAt: string;
  type: 'DATABASE' | 'FULL_SYSTEM';
  source: 'MANUAL' | 'SCHEDULED' | 'IMPORTED';
  totalRecords: number;
  tablesCount: number;
}

export interface BackupScheduleConfig {
  enabled: boolean;
  frequency: 'HOURLY' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
  time: string; // '03:00'
  includeMedia: boolean;
  retentionCount: number;
  lastRunAt: string | null;
}

/**
 * Resuelve dónde escribir un fichero de una copia de seguridad, conservando su
 * subdirectorio ("uploads/avatars/x.webp"): la aplicación sirve avatares y
 * portadas desde subdirectorios distintos. Devuelve null si la ruta se sale
 * del directorio de destino.
 */
export function resolveRestoreTarget(uploadsDir: string, relPath: string): string | null {
  const base = path.resolve(uploadsDir);
  const normalized = String(relPath || '').trim().replace(/\\/g, '/');
  if (!normalized) return null;
  // Dentro de un paquete de copia las rutas son siempre relativas. Una ruta
  // absoluta o con letra de unidad es malformada u hostil: se rechaza en vez de
  // reescribirla en silencio a un destino distinto del que pedía.
  if (normalized.startsWith('/') || /^[a-zA-Z]:/.test(normalized)) return null;

  const relative = normalized.replace(/^uploads\//, '');
  if (!relative) return null;

  const target = path.resolve(base, relative);
  // Comparar con el separador incluido: sin él, "/app/uploads-malicioso"
  // pasaría un startsWith("/app/uploads").
  if (target !== base && !target.startsWith(base + path.sep)) {
    return null;
  }
  return target;
}

@Injectable()
export class BackupService {
  /*
   * Limites de tamano al restaurar. Un .gz pequeno puede descomprimirse en
   * gigabytes, asi que un fichero subido tiene un limite bajo; las copias del
   * propio directorio de copias tienen otro mucho mas alto.
   */
  /** Tamano maximo que se abre solo para leer la metadata en el listado. */
  private static readonly MAX_METADATA_PEEK_BYTES = 20 * 1024 * 1024;
  private static readonly MAX_UPLOADED_BACKUP_BYTES = 200 * 1024 * 1024;
  private static readonly MAX_LOCAL_BACKUP_BYTES = 2 * 1024 * 1024 * 1024;
  private static readonly MAX_UNCOMPRESSED_BACKUP_BYTES = 3 * 1024 * 1024 * 1024;
  private readonly logger = new Logger(BackupService.name);
  private readonly backupsDir = path.resolve(process.cwd(), 'backups');
  private readonly uploadsDir = path.resolve(process.cwd(), 'uploads');

  constructor(private prisma: PrismaService) {
    this.ensureDirectoryExists(this.backupsDir);
  }

  private ensureDirectoryExists(dirPath: string) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  /**
   * 1. Obtener la lista de backups existentes y la configuración del cronograma
   */
  async getBackupsList() {
    this.ensureDirectoryExists(this.backupsDir);

    const files = fs.readdirSync(this.backupsDir);
    const backups: BackupItem[] = [];

    for (const file of files) {
      if (!file.endsWith('.psbackup') && !file.endsWith('.json.gz') && !file.endsWith('.json')) {
        continue;
      }

      const filePath = path.join(this.backupsDir, file);
      try {
        const stats = fs.statSync(filePath);
        let type: 'DATABASE' | 'FULL_SYSTEM' = 'DATABASE';
        let source: 'MANUAL' | 'SCHEDULED' | 'IMPORTED' = 'MANUAL';
        let totalRecords = 0;
        let tablesCount = 0;

        // Intentar leer la metadata del archivo
        try {
          let contentStr = '';
          if (file.endsWith('.psbackup') || file.endsWith('.gz')) {
            /*
             * La metadata va dentro del propio fichero, asi que para leerla hay
             * que descomprimirlo entero. Con copias de 60 MB, y varias en la
             * carpeta, eso es descomprimir cientos de megas cada vez que se
             * abre la pantalla.
             *
             * Por encima de este tamano no se abre: el tipo y el origen se
             * deducen del nombre, que es justo lo que ya hacia el `catch` de
             * abajo. Se pierde el recuento de registros, que es un dato de
             * adorno en un listado.
             *
             * ponytail: lo correcto seria escribir la metadata en un fichero
             * aparte al crear la copia y leer ese. Cuando el listado moleste,
             * ese es el arreglo.
             */
            if (stats.size > BackupService.MAX_METADATA_PEEK_BYTES) {
              throw new Error('Demasiado grande para leer su metadata en el listado.');
            }
            const buffer = fs.readFileSync(filePath);
            const decompressed = zlib.gunzipSync(buffer, {
              maxOutputLength: BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES,
            });
            contentStr = decompressed.toString('utf8');
          } else {
            if (stats.size > BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES) {
              throw new Error('El respaldo supera el límite permitido.');
            }
            contentStr = fs.readFileSync(filePath, 'utf8');
          }

          const parsed = JSON.parse(contentStr);
          if (parsed.metadata) {
            type = parsed.metadata.type || (parsed.files ? 'FULL_SYSTEM' : 'DATABASE');
            source = parsed.metadata.source || 'MANUAL';
            totalRecords = parsed.metadata.totalRecords || 0;
            tablesCount = parsed.metadata.tablesCount || (parsed.data ? Object.keys(parsed.data).length : 0);
          }
        } catch {
          // Fallback a detección por nombre
          if (file.includes('full') || file.includes('system')) {
            type = 'FULL_SYSTEM';
          }
          if (file.includes('sched') || file.includes('auto')) {
            source = 'SCHEDULED';
          }
        }

        backups.push({
          filename: file,
          sizeBytes: stats.size,
          sizeFormatted: this.formatBytes(stats.size),
          createdAt: stats.mtime.toISOString(),
          type,
          source,
          totalRecords,
          tablesCount,
        });
      } catch (err: any) {
        this.logger.warn(`Error leyendo stats de backup ${file}: ${err.message}`);
      }
    }

    // Ordenar de más reciente a más antiguo
    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const schedule = await this.getScheduleConfig();

    return {
      backups,
      schedule,
      totalBackups: backups.length,
      storageUsedFormatted: this.formatBytes(backups.reduce((acc, b) => acc + b.sizeBytes, 0)),
    };
  }

  /**
   * 2. Obtener configuración del cronograma de backups
   */
  async getScheduleConfig(): Promise<BackupScheduleConfig> {
    const settings = await this.prisma.systemSetting.findMany({
      where: {
        key: {
          in: [
            'BACKUP_AUTO_ENABLED',
            'BACKUP_FREQUENCY',
            'BACKUP_TIME',
            'BACKUP_INCLUDE_MEDIA',
            'BACKUP_RETENTION_COUNT',
            'BACKUP_LAST_RUN',
          ],
        },
      },
    });

    const getVal = (k: string, def: string) => settings.find((s) => s.key === k)?.value ?? def;

    return {
      enabled: getVal('BACKUP_AUTO_ENABLED', 'false') === 'true',
      frequency: (getVal('BACKUP_FREQUENCY', 'DAILY') as any) || 'DAILY',
      time: getVal('BACKUP_TIME', '03:00'),
      includeMedia: getVal('BACKUP_INCLUDE_MEDIA', 'true') === 'true',
      retentionCount: parseInt(getVal('BACKUP_RETENTION_COUNT', '7'), 10) || 7,
      lastRunAt: getVal('BACKUP_LAST_RUN', '') || null,
    };
  }

  /**
   * 3. Guardar configuración del cronograma de backups
   */
  async saveScheduleConfig(dto: Partial<BackupScheduleConfig>) {
    const updates: { key: string; value: string }[] = [];

    if (dto.enabled !== undefined) {
      updates.push({ key: 'BACKUP_AUTO_ENABLED', value: String(dto.enabled) });
    }
    if (dto.frequency) {
      updates.push({ key: 'BACKUP_FREQUENCY', value: dto.frequency });
    }
    if (dto.time) {
      updates.push({ key: 'BACKUP_TIME', value: dto.time });
    }
    if (dto.includeMedia !== undefined) {
      updates.push({ key: 'BACKUP_INCLUDE_MEDIA', value: String(dto.includeMedia) });
    }
    if (dto.retentionCount !== undefined) {
      updates.push({ key: 'BACKUP_RETENTION_COUNT', value: String(dto.retentionCount) });
    }

    for (const item of updates) {
      await this.prisma.systemSetting.upsert({
        where: { key: item.key },
        update: { value: item.value },
        create: { key: item.key, value: item.value, isSecret: false },
      });
    }

    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'BACKUP',
        message: 'Configuración de copias de seguridad automáticas actualizada',
        details: dto as any,
      },
    });

    return {
      success: true,
      message: 'Programación de copias de seguridad guardada correctamente.',
      schedule: await this.getScheduleConfig(),
    };
  }

  /**
   * 4. Crear Backup (Base de Datos o Completo con Archivos Multimedia)
   */
  async createBackup(type: 'DATABASE' | 'FULL_SYSTEM' = 'DATABASE', source: 'MANUAL' | 'SCHEDULED' = 'MANUAL') {
    this.ensureDirectoryExists(this.backupsDir);

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const timestampStr = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const filename = `plexsync_${type === 'FULL_SYSTEM' ? 'full' : 'db'}_${source === 'SCHEDULED' ? 'auto_' : ''}${timestampStr}.psbackup`;
    const filePath = path.join(this.backupsDir, filename);

    this.logger.log(`Iniciando creación de copia de seguridad (${type}, origen: ${source})...`);

    try {
      // 1. Extraer todas las tablas de PostgreSQL
      const [
        systemSettings,
        domainPolicies,
        users,
        userSettings,
        plexConnections,
        jellyfinConnections,
        animeConnections,
        titleMappings,
        userFavorites,
        blacklistEntries,
        scrobbleHistories,
        notifications,
        tickets,
        ticketMessages,
        systemAnnouncements,
        systemMetrics,
        auditLogs,
        embyConnections,
        siteLinks,
        announcementPresets,
        ticketAttachments,
      ] = await Promise.all([
        this.prisma.systemSetting.findMany(),
        this.prisma.domainPolicy.findMany(),
        this.prisma.user.findMany(),
        this.prisma.userSettings.findMany(),
        this.prisma.plexConnection.findMany(),
        this.prisma.jellyfinConnection.findMany(),
        this.prisma.animeConnection.findMany(),
        this.prisma.titleMapping.findMany(),
        this.prisma.userFavorite.findMany(),
        this.prisma.blacklistEntry.findMany(),
        this.prisma.scrobbleHistory.findMany({ take: 50000, orderBy: { createdAt: 'desc' } }),
        this.prisma.notification.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }),
        this.prisma.ticket.findMany({ take: 2000, orderBy: { createdAt: 'desc' } }),
        this.prisma.ticketMessage.findMany({ take: 10000, orderBy: { createdAt: 'desc' } }),
        this.prisma.systemAnnouncement.findMany(),
        this.prisma.systemMetric.findMany({ take: 5000 }),
        this.prisma.auditLog.findMany({ take: 5000, orderBy: { createdAt: 'desc' } }),
        this.prisma.embyConnection.findMany(),
        this.prisma.siteLink.findMany(),
        this.prisma.announcementPreset.findMany(),
        this.prisma.ticketAttachment.findMany({ take: 10000 }),
      ]);

      const dataPayload = {
        systemSettings,
        domainPolicies,
        users,
        userSettings,
        plexConnections,
        jellyfinConnections,
        animeConnections,
        titleMappings,
        userFavorites,
        blacklistEntries,
        scrobbleHistories,
        notifications,
        tickets,
        ticketMessages,
        systemAnnouncements,
        systemMetrics,
        auditLogs,
        embyConnections,
        siteLinks,
        announcementPresets,
        ticketAttachments,
      };

      let totalRecords = 0;
      for (const key of Object.keys(dataPayload)) {
        totalRecords += (dataPayload as any)[key].length;
      }

      // 2. Extraer archivos multimedia si es FULL_SYSTEM
      const filesPayload: Record<string, string> = {};
      if (type === 'FULL_SYSTEM') {
        const readFilesRecursive = (dir: string, baseRelative: string) => {
          if (!fs.existsSync(dir)) return;
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const entry of entries) {
            const fullP = path.join(dir, entry.name);
            const relP = path.join(baseRelative, entry.name).replace(/\\/g, '/');
            if (entry.isDirectory()) {
              readFilesRecursive(fullP, relP);
            } else if (entry.isFile()) {
              try {
                const buf = fs.readFileSync(fullP);
                filesPayload[relP] = buf.toString('base64');
              } catch (e: any) {
                this.logger.warn(`No se pudo incluir archivo ${relP}: ${e.message}`);
              }
            }
          }
        };

        readFilesRecursive(this.uploadsDir, 'uploads');
      }

      // 3. Crear paquete final estructurado
      const packageObj = {
        metadata: {
          app: 'SyncSekai',
          version: '3.3',
          backupVersion: 2,
          generatedAt: now.toISOString(),
          type,
          source,
          totalRecords,
          tablesCount: Object.keys(dataPayload).length,
          filesCount: Object.keys(filesPayload).length,
        },
        data: dataPayload,
        files: filesPayload,
      };

      // 4. Comprimir a formato .psbackup (gzipped JSON)
      const jsonStr = JSON.stringify(packageObj);
      const compressedBuffer = zlib.gzipSync(Buffer.from(jsonStr, 'utf8'), { level: 9 });
      fs.writeFileSync(filePath, compressedBuffer);

      const stats = fs.statSync(filePath);

      this.logger.log(`Copia de seguridad creada exitosamente: ${filename} (${this.formatBytes(stats.size)})`);

      // 5. Registrar log de auditoría
      await this.prisma.auditLog.create({
        data: {
          level: 'INFO',
          service: 'BACKUP',
          message: `Copia de seguridad ${source === 'SCHEDULED' ? 'automática' : 'manual'} generada (${type})`,
          details: {
            filename,
            sizeBytes: stats.size,
            totalRecords,
            type,
            source,
          },
        },
      });

      // 6. Si es automático, podar backups antiguos según retención
      if (source === 'SCHEDULED') {
        await this.pruneOldBackups();
      }

      return {
        success: true,
        message: 'Copia de seguridad generada exitosamente.',
        filename,
        sizeBytes: stats.size,
        sizeFormatted: this.formatBytes(stats.size),
        createdAt: now.toISOString(),
        totalRecords,
        type,
        source,
      };
    } catch (err: any) {
      this.logger.error(`Error generando copia de seguridad: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Fallo al generar copia de seguridad: ${err.message}`);
    }
  }

  /**
   * 5. Descargar archivo de copia de seguridad
   */
  getBackupFilePath(filename: string): string {
    const cleanName = path.basename(filename);
    const filePath = path.join(this.backupsDir, cleanName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`El archivo de respaldo ${cleanName} no existe.`);
    }

    return filePath;
  }

  /**
   * 6. Eliminar archivo de copia de seguridad
   */
  async deleteBackup(filename: string) {
    const cleanName = path.basename(filename);
    const filePath = path.join(this.backupsDir, cleanName);

    if (!fs.existsSync(filePath)) {
      throw new NotFoundException(`El archivo de respaldo ${cleanName} no existe.`);
    }

    fs.unlinkSync(filePath);

    await this.prisma.auditLog.create({
      data: {
        level: 'WARN',
        service: 'BACKUP',
        message: `Copia de seguridad eliminada: ${cleanName}`,
      },
    });

    return {
      success: true,
      message: `Copia de seguridad ${cleanName} eliminada correctamente.`,
    };
  }

  /**
   * 7. Restaurar copia de seguridad
   */
  async restoreBackup(filenameOrBuffer: string | Buffer) {
    this.logger.log('Iniciando proceso de restauración de copia de seguridad...');

    let parsedPackage: any = null;

    try {
      let buffer: Buffer;
      // Un fichero de nuestro directorio de copias no es lo mismo que uno que
      // llega de fuera: el primero lo escribimos nosotros.
      let esLocal: boolean;
      if (typeof filenameOrBuffer === 'string') {
        const filePath = this.getBackupFilePath(filenameOrBuffer);
        buffer = fs.readFileSync(filePath);
        esLocal = true;
      } else {
        buffer = filenameOrBuffer;
        esLocal = false;
      }

      const limite = esLocal
        ? BackupService.MAX_LOCAL_BACKUP_BYTES
        : BackupService.MAX_UPLOADED_BACKUP_BYTES;
      if (buffer.length > limite) {
        const mb = (n: number) => `${(n / (1024 * 1024)).toFixed(1)} MB`;
        throw new BadRequestException(
          `El archivo de respaldo pesa ${mb(buffer.length)} y el límite es ${mb(limite)}.`,
        );
      }

      try {
        const decompressed = zlib.gunzipSync(buffer, {
          maxOutputLength: BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES,
        });
        parsedPackage = JSON.parse(decompressed.toString('utf8'));
      } catch {
        if (buffer.length > BackupService.MAX_UNCOMPRESSED_BACKUP_BYTES) {
          throw new Error('El respaldo descomprimido supera el límite permitido.');
        }
        parsedPackage = JSON.parse(buffer.toString('utf8'));
      }
    } catch (err: any) {
      throw new BadRequestException(`El archivo de respaldo está corrupto o no tiene un formato válido: ${err.message}`);
    }

    if (!parsedPackage.data) {
      throw new BadRequestException('El archivo de respaldo no contiene datos reconocibles.');
    }

    const { data, files } = parsedPackage;
    let restoredCount = 0;

    try {
      // 1. Restaurar SystemSettings
      if (Array.isArray(data.systemSettings)) {
        for (const item of data.systemSettings) {
          await this.prisma.systemSetting.upsert({
            where: { key: item.key },
            update: { value: item.value, isSecret: item.isSecret ?? false },
            create: { key: item.key, value: item.value, isSecret: item.isSecret ?? false },
          });
          restoredCount++;
        }
      }

      // 2. Restaurar DomainPolicies
      if (Array.isArray(data.domainPolicies)) {
        for (const item of data.domainPolicies) {
          await this.prisma.domainPolicy.upsert({
            where: { domain: item.domain },
            update: { isAllowed: item.isAllowed, reason: item.reason },
            create: { domain: item.domain, isAllowed: item.isAllowed, reason: item.reason },
          });
          restoredCount++;
        }
      }

      // 3. Restaurar Usuarios
      if (Array.isArray(data.users)) {
        for (const u of data.users) {
          await this.prisma.user.upsert({
            where: { id: u.id },
            update: {
              userToken: u.userToken || `usr_live_${u.id}`,
              email: u.email,
              username: u.username,
              passwordHash: u.passwordHash,
              role: u.role,
              isActive: u.isActive ?? true,
              activationToken: u.activationToken,
              activationExpiresAt: u.activationExpiresAt ? new Date(u.activationExpiresAt) : null,
              twoFactorEnabled: u.twoFactorEnabled ?? false,
              twoFactorSecret: u.twoFactorSecret,
              twoFactorType: u.twoFactorType ?? 'NONE',
              emailOtpCode: u.emailOtpCode,
              emailOtpExpiresAt: u.emailOtpExpiresAt ? new Date(u.emailOtpExpiresAt) : null,
              webhookToken: u.webhookToken || `whk_live_${u.id}`,
              avatarUrl: u.avatarUrl,
              googleId: u.googleId,
              discordId: u.discordId,
              githubId: u.githubId,
              passwordResetToken: u.passwordResetToken,
              passwordResetExpiresAt: u.passwordResetExpiresAt ? new Date(u.passwordResetExpiresAt) : null,
            },
            create: {
              id: u.id,
              userToken: u.userToken || `usr_live_${u.id}`,
              email: u.email,
              username: u.username,
              passwordHash: u.passwordHash,
              role: u.role,
              isActive: u.isActive ?? true,
              activationToken: u.activationToken,
              activationExpiresAt: u.activationExpiresAt ? new Date(u.activationExpiresAt) : null,
              twoFactorEnabled: u.twoFactorEnabled ?? false,
              twoFactorSecret: u.twoFactorSecret,
              twoFactorType: u.twoFactorType ?? 'NONE',
              emailOtpCode: u.emailOtpCode,
              emailOtpExpiresAt: u.emailOtpExpiresAt ? new Date(u.emailOtpExpiresAt) : null,
              webhookToken: u.webhookToken || `whk_live_${u.id}`,
              avatarUrl: u.avatarUrl,
              googleId: u.googleId,
              discordId: u.discordId,
              githubId: u.githubId,
              passwordResetToken: u.passwordResetToken,
              passwordResetExpiresAt: u.passwordResetExpiresAt ? new Date(u.passwordResetExpiresAt) : null,
              createdAt: u.createdAt ? new Date(u.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 4. Restaurar UserSettings
      if (Array.isArray(data.userSettings)) {
        for (const s of data.userSettings) {
          await this.prisma.userSettings.upsert({
            where: { userId: s.userId },
            update: {
              completionPercentage: s.completionPercentage ?? 85,
              syncRatings: s.syncRatings ?? true,
              emailErrorAlerts: s.emailErrorAlerts ?? true,
              autoApproveMappings: s.autoApproveMappings ?? true,
              preferredTracker: s.preferredTracker ?? 'BOTH',
              blockedGenres: s.blockedGenres ?? [],
              canScrobble: s.canScrobble ?? true,
              canAccessCatalog: s.canAccessCatalog ?? true,
              canEditMappings: s.canEditMappings ?? true,
              canSyncAnilist: s.canSyncAnilist ?? true,
              canSyncMal: s.canSyncMal ?? true,
              isSuspended: s.isSuspended ?? false,
            },
            create: {
              userId: s.userId,
              completionPercentage: s.completionPercentage ?? 85,
              syncRatings: s.syncRatings ?? true,
              emailErrorAlerts: s.emailErrorAlerts ?? true,
              autoApproveMappings: s.autoApproveMappings ?? true,
              preferredTracker: s.preferredTracker ?? 'BOTH',
              blockedGenres: s.blockedGenres ?? [],
              canScrobble: s.canScrobble ?? true,
              canAccessCatalog: s.canAccessCatalog ?? true,
              canEditMappings: s.canEditMappings ?? true,
              canSyncAnilist: s.canSyncAnilist ?? true,
              canSyncMal: s.canSyncMal ?? true,
              isSuspended: s.isSuspended ?? false,
            },
          });
          restoredCount++;
        }
      }

      // 5. Restaurar Conexiones Plex
      if (Array.isArray(data.plexConnections)) {
        for (const p of data.plexConnections) {
          await this.prisma.plexConnection.upsert({
            where: { userId: p.userId },
            update: {
              serverName: p.serverName,
              serverUrl: p.serverUrl,
              plexUsername: p.plexUsername,
              encryptedAuthToken: p.encryptedAuthToken,
              monitoredLibraries: p.monitoredLibraries ?? [],
              isConnected: p.isConnected ?? false,
              lastSyncAt: p.lastSyncAt ? new Date(p.lastSyncAt) : null,
            },
            create: {
              id: p.id,
              userId: p.userId,
              serverName: p.serverName,
              serverUrl: p.serverUrl,
              plexUsername: p.plexUsername,
              encryptedAuthToken: p.encryptedAuthToken,
              monitoredLibraries: p.monitoredLibraries ?? [],
              isConnected: p.isConnected ?? false,
              lastSyncAt: p.lastSyncAt ? new Date(p.lastSyncAt) : null,
              createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 5.1 Restaurar Conexiones Jellyfin
      if (Array.isArray(data.jellyfinConnections)) {
        for (const j of data.jellyfinConnections) {
          await this.prisma.jellyfinConnection.upsert({
            where: { userId: j.userId },
            update: {
              serverName: j.serverName,
              serverUrl: j.serverUrl,
              jellyfinUsername: j.jellyfinUsername,
              encryptedApiKey: j.encryptedApiKey,
              monitoredLibraries: j.monitoredLibraries ?? [],
              isConnected: j.isConnected ?? false,
              lastSyncAt: j.lastSyncAt ? new Date(j.lastSyncAt) : null,
            },
            create: {
              id: j.id,
              userId: j.userId,
              serverName: j.serverName,
              serverUrl: j.serverUrl,
              jellyfinUsername: j.jellyfinUsername,
              encryptedApiKey: j.encryptedApiKey,
              monitoredLibraries: j.monitoredLibraries ?? [],
              isConnected: j.isConnected ?? false,
              lastSyncAt: j.lastSyncAt ? new Date(j.lastSyncAt) : null,
              createdAt: j.createdAt ? new Date(j.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 6. Restaurar Conexiones Anime
      if (Array.isArray(data.animeConnections)) {
        for (const a of data.animeConnections) {
          await this.prisma.animeConnection.upsert({
            where: {
              userId_provider: {
                userId: a.userId,
                provider: a.provider,
              },
            },
            update: {
              remoteUsername: a.remoteUsername,
              remoteUserId: a.remoteUserId,
              avatarUrl: a.avatarUrl,
              encryptedAccessToken: a.encryptedAccessToken,
              encryptedRefreshToken: a.encryptedRefreshToken,
              tokenExpiresAt: a.tokenExpiresAt ? new Date(a.tokenExpiresAt) : null,
              isConnected: a.isConnected ?? true,
              lastLatencyMs: a.lastLatencyMs,
              lastCheckedAt: a.lastCheckedAt ? new Date(a.lastCheckedAt) : null,
            },
            create: {
              id: a.id,
              userId: a.userId,
              provider: a.provider,
              remoteUsername: a.remoteUsername,
              remoteUserId: a.remoteUserId,
              avatarUrl: a.avatarUrl,
              encryptedAccessToken: a.encryptedAccessToken,
              encryptedRefreshToken: a.encryptedRefreshToken,
              tokenExpiresAt: a.tokenExpiresAt ? new Date(a.tokenExpiresAt) : null,
              isConnected: a.isConnected ?? true,
              lastLatencyMs: a.lastLatencyMs,
              lastCheckedAt: a.lastCheckedAt ? new Date(a.lastCheckedAt) : null,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 7. Restaurar TitleMappings
      if (Array.isArray(data.titleMappings)) {
        for (const m of data.titleMappings) {
          await this.prisma.titleMapping.upsert({
            where: {
              userId_plexTitle_plexSeason: {
                userId: m.userId,
                plexTitle: m.plexTitle,
                plexSeason: m.plexSeason ?? 1,
              },
            },
            update: {
              anilistMediaId: m.anilistMediaId,
              anilistTitle: m.anilistTitle,
              malMediaId: m.malMediaId,
              malTitle: m.malTitle,
              confidenceScore: m.confidenceScore ?? 1.0,
              isApproved: m.isApproved ?? true,
              isManual: m.isManual ?? false,
              isGlobal: m.isGlobal ?? false,
            },
            create: {
              id: m.id,
              userId: m.userId,
              plexTitle: m.plexTitle,
              plexSeason: m.plexSeason ?? 1,
              anilistMediaId: m.anilistMediaId,
              anilistTitle: m.anilistTitle,
              malMediaId: m.malMediaId,
              malTitle: m.malTitle,
              confidenceScore: m.confidenceScore ?? 1.0,
              isApproved: m.isApproved ?? true,
              isManual: m.isManual ?? false,
              isGlobal: m.isGlobal ?? false,
              createdAt: m.createdAt ? new Date(m.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 7.1 Restaurar Favoritos del Usuario
      if (Array.isArray(data.userFavorites)) {
        for (const f of data.userFavorites) {
          const animeId = f.animeId || String(f.anilistMediaId || f.id);
          await this.prisma.userFavorite.upsert({
            where: {
              userId_animeId: {
                userId: f.userId,
                animeId,
              },
            },
            update: {
              title: f.title,
              coverUrl: f.coverUrl || f.coverImage || null,
              genres: f.genres ?? [],
            },
            create: {
              id: f.id,
              userId: f.userId,
              animeId,
              title: f.title,
              coverUrl: f.coverUrl || f.coverImage || null,
              genres: f.genres ?? [],
              createdAt: f.createdAt ? new Date(f.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 8. Restaurar BlacklistEntries
      if (Array.isArray(data.blacklistEntries)) {
        for (const b of data.blacklistEntries) {
          await this.prisma.blacklistEntry.upsert({
            where: { id: b.id },
            update: {
              titlePattern: b.titlePattern,
              reason: b.reason,
            },
            create: {
              id: b.id,
              userId: b.userId,
              titlePattern: b.titlePattern,
              reason: b.reason,
              createdAt: b.createdAt ? new Date(b.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9. Restaurar Historial de Scrobbles
      if (Array.isArray(data.scrobbleHistories)) {
        for (const h of data.scrobbleHistories) {
          await this.prisma.scrobbleHistory.upsert({
            where: { id: h.id },
            update: {
              showTitle: h.showTitle,
              episodeNumber: h.episodeNumber,
              seasonNumber: h.seasonNumber ?? 1,
              viewPercentage: h.viewPercentage ?? 100,
              rating: h.rating,
              anilistStatus: h.anilistStatus ?? 'SUCCESS',
              malStatus: h.malStatus ?? 'SUCCESS',
              kitsuStatus: h.kitsuStatus ?? 'PENDING',
              source: h.source ?? null,
              serverName: h.serverName ?? null,
              libraryName: h.libraryName ?? null,
              errorMessage: h.errorMessage,
              payloadSnapshot: h.payloadSnapshot,
              viewedAt: h.viewedAt ? new Date(h.viewedAt) : new Date(),
            },
            create: {
              id: h.id,
              userId: h.userId,
              showTitle: h.showTitle,
              episodeNumber: h.episodeNumber,
              seasonNumber: h.seasonNumber ?? 1,
              viewPercentage: h.viewPercentage ?? 100,
              rating: h.rating,
              anilistStatus: h.anilistStatus ?? 'SUCCESS',
              malStatus: h.malStatus ?? 'SUCCESS',
              kitsuStatus: h.kitsuStatus ?? 'PENDING',
              source: h.source ?? null,
              serverName: h.serverName ?? null,
              libraryName: h.libraryName ?? null,
              errorMessage: h.errorMessage,
              payloadSnapshot: h.payloadSnapshot,
              viewedAt: h.viewedAt ? new Date(h.viewedAt) : new Date(),
              createdAt: h.createdAt ? new Date(h.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.1 Restaurar Notificaciones
      if (Array.isArray(data.notifications)) {
        for (const n of data.notifications) {
          await this.prisma.notification.upsert({
            where: { id: n.id },
            update: {
              type: n.type,
              title: n.title,
              message: n.message,
              isRead: n.isRead ?? false,
              metadata: n.metadata,
            },
            create: {
              id: n.id,
              userId: n.userId,
              type: n.type,
              title: n.title,
              message: n.message,
              isRead: n.isRead ?? false,
              metadata: n.metadata,
              createdAt: n.createdAt ? new Date(n.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.2 Restaurar Tickets de Soporte
      if (Array.isArray(data.tickets)) {
        for (const t of data.tickets) {
          const lastReplyAt = t.lastReplyAt ? new Date(t.lastReplyAt) : new Date();
          await this.prisma.ticket.upsert({
            where: { id: t.id },
            update: {
              subject: t.subject,
              category: t.category,
              priority: t.priority,
              status: t.status,
              lastReplyAt,
              closedAt: t.closedAt ? new Date(t.closedAt) : null,
            },
            create: {
              id: t.id,
              userId: t.userId,
              subject: t.subject,
              category: t.category,
              priority: t.priority,
              status: t.status,
              lastReplyAt,
              closedAt: t.closedAt ? new Date(t.closedAt) : null,
              createdAt: t.createdAt ? new Date(t.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.3 Restaurar Mensajes de Tickets
      if (Array.isArray(data.ticketMessages)) {
        for (const tm of data.ticketMessages) {
          await this.prisma.ticketMessage.upsert({
            where: { id: tm.id },
            update: {
              content: tm.content,
              isStaff: tm.isStaff ?? false,
              isInternalNote: tm.isInternalNote ?? false,
            },
            create: {
              id: tm.id,
              ticketId: tm.ticketId,
              senderId: tm.senderId,
              content: tm.content,
              isStaff: tm.isStaff ?? false,
              isInternalNote: tm.isInternalNote ?? false,
              createdAt: tm.createdAt ? new Date(tm.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9.4 Restaurar Anuncios del Sistema
      const annList = data.systemAnnouncements || data.announcements;
      if (Array.isArray(annList)) {
        for (const a of annList) {
          await this.prisma.systemAnnouncement.upsert({
            where: { id: a.id },
            update: {
              isActive: a.isActive ?? false,
              category: a.category ?? 'FESTIVE',
              themePreset: a.themePreset ?? 'CUSTOM',
              badgeText: a.badgeText,
              badgeBgColor: a.badgeBgColor,
              badgeTextColor: a.badgeTextColor,
              message: a.message,
              mediaType: a.mediaType ?? 'NONE',
              mediaUrl: a.mediaUrl,
              mediaPosition: a.mediaPosition ?? 'LEFT',
              backgroundType: a.backgroundType ?? 'GRADIENT',
              backgroundValue: a.backgroundValue,
              textColor: a.textColor,
              effectType: a.effectType ?? 'NONE',
              enableGlobalAtmosphere: a.enableGlobalAtmosphere ?? true,
              ctaText: a.ctaText,
              ctaUrl: a.ctaUrl,
              ctaTarget: a.ctaTarget ?? '_self',
              ctaBgColor: a.ctaBgColor,
              ctaTextColor: a.ctaTextColor,
              isClosable: a.isClosable ?? true,
              targetAudience: a.targetAudience ?? 'ALL',
              startsAt: a.startsAt ? new Date(a.startsAt) : null,
              endsAt: a.endsAt ? new Date(a.endsAt) : null,
              dismissExpiryDays: a.dismissExpiryDays ?? 7,
            },
            create: {
              id: a.id,
              isActive: a.isActive ?? false,
              category: a.category ?? 'FESTIVE',
              themePreset: a.themePreset ?? 'CUSTOM',
              badgeText: a.badgeText,
              badgeBgColor: a.badgeBgColor,
              badgeTextColor: a.badgeTextColor,
              message: a.message,
              mediaType: a.mediaType ?? 'NONE',
              mediaUrl: a.mediaUrl,
              mediaPosition: a.mediaPosition ?? 'LEFT',
              backgroundType: a.backgroundType ?? 'GRADIENT',
              backgroundValue: a.backgroundValue,
              textColor: a.textColor,
              effectType: a.effectType ?? 'NONE',
              enableGlobalAtmosphere: a.enableGlobalAtmosphere ?? true,
              ctaText: a.ctaText,
              ctaUrl: a.ctaUrl,
              ctaTarget: a.ctaTarget ?? '_self',
              ctaBgColor: a.ctaBgColor,
              ctaTextColor: a.ctaTextColor,
              isClosable: a.isClosable ?? true,
              targetAudience: a.targetAudience ?? 'ALL',
              startsAt: a.startsAt ? new Date(a.startsAt) : null,
              endsAt: a.endsAt ? new Date(a.endsAt) : null,
              dismissExpiryDays: a.dismissExpiryDays ?? 7,
              createdAt: a.createdAt ? new Date(a.createdAt) : new Date(),
            },
          });
          restoredCount++;
        }
      }

      // 9 bis. Tablas secundarias. scripts/check-backup-cobertura.ts comprueba
      // que todo lo que se guarda se restaura.
      for (const [clave, restaurar] of [
        ['systemMetrics', (item: any) =>
          this.prisma.systemMetric.upsert({
            where: {
              metricKey_ipAddress_dateKey: {
                metricKey: item.metricKey,
                ipAddress: item.ipAddress ?? null,
                dateKey: item.dateKey,
              },
            },
            update: { value: item.value, metadata: item.metadata ?? undefined },
            create: {
              metricKey: item.metricKey,
              ipAddress: item.ipAddress ?? null,
              dateKey: item.dateKey,
              value: item.value ?? 1,
              metadata: item.metadata ?? undefined,
            },
          })],
        ['embyConnections', (item: any) =>
          this.prisma.embyConnection.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
        ['siteLinks', (item: any) =>
          this.prisma.siteLink.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
        ['announcementPresets', (item: any) =>
          this.prisma.announcementPreset.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
        ['auditLogs', (item: any) =>
          // El registro de auditoria es historia, no configuracion. Se restaura
          // igual para que la copia sea fiel: si no, los numeros de "guardados"
          // y "restaurados" no cuadraban y no habia forma de saber por que.
          this.prisma.auditLog.upsert({
            where: { id: item.id },
            update: {},
            create: item,
          })],
        ['ticketAttachments', (item: any) =>
          this.prisma.ticketAttachment.upsert({
            where: { id: item.id },
            update: { ...item, id: undefined },
            create: item,
          })],
      ] as Array<[string, (item: any) => Promise<unknown>]>) {
        if (!Array.isArray(data[clave])) continue;
        for (const item of data[clave]) {
          try {
            await restaurar(item);
            restoredCount++;
          } catch (e: any) {
            // Una fila que no encaja -por ejemplo, un adjunto de un ticket que
            // ya no existe- no puede tumbar la restauracion entera.
            this.logger.warn(`No se pudo restaurar una fila de ${clave}: ${e?.message || e}`);
          }
        }
      }

      // 10. Restaurar Archivos Multimedia (Avatares y Portadas)
      let restoredFilesCount = 0;
      const uploadsDir = path.resolve(process.cwd(), 'uploads');
      this.ensureDirectoryExists(uploadsDir);

      if (files && typeof files === 'object') {
        for (const relPath of Object.keys(files)) {
          try {
            const base64Data = files[relPath];
            // Conserva el subdirectorio (avatars/, covers/) y bloquea el path traversal.
            const targetP = resolveRestoreTarget(uploadsDir, relPath);
            if (!targetP) {
              this.logger.warn(`Intento de Path Traversal bloqueado en backup restore: ${relPath}`);
              continue;
            }
            this.ensureDirectoryExists(path.dirname(targetP));
            fs.writeFileSync(targetP, Buffer.from(base64Data, 'base64'));
            restoredFilesCount++;
          } catch (e: any) {
            this.logger.warn(`No se pudo restaurar archivo ${relPath}: ${e.message}`);
          }
        }
      }

      this.logger.log(`Restauración completada con éxito. Registros: ${restoredCount}, Archivos: ${restoredFilesCount}`);

      await this.prisma.auditLog.create({
        data: {
          level: 'INFO',
          service: 'BACKUP',
          message: 'Copia de seguridad restaurada exitosamente',
          details: {
            restoredCount,
            restoredFilesCount,
            metadata: parsedPackage.metadata,
          },
        },
      });

      return {
        success: true,
        message: `Restauración completada con éxito. Se procesaron ${restoredCount} registros y ${restoredFilesCount} archivos.`,
        restoredRecords: restoredCount,
        restoredFiles: restoredFilesCount,
        metadata: parsedPackage.metadata,
      };
    } catch (err: any) {
      this.logger.error(`Error durante la restauración: ${err.message}`, err.stack);
      throw new InternalServerErrorException(`Error durante la restauración de datos: ${err.message}`);
    }
  }

  /**
   * 8. Podar backups antiguos según la cantidad de retención configurada
   */
  async pruneOldBackups() {
    try {
      const schedule = await this.getScheduleConfig();
      const retention = Math.max(1, schedule.retentionCount || 7);

      const files = fs.readdirSync(this.backupsDir);
      const autoBackups: { file: string; mtime: number }[] = [];

      for (const file of files) {
        if (file.includes('auto_') || file.includes('sched')) {
          const p = path.join(this.backupsDir, file);
          const st = fs.statSync(p);
          autoBackups.push({ file, mtime: st.mtimeMs });
        }
      }

      autoBackups.sort((a, b) => b.mtime - a.mtime);

      if (autoBackups.length > retention) {
        const toDelete = autoBackups.slice(retention);
        for (const item of toDelete) {
          const p = path.join(this.backupsDir, item.file);
          fs.unlinkSync(p);
          this.logger.log(`Backup automático podado por retención: ${item.file}`);
        }
      }
    } catch (err: any) {
      this.logger.warn(`Error en poda de backups antiguos: ${err.message}`);
    }
  }

  /**
   * 9. Cron Runner: Ejecutado periódicamente para procesar backups programados
   */
  @Cron('*/15 * * * *') // Cada 15 minutos verifica si corresponde ejecutar backup
  async handleScheduledCron() {
    try {
      const schedule = await this.getScheduleConfig();
      if (!schedule.enabled) return;

      const now = new Date();
      const currentHour = now.getHours();
      const currentMinute = now.getMinutes();
      const [targetHour, targetMinute] = schedule.time.split(':').map((v) => parseInt(v, 10) || 0);

      // Si no es el bloque de la hora objetivo (con ventana de 15 min), omitir
      if (schedule.frequency !== 'HOURLY') {
        if (currentHour !== targetHour || currentMinute > 15) {
          return;
        }
      }

      // Validar si ya se ejecutó hoy o en el intervalo correspondiente
      if (schedule.lastRunAt) {
        const lastRun = new Date(schedule.lastRunAt);
        const diffHours = (now.getTime() - lastRun.getTime()) / (1000 * 60 * 60);

        if (schedule.frequency === 'HOURLY' && diffHours < 0.9) return;
        if (schedule.frequency === 'DAILY' && diffHours < 20) return;
        if (schedule.frequency === 'WEEKLY' && diffHours < 140) return;
        if (schedule.frequency === 'MONTHLY' && diffHours < 650) return;
      }

      this.logger.log(`Ejecutando copia de seguridad automática programada (${schedule.frequency})...`);

      const type = schedule.includeMedia ? 'FULL_SYSTEM' : 'DATABASE';
      await this.createBackup(type, 'SCHEDULED');

      // Actualizar fecha de última ejecución
      await this.prisma.systemSetting.upsert({
        where: { key: 'BACKUP_LAST_RUN' },
        update: { value: now.toISOString() },
        create: { key: 'BACKUP_LAST_RUN', value: now.toISOString(), isSecret: false },
      });
    } catch (err: any) {
      this.logger.error(`Error en cron de backups automáticos: ${err.message}`);
    }
  }
}
