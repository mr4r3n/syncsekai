import { Injectable, ForbiddenException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { InitializeSetupDto, TestSmtpDto } from './setup.dto';
import * as bcrypt from 'bcryptjs';
import * as nodemailer from 'nodemailer';
import * as crypto from 'crypto';
import { ConfigService } from '@nestjs/config';
import { getRequiredSecret } from '../../common/security/required-secret';
import { validateNetworkHost } from '../../common/security/network-target';
import { buscarRed } from '../../common/security/redes-sociales';
import { AJUSTES_SITIO, resolverAjustesSitio } from '../../common/security/ajustes-sitio';
import { plantillaCorreo, escapar } from '../../common/email/plantilla-correo';
import { isIP } from 'net';

@Injectable()
export class SetupService {
  private readonly logger = new Logger(SetupService.name);

  constructor(
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  private verifyBootstrapToken(provided: string) {
    const expected = getRequiredSecret(this.configService, 'SETUP_BOOTSTRAP_TOKEN');
    const left = Buffer.from(provided || '', 'utf8');
    const right = Buffer.from(expected, 'utf8');
    if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
      throw new ForbiddenException('Token bootstrap no válido.');
    }
  }

  async getSetupStatus() {
    const initSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'SYSTEM_INITIALIZED' },
    });

    const adminCount = await this.prisma.user.count({
      where: { role: 'ADMIN' },
    });

    const isInstalled = (initSetting?.value === 'true' && adminCount > 0);

    return {
      isInstalled,
      requiresSetup: !isInstalled,
    };
  }

  /**
   * Cifras públicas de la portada.
   *
   * Todo lo que sale de aquí se mide o se cuenta; sin datos se devuelve null,
   * no un valor por defecto.
   */
  async getPublicStats() {
    const startDb = Date.now();
    // El resultado importa: es la única medición real de que la base responde.
    const baseViva = await this.prisma
      .$queryRaw`SELECT 1`
      .then(() => true)
      .catch(() => false);
    const dbLatencyMs = Date.now() - startDb;

    const [totalScrobbles, successfulScrobbles, totalUsers, totalMappings, recientes] =
      await Promise.all([
        this.prisma.scrobbleHistory.count().catch(() => 0),
        this.prisma.scrobbleHistory
          .count({ where: { OR: [{ anilistStatus: 'SUCCESS' }, { malStatus: 'SUCCESS' }] } })
          .catch(() => 0),
        this.prisma.user.count().catch(() => 0),
        this.prisma.titleMapping.count().catch(() => 0),
        /*
         * Los últimos envíos a cada tracker, que es de donde sale su estado.
         *
         * La alternativa era llamar a AniList y a MAL en cada visita a la
         * portada: se paga con la latencia de la página, se puede acabar
         * limitado por sus APIs, y aun así solo diría si responden a un
         * desconocido, no si NUESTROS envíos funcionan. Lo segundo es lo que le
         * importa a quien mira esta página.
         */
        this.prisma.scrobbleHistory
          .findMany({
            take: 50,
            orderBy: { viewedAt: 'desc' },
            select: { anilistStatus: true, malStatus: true, kitsuStatus: true },
          })
          .catch(() => [] as Array<{ anilistStatus: string; malStatus: string; kitsuStatus: string }>),
      ]);

    /** ONLINE si el último intento conocido salió bien; DEGRADED si falló; sin datos, desconocido. */
    const estadoTracker = (campo: 'anilistStatus' | 'malStatus' | 'kitsuStatus') => {
      const intentos = recientes
        .map((r: any) => r[campo])
        .filter((s: string) => s === 'SUCCESS' || s === 'FAILED');
      if (intentos.length === 0) return 'UNKNOWN';
      return intentos[0] === 'SUCCESS' ? 'ONLINE' : 'DEGRADED';
    };

    // Sin scrobbles no hay tasa de acierto: un porcentaje inventado aquí es
    // justo el dato que alguien usaría para decidir si fiarse del servicio.
    const successRate =
      totalScrobbles > 0
        ? `${((successfulScrobbles / totalScrobbles) * 100).toFixed(1)}%`
        : null;

    // Uptime del propio servicio, no del anfitrión: os.uptime() delataba públicamente
    // cuánto lleva sin reiniciarse la máquina, que es información de parcheado y no
    // aporta nada a una página de estado.
    const serviceUptimeSeconds = Math.floor(process.uptime());
    const days = Math.floor(serviceUptimeSeconds / 86400);
    const hours = Math.floor((serviceUptimeSeconds % 86400) / 3600);
    const mins = Math.floor((serviceUptimeSeconds % 3600) / 60);
    const uptimeFormatted = days > 0 ? `${days}d ${hours}h ${mins}m` : `${hours}h ${mins}m`;

    const servicios = {
      // El backend está contestando a esta misma petición.
      backend: 'ONLINE',
      database: baseViva ? 'ONLINE' : 'OFFLINE',
      anilist: estadoTracker('anilistStatus'),
      mal: estadoTracker('malStatus'),
      kitsu: estadoTracker('kitsuStatus'),
    };

    return {
      // Se degrada si algo de lo que sí medimos no está bien.
      status:
        !baseViva || Object.values(servicios).includes('DEGRADED') ? 'DEGRADED' : 'OPERATIONAL',
      uptimeFormatted,
      // `uptimePercentage` se retira: no se mide en ningún sitio. Volverá cuando
      // haya un registro de caídas del que calcularlo.
      successRate,
      latency: `${dbLatencyMs}ms`,
      totalScrobbles,
      totalUsers,
      totalMappings,
      services: servicios,
    };
  }


  async getMaintenanceStatus() {
    const [enabledSetting, messageSetting, endSetting] = await Promise.all([
      this.prisma.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MODE' } }).catch(() => null),
      this.prisma.systemSetting.findUnique({ where: { key: 'MAINTENANCE_MESSAGE' } }).catch(() => null),
      this.prisma.systemSetting.findUnique({ where: { key: 'MAINTENANCE_ESTIMATED_END' } }).catch(() => null),
    ]);

    return {
      inMaintenance: enabledSetting?.value === 'true',
      message: messageSetting?.value || 'Estamos optimizando los motores de sincronización de SyncSekai. Volveremos en breve.',
      estimatedEnd: endSetting?.value || null,
    };
  }

  /** Nombre, título, descripción, contacto y estado del registro. Todo público. */
  async getSiteSettings() {
    const filas = await this.prisma.systemSetting.findMany({
      where: { key: { in: AJUSTES_SITIO.map((a) => a.clave) } },
      select: { key: true, value: true },
    });
    return resolverAjustesSitio(new Map(filas.map((f) => [f.key, f.value || ''])));
  }

  /**
   * Enlaces del pie para la web pública.
   *
   * Sin sesión: el pie sale en la portada, que ve gente sin cuenta. Devuelve
   * SÓLO los activados y sólo los campos que se pintan; un enlace desactivado
   * no debe llegar al cliente ni oculto, porque «oculto» en el navegador es
   * abrir las herramientas de desarrollo y leerlo.
   */
  async getSiteLinks() {
    try {
      const links = await this.prisma.siteLink.findMany({
        where: { isEnabled: true },
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        select: {
          id: true,
          kind: true,
          provider: true,
          label: true,
          url: true,
          description: true,
          iconUrl: true,
        },
      });

      // La variante clara del icono se resuelve aqui, no en el navegador: si el
      // pie tuviera que deducirla del nombre del fichero, cambiar un icono de
      // sitio romperia la deduccion sin que nadie se entere.
      const conIconos = links.map((l) => ({
        ...l,
        iconDarkUrl: l.provider ? (buscarRed(l.provider)?.iconDark ?? null) : null,
      }));

      return {
        social: conIconos.filter((l) => l.kind === 'SOCIAL'),
        friends: conIconos.filter((l) => l.kind === 'FRIEND'),
      };
    } catch {
      // Si la tabla aún no existe (instalación a medio actualizar), el pie se
      // queda como estaba en vez de tumbar la portada entera.
      return { social: [], friends: [] };
    }
  }

  async testSmtp(dto: TestSmtpDto) {
    const status = await this.getSetupStatus();
    if (status.isInstalled) {
      throw new ForbiddenException('La prueba de SMTP abierta está deshabilitada tras la instalación del sistema.');
    }
    this.verifyBootstrapToken(dto.bootstrapToken);
    if (![25, 465, 587, 2525].includes(dto.smtpPort)) {
      throw new BadRequestException('El puerto SMTP no está permitido.');
    }
    const validatedAddresses = await validateNetworkHost(dto.smtpHost, { allowPrivate: false, allowPublic: true });

    try {
      const transporter = nodemailer.createTransport({
        host: validatedAddresses[0],
        port: dto.smtpPort,
        secure: dto.smtpPort === 465,
        auth: dto.smtpUser && dto.smtpPassword ? {
          user: dto.smtpUser,
          pass: dto.smtpPassword,
        } : undefined,
        tls: {
          rejectUnauthorized: true,
          ...(isIP(dto.smtpHost) ? {} : { servername: dto.smtpHost }),
        },
      });

      await transporter.verify();

      await transporter.sendMail({
        from: dto.smtpFrom,
        to: dto.testRecipient,
        subject: 'SyncSekai — Verificación de Servidor de Correo SMTP',
        html: plantillaCorreo({
          titulo: 'Tu servidor de correo funciona',
          parrafos: [
            'Si estás leyendo esto, SyncSekai puede mandar correo por tu servidor SMTP.',
            `Servidor: <strong>${escapar(dto.smtpHost)}:${dto.smtpPort}</strong>`,
          ],
          nota: 'Correo de prueba del asistente de instalación. Con esto funcionan la activación de cuenta, el restablecimiento de contraseña y los códigos de verificación.',
        }),
      });

      return {
        success: true,
        message: `Correo de prueba enviado exitosamente a ${dto.testRecipient}.`,
      };
    } catch (err: any) {
      this.logger.error(`Error verificando SMTP: ${err.message}`);
      throw new BadRequestException('No se pudo validar la configuración SMTP.');
    }
  }

  async initialize(dto: InitializeSetupDto) {
    const status = await this.getSetupStatus();
    if (status.isInstalled) {
      throw new ForbiddenException('El sistema ya se encuentra inicializado y sellado contra reinstalaciones.');
    }
    this.verifyBootstrapToken(dto.bootstrapToken);
    await this.prisma.systemSetting.deleteMany({
      where: {
        key: 'SETUP_LOCK',
        updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    try {
      await this.prisma.systemSetting.create({
        data: { key: 'SETUP_LOCK', value: crypto.randomUUID(), isSecret: true },
      });
    } catch {
      throw new ForbiddenException('La inicialización ya está en curso o fue completada.');
    }

    this.logger.log(`Iniciando configuración maestra del sistema para el dominio: ${dto.appDomain}...`);

    // 1. Guardar configuraciones del sistema
    const settingsToSave: { key: string; value: string; isSecret: boolean }[] = [
      { key: 'APP_DOMAIN', value: dto.appDomain.replace(/\/$/, ''), isSecret: false },
      { key: 'WEBHOOK_PUBLIC_URL', value: dto.webhookPublicUrl || `${dto.appDomain.replace(/\/$/, '')}/api/plex/webhook`, isSecret: false },
      { key: 'SMTP_HOST', value: dto.smtpHost || '', isSecret: false },
      { key: 'SMTP_PORT', value: String(dto.smtpPort || 587), isSecret: false },
      { key: 'SMTP_USER', value: dto.smtpUser || '', isSecret: false },
      { key: 'SMTP_PASS', value: dto.smtpPassword ? this.encryptionService.encrypt(dto.smtpPassword) : '', isSecret: true },
      { key: 'SMTP_FROM', value: dto.smtpFrom || '', isSecret: false },
      { key: 'ANILIST_CLIENT_ID', value: dto.anilistClientId || '', isSecret: false },
      { key: 'ANILIST_CLIENT_SECRET', value: dto.anilistClientSecret ? this.encryptionService.encrypt(dto.anilistClientSecret) : '', isSecret: true },
      { key: 'MAL_CLIENT_ID', value: dto.malClientId || '', isSecret: false },
      { key: 'MAL_CLIENT_SECRET', value: dto.malClientSecret ? this.encryptionService.encrypt(dto.malClientSecret) : '', isSecret: true },
      { key: 'GOOGLE_CLIENT_ID', value: dto.googleClientId || '', isSecret: false },
      { key: 'GOOGLE_CLIENT_SECRET', value: dto.googleClientSecret ? this.encryptionService.encrypt(dto.googleClientSecret) : '', isSecret: true },
      { key: 'DISCORD_CLIENT_ID', value: dto.discordClientId || '', isSecret: false },
      { key: 'DISCORD_CLIENT_SECRET', value: dto.discordClientSecret ? this.encryptionService.encrypt(dto.discordClientSecret) : '', isSecret: true },
      { key: 'PLEX_CLIENT_ID', value: dto.plexClientId || 'plexsync-app', isSecret: false },
    ];

    for (const setting of settingsToSave) {
      await this.prisma.systemSetting.upsert({
        where: { key: setting.key },
        create: setting,
        update: setting,
      });
    }

    // 2. Crear o Actualizar SuperAdmin
    const passwordHash = await bcrypt.hash(dto.adminPassword, 12);
    const userToken = `usr_live_${crypto.randomBytes(6).toString('hex')}`;
    const webhookToken = `whk_live_${crypto.randomBytes(12).toString('hex')}`;

    const existingAdmin = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: dto.adminEmail.toLowerCase() },
          { username: dto.adminUsername },
        ],
      },
    });

    let adminUser;
    if (existingAdmin) {
      adminUser = await this.prisma.user.update({
        where: { id: existingAdmin.id },
        data: {
          username: dto.adminUsername,
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          isActive: true,
        },
      });
    } else {
      adminUser = await this.prisma.user.create({
        data: {
          username: dto.adminUsername,
          email: dto.adminEmail.toLowerCase(),
          passwordHash,
          role: 'ADMIN',
          isActive: true,
          userToken,
          webhookToken,
        },
      });
    }

    // 3. Crear UserSettings del Administrador
    await this.prisma.userSettings.upsert({
      where: { userId: adminUser.id },
      create: {
        userId: adminUser.id,
        completionPercentage: 85,
        syncRatings: true,
        emailErrorAlerts: true,
        autoApproveMappings: true,
        preferredTracker: 'BOTH',
      },
      update: {
        syncRatings: true,
        emailErrorAlerts: true,
      },
    });

    // 4. Sembrar políticas de dominios por defecto si no existen
    const defaultDomains = ['gmail.com', 'outlook.com', 'hotmail.com', 'icloud.com', 'proton.me', 'yahoo.com'];
    for (const dom of defaultDomains) {
      await this.prisma.domainPolicy.upsert({
        where: { domain: dom },
        create: { domain: dom, isAllowed: true, reason: 'Proveedor oficial seguro' },
        update: {},
      });
    }

    await this.prisma.systemSetting.upsert({
      where: { key: 'SYSTEM_INITIALIZED' },
      create: { key: 'SYSTEM_INITIALIZED', value: 'true', isSecret: false },
      update: { value: 'true', isSecret: false },
    });
    await this.prisma.systemSetting.deleteMany({ where: { key: 'SETUP_LOCK' } });

    this.logger.log(`✨ Sistema SyncSekai inicializado exitosamente para el SuperAdmin: ${adminUser.username} <${adminUser.email}>`);

    return {
      success: true,
      message: '¡Instalación completada exitosamente! Ya puedes iniciar sesión con tu cuenta de Administrador.',
      admin: {
        id: adminUser.id,
        username: adminUser.username,
        email: adminUser.email,
        role: adminUser.role,
      },
    };
  }
}
