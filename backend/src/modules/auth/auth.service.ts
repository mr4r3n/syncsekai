import {
  Injectable,
  Logger,
  BadRequestException,
  UnauthorizedException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, ForgotPasswordDto, ResetPasswordDto } from './dto/auth.dto';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import sharp from 'sharp';
import { generateSecret, generateURI, verifySync } from 'otplib';
import * as QRCode from 'qrcode';
import { Role } from '@prisma/client';
import * as nodemailer from 'nodemailer';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { plantillaCorreo, escapar } from '../../common/email/plantilla-correo';
import { reencodearImagenCuadrada } from '../../common/security/image-file';
import {
  AVATARES_DE_SERIE,
  CARPETA_PRESETS_SUBIDOS,
  CLAVE_AVATARES_PREDETERMINADOS,
  pareceRutaDeAvatar,
} from '../../common/security/avatares-predeterminados';
import { getRequiredSecret } from '../../common/security/required-secret';

@Injectable()
export class AuthService implements OnModuleInit {
  private readonly logger = new Logger(AuthService.name);

  private readonly domainCache = new Map<string, { result: { isAllowed: boolean; message: string; status: 'allowed' | 'denied' | 'requires_approval' }; timestamp: number }>();
  private readonly DOMAIN_CACHE_TTL_MS = 10 * 60 * 1000;

  // Bloqueo por cuenta en memoria del proceso. El ThrottlerGuard limita
  // por IP, lo que no frena un ataque distribuido contra una sola cuenta ni la
  // fuerza bruta sobre un código 2FA de seis dígitos. El contador se pierde al
  // reiniciar y no se comparte entre réplicas; si el backend se escala o hace falta
  // que sobreviva a los despliegues, esto pasa a Redis (ya está en el stack) o a un
  // par de columnas en la tabla User.
  private static readonly MAX_FAILED_LOGINS = 8;
  private static readonly LOCKOUT_MS = 15 * 60 * 1000;
  private static readonly MAX_TRACKED_LOGINS = 5000;
  private readonly failedLogins = new Map<string, { count: number; lockedUntil: number }>();

  /** Los tokens de un solo uso se guardan hasheados; el valor en claro solo viaja por correo. */
  private hashToken(rawToken: string): string {
    return crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
  }

  private assertNotLockedOut(emailKey: string) {
    const entry = this.failedLogins.get(emailKey);
    if (entry && entry.lockedUntil > Date.now()) {
      const minutes = Math.max(1, Math.ceil((entry.lockedUntil - Date.now()) / 60000));
      throw new UnauthorizedException(
        `Demasiados intentos fallidos. Vuelve a intentarlo en ${minutes} minuto(s).`,
      );
    }
  }

  /**
   * Se registra siempre con el correo enviado, exista o no la cuenta: si solo se
   * contaran los intentos contra cuentas reales, el bloqueo revelaría cuáles existen.
   */
  private registerFailedLogin(emailKey: string) {
    const now = Date.now();
    const previous = this.failedLogins.get(emailKey);
    const count = (previous?.count || 0) + 1;

    if (count >= AuthService.MAX_FAILED_LOGINS) {
      this.failedLogins.set(emailKey, { count: 0, lockedUntil: now + AuthService.LOCKOUT_MS });
      this.logger.warn(`Cuenta bloqueada temporalmente por intentos fallidos: ${emailKey}`);
    } else {
      this.failedLogins.set(emailKey, { count, lockedUntil: previous?.lockedUntil || 0 });
    }

    // Acotar la memoria: un atacante puede enviar correos distintos sin límite.
    if (this.failedLogins.size > AuthService.MAX_TRACKED_LOGINS) {
      for (const [key, value] of this.failedLogins) {
        if (value.lockedUntil <= now) this.failedLogins.delete(key);
        if (this.failedLogins.size <= AuthService.MAX_TRACKED_LOGINS) break;
      }
    }
  }

  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private encryptionService: EncryptionService,
    private configService: ConfigService,
  ) {}

  async onModuleInit() {
    const usersWithTotp = await this.prisma.user.findMany({
      where: { twoFactorSecret: { not: null } },
      select: { id: true, twoFactorSecret: true },
    });
    const legacySecrets = usersWithTotp.filter(
      (user) => !this.encryptionService.isEncrypted(user.twoFactorSecret),
    );
    if (legacySecrets.length === 0) return;

    await this.prisma.$transaction(
      legacySecrets.map((user) => this.prisma.user.update({
        where: { id: user.id },
        data: {
          twoFactorSecret: user.twoFactorSecret
            ? this.encryptionService.encrypt(user.twoFactorSecret)
            : null,
        },
      })),
    );
    this.logger.log(`Migrados ${legacySecrets.length} secreto(s) TOTP legado(s) a cifrado AES-GCM.`);
  }

  async checkDomain(email: string): Promise<{ isAllowed: boolean; message: string; status: 'allowed' | 'denied' | 'requires_approval' }> {
    if (!email || !email.includes('@')) {
      return { isAllowed: false, message: 'Formato de correo incompleto', status: 'denied' };
    }

    const domain = email.split('@')[1].toLowerCase().trim();

    // Comprobar caché en memoria
    const cached = this.domainCache.get(domain);
    if (cached && Date.now() - cached.timestamp < this.DOMAIN_CACHE_TTL_MS) {
      return cached.result;
    }

    let result: { isAllowed: boolean; message: string; status: 'allowed' | 'denied' | 'requires_approval' };
    
    // Consultar política de dominios
    const policy = await this.prisma.domainPolicy.findUnique({
      where: { domain },
    });

    if (policy) {
      if (policy.isAllowed) {
        result = { isAllowed: true, message: 'Dominio verificado para registro directo.', status: 'allowed' };
      } else {
        result = { isAllowed: false, message: 'Correos temporales o descartables no permitidos.', status: 'denied' };
      }
    } else {
      // Default: Check known disposable domains
      const commonDisposable = ['yopmail.com', 'mohmal.com', 'tempmail.com', 'guerrillamail.com', '10minutemail.com', 'trashmail.com'];
      if (commonDisposable.includes(domain)) {
        result = { isAllowed: false, message: 'Correos temporales no permitidos en el sistema.', status: 'denied' };
      } else {
        const commonAllowed = ['gmail.com', 'outlook.com', 'hotmail.com', 'proton.me', 'protonmail.com', 'icloud.com', 'yahoo.com'];
        if (commonAllowed.includes(domain)) {
          result = { isAllowed: true, message: 'Dominio verificado para registro directo.', status: 'allowed' };
        } else {
          result = { isAllowed: false, message: 'Este dominio requiere autorización manual del administrador.', status: 'requires_approval' };
        }
      }
    }

    this.domainCache.set(domain, { result, timestamp: Date.now() });
    return result;
  }

  async register(dto: RegisterDto) {
    const domainCheck = await this.checkDomain(dto.email);
    if (!domainCheck.isAllowed) {
      throw new BadRequestException(domainCheck.message);
    }

    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: dto.email.trim().toLowerCase(), mode: 'insensitive' } },
          { username: { equals: dto.username.trim(), mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      throw new BadRequestException('Algo salió mal.');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    const userToken = `usr_live_${crypto.randomBytes(6).toString('hex')}`;
    const webhookToken = `whk_live_${crypto.randomBytes(8).toString('hex')}`;
    // Se envía el token en claro por correo y se guarda solo su hash, igual que
    // ya se hacía con emailChangeToken: con acceso de lectura a la base de datos
    // no debe poderse activar ni borrar la cuenta de nadie.
    const activationToken = crypto.randomBytes(24).toString('hex');
    const activationTokenHash = this.hashToken(activationToken);
    const activationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const user = await this.prisma.user.create({
      data: {
        email: dto.email.trim().toLowerCase(),
        username: dto.username.trim(),
        passwordHash,
        userToken,
        webhookToken,
        isActive: false,
        activationToken: activationTokenHash,
        activationExpiresAt,
        role: Role.USER,
        settings: {
          create: {
            completionPercentage: 85,
            syncRatings: true,
            emailErrorAlerts: true,
            autoApproveMappings: true,
          },
        },
      },
      select: {
        id: true,
        userToken: true,
        email: true,
        username: true,
        role: true,
        isActive: true,
        activationExpiresAt: true,
      },
    });

    const frontendUrl = await this.getFrontendUrl();
    const activationLink = `${frontendUrl}/activate/${activationToken}`;
    const emailSent = await this.sendEmail(
      user.email,
      'SyncSekai — Activa tu cuenta',
      plantillaCorreo({
        frontendUrl,
        titulo: 'Activa tu cuenta',
        parrafos: [
          `Hola <strong>${escapar(user.username)}</strong>, ya casi está. Pulsa el botón para activar tu cuenta y empezar a sincronizar lo que ves.`,
        ],
        boton: { texto: 'Activar cuenta', url: activationLink },
        nota: 'El enlace caduca en 24 horas. Si no has creado ninguna cuenta en SyncSekai, ignora este mensaje: sin pulsarlo no se activa nada.',
      }),
    );

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(72));
      console.log('📧 [DEV EMAIL SIMULATOR] CORREO DE ACTIVACIÓN DE CUENTA');
      console.log(`Para: ${dto.email} (Usuario: ${dto.username})`);
      console.log(`Rol asignado: ${user.role}`);
      console.log(`👉 Link de Activación: ${activationLink}`);
      console.log('=' .repeat(72) + '\n');
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return {
      message: emailSent
        ? 'Cuenta creada. Hemos enviado un correo de activación válido por 24 horas.'
        : 'Cuenta creada, pero no se pudo entregar el correo de activación. Contacta al administrador.',
      userToken: user.userToken,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      ...(isDev ? {
        activationToken,
        activationLink,
      } : {}),
      activationExpiresAt: user.activationExpiresAt,
    };
  }

  async activateAccount(token: string) {
    const user = await this.prisma.user.findFirst({
      where: { activationToken: this.hashToken(token || '') },
    });

    if (!user) {
      throw new BadRequestException('Token de activación no válido o la cuenta ya fue activada.');
    }

    if (user.activationExpiresAt && user.activationExpiresAt < new Date()) {
      await this.prisma.user.delete({ where: { id: user.id } });
      throw new BadRequestException('El plazo de 24 horas ha expirado. Tu cuenta ha sido eliminada. Regístrate nuevamente.');
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        isActive: true,
        activationToken: null,
        activationExpiresAt: null,
      },
    });

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(72));
      console.log('✓ [DEV ACTIVATION] CUENTA ACTIVADA EXITOSAMENTE');
      console.log(`Usuario: ${user.username} (${user.email})`);
      console.log('='.repeat(72) + '\n');
    }

    return { message: 'Cuenta activada exitosamente. Ya puedes iniciar sesión.' };
  }

  /**
   * Cron Job diario: Purga automática de cuentas no activadas creadas hace más de 24 horas
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleExpiredAccountsPurge() {
    this.logger.log('Ejecutando tarea programada: Purga de cuentas inactivas expiradas (>24h)...');
    return this.purgeExpiredInactiveAccounts();
  }

  async purgeExpiredInactiveAccounts(): Promise<{ deletedCount: number }> {
    const now = new Date();
    const result = await this.prisma.user.deleteMany({
      where: {
        isActive: false,
        activationExpiresAt: {
          lt: now,
        },
      },
    });

    if (result.count > 0) {
      this.logger.log(`[AccountPurgeCron] Se eliminaron ${result.count} cuentas inactivas expiradas (>24h).`);
    }
    return { deletedCount: result.count };
  }

  detectDeviceInfo(userAgent?: string, ipAddress?: string): {
    deviceName: string;
    deviceType: string;
    browser: string;
    os: string;
    iconType: string;
  } {
    const ua = userAgent || '';
    let os = 'Windows';
    let browser = 'Google Chrome';
    let deviceType = 'DESKTOP';
    let iconType = 'CHROME';
    // El nombre se guarda en la sesión y se enseña en cualquier idioma, así que
    // no lleva la preposición: "Chrome · Windows" se lee igual en los dos.
    let deviceName = 'Chrome · Windows';

    // 1. Detectar Sistema Operativo
    if (/iPhone/i.test(ua)) {
      os = 'iOS';
      deviceType = 'MOBILE';
      iconType = 'IOS';
      deviceName = 'iPhone';
    } else if (/iPad/i.test(ua)) {
      os = 'iOS';
      deviceType = 'TABLET';
      iconType = 'IOS';
      deviceName = 'iPad';
    } else if (/Android/i.test(ua)) {
      os = 'Android';
      deviceType = 'MOBILE';
      iconType = 'ANDROID';
      deviceName = 'Android';
    } else if (/Macintosh|Mac OS/i.test(ua)) {
      os = 'macOS';
      deviceType = 'DESKTOP';
      iconType = 'SAFARI';
      deviceName = 'MacBook / macOS';
    } else if (/Windows/i.test(ua)) {
      os = 'Windows';
      deviceType = 'DESKTOP';
      iconType = 'WINDOWS';
      deviceName = 'Windows PC';
    } else if (/Linux/i.test(ua)) {
      os = 'Linux';
      deviceType = 'SERVER';
      iconType = 'LINUX';
      deviceName = 'Linux Server / NAS';
    } else if (/AFT|FireTV/i.test(ua)) {
      os = 'Fire OS';
      deviceType = 'TV';
      iconType = 'FIRETV';
      deviceName = 'Amazon Fire TV';
    }

    // 2. Detectar Cliente / Navegador
    if (/Plexamp/i.test(ua)) {
      browser = 'Plexamp';
      iconType = 'PLEX';
      deviceName = `Plexamp · ${os}`;
    } else if (/PlexDash/i.test(ua)) {
      browser = 'Plex Dash';
      iconType = 'PLEX';
      deviceName = `Plex Dash · ${os}`;
    } else if (/PlexMediaServer/i.test(ua)) {
      browser = 'Plex Media Server';
      iconType = 'PLEX';
      deviceType = 'SERVER';
      deviceName = 'Plex Media Server';
    } else if (/Edg\//i.test(ua)) {
      browser = 'Microsoft Edge';
      iconType = 'EDGE';
      deviceName = `Edge · ${os}`;
    } else if (/Chrome\//i.test(ua) || /CriOS\//i.test(ua)) {
      browser = 'Google Chrome';
      iconType = 'CHROME';
      deviceName = `Chrome · ${os}`;
    } else if (/Firefox\//i.test(ua) || /FxiOS\//i.test(ua)) {
      browser = 'Mozilla Firefox';
      iconType = 'FIREFOX';
      deviceName = `Firefox · ${os}`;
    } else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) {
      browser = 'Apple Safari';
      iconType = 'SAFARI';
      deviceName = `Safari · ${os}`;
    }

    return {
      deviceName,
      deviceType,
      browser,
      os,
      iconType,
    };
  }

  async login(dto: LoginDto, clientIp = '127.0.0.1', userAgent = '') {
    const emailKey = dto.email.trim().toLowerCase();
    this.assertNotLockedOut(emailKey);

    const user = await this.prisma.user.findUnique({
      where: { email: emailKey },
      include: {
        settings: true,
        plexConnection: true,
        animeConnections: true,
      },
    });

    if (!user) {
      this.registerFailedLogin(emailKey);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!user.passwordHash) {
      throw new UnauthorizedException('Esta cuenta está vinculada a un proveedor OAuth externo. Inicia sesión mediante el botón correspondiente.');
    }

    const isValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isValid) {
      this.registerFailedLogin(emailKey);
      throw new UnauthorizedException('Credenciales inválidas.');
    }

    if (!user.isActive) {
      throw new ForbiddenException('Tu cuenta no ha sido activada aún. Revisa el link enviado a tu correo.');
    }

    // MANEJO DE AUTENTICACIÓN EN DOS PASOS (2FA)
    if (user.twoFactorEnabled && user.twoFactorType !== 'NONE') {
      if (!dto.twoFactorCode) {
        // Si es por correo, generamos e imprimimos el código OTP
        if (user.twoFactorType === 'EMAIL_OTP') {
          const code = crypto.randomInt(100000, 1000000).toString();
          const codeHash = await bcrypt.hash(code, 10);
          const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
          await this.prisma.user.update({
            where: { id: user.id },
            data: { emailOtpCode: codeHash, emailOtpExpiresAt: expiresAt },
          });

          const sent = await this.sendEmail(
            user.email,
            'SyncSekai — Código de acceso',
            plantillaCorreo({
              frontendUrl: await this.getFrontendUrl(),
              titulo: 'Tu código de acceso',
              parrafos: ['Alguien está iniciando sesión en tu cuenta. Escribe este código para continuar:'],
              codigo: code,
              nota: 'Caduca en 10 minutos y sirve una sola vez. Si no has sido tú, alguien conoce tu contraseña: cámbiala.',
            }),
          );
          if (!sent && process.env.NODE_ENV === 'production') {
            throw new ServiceUnavailableException('No se pudo entregar el código 2FA.');
          }

          if (process.env.NODE_ENV !== 'production') {
            console.log('\n' + '='.repeat(72));
            console.log('🔐 [DEV EMAIL SIMULATOR] CÓDIGO 2FA LOGIN POR CORREO');
            console.log(`Para: ${user.email} (Usuario: ${user.username})`);
            console.log(`👉 CÓDIGO DE 6 DÍGITOS: >>> ${code} <<<`);
            console.log(`Vence a las: ${expiresAt.toLocaleTimeString()}`);
            console.log('='.repeat(72) + '\n');
          }
        }

        return {
          requires2FA: true,
          twoFactorType: user.twoFactorType,
          email: user.email,
          message: user.twoFactorType === 'EMAIL_OTP'
            ? 'Ingresa el código enviado a tu correo electrónico'
            : 'Ingresa el código generado por tu app de autenticación',
        };
      }

      // Verificación del código 2FA recibido
      if (user.twoFactorType === 'APP_TOTP') {
        const totpSecret = this.encryptionService.decrypt(user.twoFactorSecret || '');
        const verifyRes = verifySync({ token: dto.twoFactorCode.trim(), secret: totpSecret });
        if (!verifyRes || !verifyRes.valid) {
          // Un código de seis dígitos se agota por fuerza bruta sin un límite por cuenta.
          this.registerFailedLogin(emailKey);
          throw new UnauthorizedException('Código de autenticación 2FA incorrecto o expirado.');
        }
      } else if (user.twoFactorType === 'EMAIL_OTP') {
        const otpMatches = user.emailOtpCode
          ? await bcrypt.compare(dto.twoFactorCode.trim(), user.emailOtpCode)
          : false;
        if (!otpMatches) {
          this.registerFailedLogin(emailKey);
          throw new UnauthorizedException('Código de verificación por correo incorrecto.');
        }
        if (user.emailOtpExpiresAt && user.emailOtpExpiresAt < new Date()) {
          throw new UnauthorizedException('El código de verificación ha expirado.');
        }
        // Consumir el código
        await this.prisma.user.update({
          where: { id: user.id },
          data: { emailOtpCode: null, emailOtpExpiresAt: null },
        });
      }
    }

    // Autenticación completa (contraseña y, si procede, 2FA): se descarta el historial.
    this.failedLogins.delete(emailKey);

    const sessionToken = `ses_live_${crypto.randomBytes(16).toString('hex')}`;
    const deviceInfo = this.detectDeviceInfo(userAgent, clientIp);

    // Limpiar sesiones previas del mismo cliente/navegador e IP para evitar duplicación
    try {
      await this.prisma.session.deleteMany({
        where: {
          userId: user.id,
          ipAddress: clientIp,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
        },
      });
    } catch {}

    await this.prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        ipAddress: clientIp,
        userAgent: userAgent || 'Navegador Web',
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        iconType: deviceInfo.iconType,
        lastActiveAt: new Date(),
      },
    });

    const payload = {
      sub: user.id,
      userToken: user.userToken,
      sessionToken,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        userToken: user.userToken,
        email: user.email,
        username: user.username,
        role: user.role,
        webhookToken: user.webhookToken,
        twoFactorEnabled: user.twoFactorEnabled,
        twoFactorType: user.twoFactorType,
        settings: user.settings,
        hasPlex: !!user.plexConnection?.isConnected,
        connectedAnimeCount: user.animeConnections.filter(c => c.isConnected).length,
      },
    };
  }

  async updateProfile(
    userId: string,
    data: { username?: string; email?: string; currentPassword?: string },
    currentSessionToken?: string,
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Algo salió mal.');

    let newUsername: string | undefined = undefined;
    let emailChangeRequested = false;
    let updateLastUsernameChange = false;

    if (data.username && data.username.trim() !== user.username) {
      const trimmedName = data.username.trim();

      // Comprobar si han pasado 30 días desde el último cambio de nombre
      if (user.lastUsernameChange) {
        const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
        const elapsed = Date.now() - new Date(user.lastUsernameChange).getTime();
        if (elapsed < thirtyDaysMs) {
          throw new BadRequestException('Algo salió mal.');
        }
      }

      // Comprobar si ya existe otro usuario con este nombre (case-insensitive)
      const existingName = await this.prisma.user.findFirst({
        where: {
          username: { equals: trimmedName, mode: 'insensitive' },
          NOT: { id: userId },
        },
      });
      if (existingName) {
        throw new BadRequestException('Algo salió mal.');
      }

      newUsername = trimmedName;
      updateLastUsernameChange = true;
    }

    if (data.email && data.email.trim().toLowerCase() !== user.email.toLowerCase()) {
      const trimmedEmail = data.email.trim().toLowerCase();

      if (!user.passwordHash || !data.currentPassword) {
        throw new UnauthorizedException('Debes confirmar tu contraseña actual para cambiar el correo.');
      }
      const passwordMatches = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!passwordMatches) {
        throw new UnauthorizedException('La contraseña actual es incorrecta.');
      }

      const domainCheck = await this.checkDomain(trimmedEmail);
      if (!domainCheck.isAllowed) {
        throw new BadRequestException(domainCheck.message);
      }

      // Comprobar si ya existe otro usuario con este correo (case-insensitive)
      const existingEmail = await this.prisma.user.findFirst({
        where: {
          email: { equals: trimmedEmail, mode: 'insensitive' },
          NOT: { id: userId },
        },
      });
      if (existingEmail) {
        throw new BadRequestException('Algo salió mal.');
      }

      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const frontendUrl = await this.getFrontendUrl();
      const confirmationUrl = `${frontendUrl}/confirm-email/${rawToken}`;
      const emailSent = await this.sendEmail(
        trimmedEmail,
        'SyncSekai — Confirma tu nuevo correo',
        plantillaCorreo({
          frontendUrl,
          titulo: 'Confirma tu nuevo correo',
          parrafos: [
            `Has pedido usar esta dirección para tu cuenta de SyncSekai. Hasta que la confirmes, la cuenta sigue con la anterior.`,
          ],
          boton: { texto: 'Confirmar correo', url: confirmationUrl },
          nota: 'El enlace caduca en una hora. Si no has pedido este cambio, ignóralo y revisa quién tiene acceso a tu cuenta.',
        }),
      );
      if (!emailSent) {
        throw new ServiceUnavailableException('No se pudo enviar la confirmación al nuevo correo.');
      }

      await this.prisma.user.update({
        where: { id: userId },
        data: {
          pendingEmail: trimmedEmail,
          emailChangeToken: tokenHash,
          emailChangeExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
        },
      });
      emailChangeRequested = true;
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(newUsername ? { username: newUsername } : {}),
        ...(updateLastUsernameChange ? { lastUsernameChange: new Date() } : {}),
      },
    });

    let newAccessToken: string | undefined = undefined;
    if (newUsername && currentSessionToken) {
      newAccessToken = this.jwtService.sign({
        sub: updated.id,
        userToken: updated.userToken,
        sessionToken: currentSessionToken,
        username: updated.username,
        email: updated.email,
        role: updated.role,
      });
    }

    return {
      message: emailChangeRequested
        ? 'Perfil actualizado. Revisa el nuevo correo para confirmar el cambio.'
        : 'Perfil actualizado correctamente.',
      accessToken: newAccessToken,
      user: {
        id: updated.id,
        username: updated.username,
        email: updated.email,
        userToken: updated.userToken,
        lastUsernameChange: updated.lastUsernameChange,
      },
    };
  }

  async confirmEmailChange(rawToken: string) {
    const tokenHash = crypto.createHash('sha256').update(rawToken.trim()).digest('hex');
    const user = await this.prisma.user.findUnique({ where: { emailChangeToken: tokenHash } });
    if (
      !user?.pendingEmail ||
      !user.emailChangeExpiresAt ||
      user.emailChangeExpiresAt < new Date()
    ) {
      throw new BadRequestException('El enlace de confirmación es inválido o ha expirado.');
    }

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          email: user.pendingEmail,
          pendingEmail: null,
          emailChangeToken: null,
          emailChangeExpiresAt: null,
          userToken: `usr_live_${crypto.randomBytes(12).toString('hex')}`,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId: user.id } }),
    ]);

    return { message: 'Correo confirmado. Inicia sesión nuevamente.' };
  }

  async regenerateWebhookToken(userId: string) {
    const newWebhookToken = `whk_live_${crypto.randomBytes(8).toString('hex')}`;
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { webhookToken: newWebhookToken },
      select: { id: true, userToken: true, webhookToken: true },
    });

    return {
      message: 'Token de Webhook regenerado exitosamente.',
      webhookToken: updated.webhookToken,
    };
  }

  /**
   * 1. Solicitar eliminación de cuenta:
   * Valida Contraseña + 2FA (si está activo), genera token de 1h y envía correo con enlace seguro.
   */
  async requestAccountDeletion(
    userId: string,
    dto: { password?: string; twoFactorCode?: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    // Comprobar salvaguarda de administrador
    if (user.role === 'ADMIN') {
      const adminCount = await this.prisma.user.count({ where: { role: 'ADMIN' } });
      if (adminCount <= 1) {
        throw new BadRequestException(
          'No puedes eliminar la única cuenta de administrador del sistema. Transfiere el rol de administrador a otro usuario antes de continuar.'
        );
      }
    }

    // 1. Validar Contraseña (si la cuenta tiene contraseña establecida)
    if (user.passwordHash) {
      if (!dto.password) {
        throw new BadRequestException('Debes ingresar tu contraseña actual para autorizar la solicitud.');
      }
      const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);
      if (!isValidPassword) {
        throw new UnauthorizedException('La contraseña ingresada es incorrecta.');
      }
    }

    // 2. Validar 2FA (si está habilitado en la cuenta)
    if (user.twoFactorEnabled) {
      if (!dto.twoFactorCode || !dto.twoFactorCode.trim()) {
        throw new BadRequestException('Debes ingresar tu código de autenticación en dos pasos (2FA).');
      }

      if (user.twoFactorType === 'APP_TOTP') {
        const totpSecret = this.encryptionService.decrypt(user.twoFactorSecret || '');
        const verifyRes = verifySync({ token: dto.twoFactorCode.trim(), secret: totpSecret });
        if (!verifyRes || !verifyRes.valid) {
          throw new UnauthorizedException('El código 2FA ingresado es incorrecto o ha expirado.');
        }
      } else if (user.twoFactorType === 'EMAIL_OTP') {
        const otpMatches = user.emailOtpCode
          ? await bcrypt.compare(dto.twoFactorCode.trim(), user.emailOtpCode)
          : false;
        if (!otpMatches) {
          throw new UnauthorizedException('El código de verificación por correo es incorrecto.');
        }
        if (user.emailOtpExpiresAt && user.emailOtpExpiresAt < new Date()) {
          throw new UnauthorizedException('El código de verificación por correo ha expirado.');
        }
      }
    }

    // Generar token criptográfico único con validez de 1 hora
    const rawToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletionToken: this.hashToken(rawToken),
        deletionTokenExpiresAt: expiresAt,
      },
    });

    // Enviar correo de confirmación
    const frontendUrl = await this.getFrontendUrl();
    const confirmationUrl = `${frontendUrl}/confirm-delete/${rawToken}`;

    const emailSubject = 'SyncSekai — Confirma que quieres eliminar tu cuenta';
    const emailHtml = plantillaCorreo({
      frontendUrl,
      titulo: 'Confirma que quieres eliminar tu cuenta',
      parrafos: [
        `Hola <strong>${escapar(user.username)}</strong>, hemos recibido una solicitud para eliminar tu cuenta de SyncSekai.`,
        'Al confirmar empieza un plazo de <strong>24 horas</strong> durante el que puedes echarte atrás entrando en tu cuenta. Pasado ese plazo se borran tus conexiones, tu historial y tus mapeos, y eso ya no se puede deshacer.',
      ],
      boton: { texto: 'Confirmar eliminación', url: confirmationUrl, peligro: true },
      nota: 'El enlace caduca en una hora. Si no has pedido esto, ignóralo y cambia tu contraseña: alguien ha entrado en tu cuenta.',
    });

    await this.sendEmail(user.email, emailSubject, emailHtml);

    return {
      success: true,
      message: 'Se ha enviado un correo electrónico de confirmación a tu bandeja de entrada. Dispones de 1 hora para autorizar la solicitud.',
    };
  }

  /**
   * 2. Confirmar eliminación mediante enlace del correo:
   * Valida el token y programa la eliminación a 24 horas exactas (periodo de gracia).
   */
  async confirmAccountDeletion(rawToken: string) {
    if (!rawToken || !rawToken.trim()) {
      throw new BadRequestException('Token de confirmación no proporcionado.');
    }

    const user = await this.prisma.user.findFirst({
      where: { deletionToken: this.hashToken(rawToken) },
    });

    if (!user || !user.deletionTokenExpiresAt || user.deletionTokenExpiresAt < new Date()) {
      throw new BadRequestException(
        'El enlace de confirmación es inválido o ha expirado. Si aún deseas eliminar tu cuenta, solicita una nueva desde el panel de seguridad.'
      );
    }

    const scheduledAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 horas exactas

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletionToken: null,
        deletionTokenExpiresAt: null,
        deletionScheduledAt: scheduledAt,
      },
    });

    // Enviar correo informativo con la fecha exacta límite
    const formattedDate = scheduledAt.toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const frontendUrl = await this.getFrontendUrl();
    const loginUrl = `${frontendUrl}/login`;

    const emailSubject = 'SyncSekai — Tu cuenta se borrará en 24 horas';
    const emailHtml = plantillaCorreo({
      frontendUrl,
      titulo: 'Tu cuenta se borrará en 24 horas',
      parrafos: [
        `Hola <strong>${escapar(user.username)}</strong>, has confirmado la eliminación. Tu cuenta se borrará el <strong>${escapar(formattedDate)}</strong> (hora peninsular).`,
        'Todavía puedes echarte atrás: entra antes de esa fecha y pulsa <strong>Cancelar eliminación</strong>.',
      ],
      boton: { texto: 'Entrar y cancelar', url: loginUrl },
      nota: 'Si no haces nada, a esa hora se borran tus conexiones, tu historial y tus mapeos, y no hay forma de recuperarlos.',
    });

    await this.sendEmail(user.email, emailSubject, emailHtml);
    this.logger.log(`[DELETION SCHEDULED] Usuario ${user.username} programado para purga en 24h (${scheduledAt.toISOString()})`);

    return {
      success: true,
      message: 'Tu cuenta ha sido programada para eliminación. Tienes 24 horas para recuperarla antes de la purga definitiva.',
      scheduledAt,
    };
  }

  /**
   * 3. Cancelar eliminación programada (Recuperar cuenta):
   */
  async cancelAccountDeletion(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('Usuario no encontrado.');
    }

    if (!user.deletionScheduledAt && !user.deletionToken) {
      return {
        success: true,
        message: 'No hay ninguna solicitud de eliminación activa en esta cuenta.',
      };
    }

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        deletionScheduledAt: null,
        deletionToken: null,
        deletionTokenExpiresAt: null,
      },
    });

    this.logger.log(`[DELETION CANCELLED] Usuario ${user.username} canceló la eliminación de su cuenta.`);

    return {
      success: true,
      message: '¡La eliminación de tu cuenta ha sido cancelada exitosamente! Tu cuenta permanece activa con todos tus datos intactos.',
    };
  }

  /**
   * 4. Tarea programada (Cron Job): Purga automática de cuentas cuyo periodo de gracia expiró
   */
  @Cron(CronExpression.EVERY_HOUR)
  async handleScheduledAccountDeletions() {
    const now = new Date();
    const accountsToPurge = await this.prisma.user.findMany({
      where: {
        deletionScheduledAt: {
          lte: now,
        },
      },
      select: { id: true, username: true, email: true },
    });

    if (accountsToPurge.length === 0) return;

    this.logger.log(`[PURGE CRON] Purgando ${accountsToPurge.length} cuenta(s) con periodo de gracia de 24h vencido...`);

    for (const acc of accountsToPurge) {
      try {
        await this.prisma.user.delete({ where: { id: acc.id } });
        this.logger.warn(`[PURGED] Cuenta de ${acc.username} (${acc.id}) eliminada definitivamente en cascada.`);
      } catch (err: any) {
        this.logger.error(`[PURGE ERROR] Error eliminando cuenta ${acc.id}: ${err.message}`);
      }
    }
  }

  async updatePassword(
    userId: string,
    data: { currentPassword?: string; newPassword?: string; twoFactorCode?: string },
    currentSessionToken: string,
  ) {
    if (!data.newPassword || data.newPassword.length < 12) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 12 caracteres.');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.passwordHash) {
      if (!data.currentPassword) {
        throw new BadRequestException('Debes ingresar tu contraseña actual.');
      }
      const isValid = await bcrypt.compare(data.currentPassword, user.passwordHash);
      if (!isValid) {
        throw new BadRequestException('La contraseña actual es incorrecta.');
      }
    } else if (user.twoFactorEnabled && user.twoFactorType === 'APP_TOTP') {
      const secret = this.encryptionService.decrypt(user.twoFactorSecret || '');
      const result = verifySync({ token: data.twoFactorCode?.trim() || '', secret });
      if (!result?.valid) {
        throw new UnauthorizedException('Debes confirmar un código 2FA válido.');
      }
    } else {
      const recentSession = await this.prisma.session.findFirst({
        where: {
          userId,
          sessionToken: currentSessionToken,
          createdAt: { gte: new Date(Date.now() - 10 * 60 * 1000) },
        },
      });
      if (!recentSession) {
        throw new UnauthorizedException('Vuelve a iniciar sesión para establecer una contraseña.');
      }
    }

    const newHash = await bcrypt.hash(data.newPassword, 12);
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          passwordHash: newHash,
          userToken: `usr_live_${crypto.randomBytes(12).toString('hex')}`,
        },
      }),
      this.prisma.session.deleteMany({ where: { userId } }),
    ]);

    return { message: 'Contraseña actualizada. Inicia sesión nuevamente.' };
  }

  async updateSettings(userId: string, data: any) {
    const settings = await this.prisma.userSettings.upsert({
      where: { userId },
      create: {
        userId,
        completionPercentage: data.completionPercentage ?? 85,
        syncRatings: data.syncRatings ?? true,
        emailErrorAlerts: data.emailErrorAlerts ?? true,
        discordNotifications: data.discordNotifications ?? true,
        webNotifications: data.webNotifications ?? true,
        autoApproveMappings: data.autoApproveMappings ?? true,
        preferredTracker: data.preferredTracker ?? 'BOTH',
        themePalette: data.themePalette ?? 'sync',
        themeMode: data.themeMode ?? 'dark',
      },
      update: {
        ...(data.completionPercentage !== undefined ? { completionPercentage: Number(data.completionPercentage) } : {}),
        ...(data.syncRatings !== undefined ? { syncRatings: Boolean(data.syncRatings) } : {}),
        ...(data.emailErrorAlerts !== undefined ? { emailErrorAlerts: Boolean(data.emailErrorAlerts) } : {}),
        ...(data.discordNotifications !== undefined ? { discordNotifications: Boolean(data.discordNotifications) } : {}),
        ...(data.webNotifications !== undefined ? { webNotifications: Boolean(data.webNotifications) } : {}),
        ...(data.autoApproveMappings !== undefined ? { autoApproveMappings: Boolean(data.autoApproveMappings) } : {}),
        ...(data.preferredTracker !== undefined ? { preferredTracker: data.preferredTracker } : {}),
        ...(data.themePalette !== undefined ? { themePalette: String(data.themePalette) } : {}),
        ...(data.themeMode !== undefined ? { themeMode: String(data.themeMode) } : {}),
      },
    });

    return {
      message: 'Configuración guardada exitosamente.',
      settings,
    };
  }

  async validateUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        settings: true,
        plexConnection: true,
        animeConnections: true,
      },
    });
  }

  // Subida y conversión de Avatar a WebP
  async uploadAvatar(userId: string, fileBuffer: Buffer): Promise<{ avatarUrl: string; message: string }> {
    const uploadDir = path.join(process.cwd(), 'uploads', 'avatars');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    await this.borrarAvatarSubido(userId);

    const filename = `avatar_${userId}_${Date.now()}.webp`;
    await reencodearImagenCuadrada(fileBuffer, path.join(uploadDir, filename));

    const avatarUrl = `/api/auth/avatar/${filename}`;
    await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl },
    });

    return {
      avatarUrl,
      message: 'Imagen de perfil procesada y convertida a WebP exitosamente.',
    };
  }

  /**
   * Borra el fichero del avatar que el usuario tuviera subido, si lo había.
   *
   * Se llama tanto al subir uno nuevo como al pasarse a un predeterminado: en
   * ambos casos el anterior deja de estar referenciado y sólo ocuparía disco.
   * No toca los avatares que vienen de Google o Discord, que no son ficheros
   * nuestros, ni los predeterminados, que son compartidos.
   */
  private async borrarAvatarSubido(userId: string): Promise<void> {
    try {
      const existente = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { avatarUrl: true },
      });
      const url = existente?.avatarUrl;
      // El /preset/ de por medio distingue el avatar propio del predeterminado
      // compartido: borrar este ultimo se lo quitaria a todos los que lo usan.
      if (!url || !url.includes('/api/auth/avatar/') || url.includes('/avatar/preset/')) return;

      const antiguo = path.join(process.cwd(), 'uploads', 'avatars', path.basename(url));
      if (fs.existsSync(antiguo)) fs.unlinkSync(antiguo);
    } catch (err: any) {
      this.logger.warn(`No se pudo eliminar el avatar anterior de ${userId}: ${err.message}`);
    }
  }

  /**
   * Lista viva de avatares predeterminados.
   *
   * Mientras nadie haya tocado la lista desde el panel devuelve los de serie,
   * asi que la funcionalidad no aparece vacia en una instalacion nueva.
   */
  async listarAvataresPredeterminados(): Promise<string[]> {
    const fila = await this.prisma.systemSetting.findUnique({
      where: { key: CLAVE_AVATARES_PREDETERMINADOS },
    });
    if (!fila?.value) return [...AVATARES_DE_SERIE];

    try {
      const lista = JSON.parse(fila.value);
      if (!Array.isArray(lista)) throw new Error('no es un array');
      // Se filtra tambien al leer: si alguien manipulara la fila a mano, una
      // ruta con mala forma no llegaria a renderizarse en un <img>.
      return lista.filter(pareceRutaDeAvatar);
    } catch (err: any) {
      this.logger.warn(`PRESET_AVATARS ilegible, se usan los de serie: ${err.message}`);
      return [...AVATARES_DE_SERIE];
    }
  }

  /** Asigna al usuario uno de los avatares predeterminados. */
  async setAvatarPreset(userId: string, ruta: unknown): Promise<{ avatarUrl: string; message: string }> {
    if (!pareceRutaDeAvatar(ruta)) {
      throw new BadRequestException('Avatar predeterminado no reconocido.');
    }

    // La forma correcta no basta: tiene que estar en la lista que se ofrece.
    const disponibles = await this.listarAvataresPredeterminados();
    if (!disponibles.includes(ruta)) {
      throw new BadRequestException('Ese avatar predeterminado ya no esta disponible.');
    }

    await this.borrarAvatarSubido(userId);
    await this.prisma.user.update({ where: { id: userId }, data: { avatarUrl: ruta } });

    return { avatarUrl: ruta, message: 'Avatar actualizado.' };
  }

  /**
   * Anade un avatar predeterminado a partir de una imagen subida por un admin.
   * Devuelve la lista ya actualizada.
   */
  async anadirAvatarPredeterminado(fileBuffer: Buffer): Promise<string[]> {
    const carpeta = path.join(process.cwd(), 'uploads', CARPETA_PRESETS_SUBIDOS);
    if (!fs.existsSync(carpeta)) fs.mkdirSync(carpeta, { recursive: true });

    const fichero = `preset_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.webp`;
    await reencodearImagenCuadrada(fileBuffer, path.join(carpeta, fichero));

    const lista = await this.listarAvataresPredeterminados();
    lista.push(`/api/auth/avatar/preset/${fichero}`);
    await this.guardarListaDeAvatares(lista);
    return lista;
  }

  /**
   * Quita un avatar de la lista. Los que se subieron se borran del disco; los
   * de serie sólo salen de la lista, porque el fichero es parte del frontend.
   *
   * Quien lo tuviera puesto se queda con la ruta antigua en su perfil. Es
   * deliberado: cambiarle el avatar a un usuario sin avisarle es peor que
   * dejar uno que ya no se ofrece, y con los de serie el fichero sigue ahí.
   */
  async quitarAvatarPredeterminado(ruta: unknown): Promise<string[]> {
    if (!pareceRutaDeAvatar(ruta)) {
      throw new BadRequestException('Avatar predeterminado no reconocido.');
    }

    const lista = (await this.listarAvataresPredeterminados()).filter((x) => x !== ruta);
    await this.guardarListaDeAvatares(lista);

    const fichero = ruta.startsWith('/api/') ? path.basename(ruta) : null;
    if (fichero) {
      const enDisco = path.join(process.cwd(), 'uploads', CARPETA_PRESETS_SUBIDOS, fichero);
      try {
        if (fs.existsSync(enDisco)) fs.unlinkSync(enDisco);
      } catch (err: any) {
        this.logger.warn(`No se pudo borrar el preset ${fichero}: ${err.message}`);
      }
    }

    return lista;
  }

  private async guardarListaDeAvatares(lista: string[]): Promise<void> {
    const value = JSON.stringify(lista);
    await this.prisma.systemSetting.upsert({
      where: { key: CLAVE_AVATARES_PREDETERMINADOS },
      update: { value },
      create: { key: CLAVE_AVATARES_PREDETERMINADOS, value },
    });
  }

  // 2FA: Generar secreto TOTP y código QR
  async generateTotp(userId: string, currentPasswordOrCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // S07: Si el usuario ya tiene 2FA activo, exigir reautenticación antes de permitir reconfigurar
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!currentPasswordOrCode) {
        throw new BadRequestException('Se requiere verificar tu factor 2FA actual o contraseña para reconfigurar el autenticador.');
      }
      let verified = false;
      const existingSecret = this.encryptionService.decrypt(user.twoFactorSecret);
      const otpCheck = verifySync({ token: currentPasswordOrCode.trim(), secret: existingSecret.trim() });
      if (otpCheck && otpCheck.valid) {
        verified = true;
      } else if (user.passwordHash) {
        verified = await bcrypt.compare(currentPasswordOrCode, user.passwordHash);
      }
      if (!verified) {
        throw new BadRequestException('El código del factor actual o contraseña es incorrecto.');
      }
    }

    const secret = generateSecret({ length: 20 });
    await this.prisma.systemSetting.upsert({
      where: { key: `TOTP_SETUP_${userId}` },
      create: {
        key: `TOTP_SETUP_${userId}`,
        value: this.encryptionService.encrypt(JSON.stringify({
          secret,
          expiresAt: Date.now() + 10 * 60 * 1000,
        })),
        isSecret: true,
      },
      update: {
        value: this.encryptionService.encrypt(JSON.stringify({
          secret,
          expiresAt: Date.now() + 10 * 60 * 1000,
        })),
        isSecret: true,
      },
    });
    const otpauth = generateURI({ secret, label: user.email, issuer: 'SyncSekai' });
    const qrCodeDataUrl = await QRCode.toDataURL(otpauth, {
      width: 260,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return {
      secret,
      qrCodeDataUrl,
      otpauth,
    };
  }

  // 2FA: Habilitar TOTP
  async enableTotp(userId: string, token: string, currentPasswordOrCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // S07: Si el usuario ya tiene 2FA habilitado, exigir factor actual o contraseña
    if (user.twoFactorEnabled && user.twoFactorSecret) {
      if (!currentPasswordOrCode) {
        throw new BadRequestException('Se requiere verificar tu factor 2FA actual o contraseña para sustituir la configuración existente.');
      }
      let verified = false;
      const existingSecret = this.encryptionService.decrypt(user.twoFactorSecret);
      const otpCheck = verifySync({ token: currentPasswordOrCode.trim(), secret: existingSecret.trim() });
      if (otpCheck && otpCheck.valid) {
        verified = true;
      } else if (user.passwordHash) {
        verified = await bcrypt.compare(currentPasswordOrCode, user.passwordHash);
      }
      if (!verified) {
        throw new BadRequestException('El código de verificación del factor actual o contraseña no es correcto.');
      }
    }

    const pending = await this.prisma.systemSetting.findUnique({
      where: { key: `TOTP_SETUP_${userId}` },
    });
    if (!pending) {
      throw new BadRequestException('La configuración TOTP no existe o ha expirado.');
    }
    const parsed = JSON.parse(this.encryptionService.decrypt(pending.value));
    if (!parsed.secret || Number(parsed.expiresAt) < Date.now()) {
      await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });
      throw new BadRequestException('La configuración TOTP ha expirado.');
    }
    const secret = String(parsed.secret);
    const result = verifySync({ token: token.trim(), secret: secret.trim() });
    if (!result || !result.valid) {
      throw new BadRequestException('El código de 6 dígitos ingresado es incorrecto o ha expirado.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorType: 'APP_TOTP',
        twoFactorSecret: this.encryptionService.encrypt(secret),
      },
    });
    await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });

    return {
      message: 'Autenticación en 2 pasos (App Autenticador) activada con éxito.',
      twoFactorEnabled: true,
      twoFactorType: 'APP_TOTP',
    };
  }

  // 2FA: Solicitar código OTP por correo
  async requestEmailOtp(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const code = crypto.randomInt(100000, 1000000).toString();
    const codeHash = await bcrypt.hash(code, 10);
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        emailOtpCode: codeHash,
        emailOtpExpiresAt: expiresAt,
      },
    });

    const sent = await this.sendEmail(
      user.email,
      'SyncSekai — Código de verificación',
      plantillaCorreo({
        frontendUrl: await this.getFrontendUrl(),
        titulo: 'Tu código de verificación',
        parrafos: ['Escribe este código para confirmar la operación:'],
        codigo: code,
        nota: 'Caduca en 10 minutos y sirve una sola vez. Nadie de SyncSekai te lo va a pedir por ningún otro medio.',
      }),
    );
    if (!sent && process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException('No se pudo entregar el código 2FA.');
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log('\n' + '='.repeat(72));
      console.log('🔐 [DEV EMAIL SIMULATOR] CÓDIGO 2FA POR CORREO (ACTIVACIÓN / CONFIG)');
      console.log(`Para: ${user.email} (Usuario: ${user.username})`);
      console.log(`👉 CÓDIGO DE 6 DÍGITOS: >>> ${code} <<<`);
      console.log(`Vence a las: ${expiresAt.toLocaleTimeString()}`);
      console.log('='.repeat(72) + '\n');
    }

    const isDev = process.env.NODE_ENV !== 'production';

    return {
      message: `Código de verificación enviado a ${user.email}`,
      ...(isDev ? { previewCode: code } : {}),
    };
  }

  // 2FA: Habilitar 2FA por Correo
  async enableEmailOtp(userId: string, code: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    const otpMatches = user.emailOtpCode
      ? await bcrypt.compare(code.trim(), user.emailOtpCode)
      : false;
    if (!otpMatches) {
      throw new BadRequestException('El código de verificación es inválido.');
    }

    if (user.emailOtpExpiresAt && user.emailOtpExpiresAt < new Date()) {
      throw new BadRequestException('El código de verificación ha expirado. Solicita uno nuevo.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: true,
        twoFactorType: 'EMAIL_OTP',
        emailOtpCode: null,
        emailOtpExpiresAt: null,
      },
    });

    return {
      message: 'Autenticación en 2 pasos (Correo Electrónico) activada con éxito.',
      twoFactorEnabled: true,
      twoFactorType: 'EMAIL_OTP',
    };
  }

  // 2FA: Desactivar 2FA
  async disable2Fa(userId: string, password?: string, verificationCode?: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (user.passwordHash) {
      if (!password) {
        throw new UnauthorizedException('Debes confirmar tu contraseña actual.');
      }
      const isValid = await bcrypt.compare(password, user.passwordHash);
      if (!isValid) throw new UnauthorizedException('Contraseña incorrecta.');
    }
    if (user.twoFactorType === 'APP_TOTP') {
      const secret = this.encryptionService.decrypt(user.twoFactorSecret || '');
      const result = verifySync({ token: verificationCode?.trim() || '', secret });
      if (!result?.valid) {
        throw new UnauthorizedException('Debes confirmar un código 2FA válido.');
      }
    } else if (user.twoFactorType === 'EMAIL_OTP') {
      const codeMatches = user.emailOtpCode && verificationCode
        ? await bcrypt.compare(verificationCode.trim(), user.emailOtpCode)
        : false;
      if (!codeMatches || !user.emailOtpExpiresAt || user.emailOtpExpiresAt < new Date()) {
        throw new UnauthorizedException('Debes confirmar un código 2FA válido.');
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        twoFactorEnabled: false,
        twoFactorType: 'NONE',
        twoFactorSecret: null,
        emailOtpCode: null,
        emailOtpExpiresAt: null,
      },
    });

    return {
      message: 'Autenticación en dos pasos desactivada.',
      twoFactorEnabled: false,
      twoFactorType: 'NONE',
    };
  }

  async unlinkSocial(userId: string, provider: 'google' | 'discord') {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    if (provider === 'google') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { googleId: null },
      });
      return { message: 'Cuenta de Google desvinculada.' };
    }

    if (provider === 'discord') {
      await this.prisma.user.update({
        where: { id: userId },
        data: { discordId: null },
      });
      return { message: 'Cuenta de Discord desvinculada.' };
    }

    throw new BadRequestException('Proveedor social no soportado.');
  }

  // Métodos de Gestión de Sesiones Activas & Dispositivos
  async validateSessionToken(userId: string, sessionToken: string): Promise<boolean> {
    if (!userId || !sessionToken) return false;
    const session = await this.prisma.session.findFirst({
      where: { userId, sessionToken },
    });
    return !!session;
  }

  async touchSession(sessionToken: string) {
    try {
      await this.prisma.session.update({
        where: { sessionToken },
        data: { lastActiveAt: new Date() },
      });
    } catch {}
  }

  /**
   * Firma criptográfica segura para OAuth State contra CSRF / Account Hijacking
   */
  async createOAuthState(payload: {
    returnTo?: string;
    userId?: string;
    provider: 'google' | 'discord';
    intent: 'login' | 'link';
  }): Promise<{ state: string; txSecret: string }> {
    const secret = getRequiredSecret(this.configService, 'OAUTH_STATE_SECRET');
    const cleanReturnTo = (payload.returnTo && payload.returnTo.startsWith('/') && !payload.returnTo.startsWith('//') && !payload.returnTo.includes(':') && !payload.returnTo.includes('\\'))
      ? payload.returnTo
      : '/connections';
    const nonce = crypto.randomBytes(32).toString('hex');

    /*
     * Secreto de transaccion: lo que ata este state AL NAVEGADOR que lo pidio.
     *
     * Sin esto, el state solo probaba "lo emitimos nosotros, no ha caducado y no
     * se ha usado": nada decia en que navegador empezo. Cualquiera podia iniciar
     * sesion con SU identidad, quedarse con su propio callback antes de gastarlo
     * y hacer que otra persona lo abriera; ese navegador terminaba con la sesion
     * del primero, y los servicios que vinculara despues quedaban colgando de esa
     * cuenta ajena.
     *
     * El secreto viaja en una cookie del navegador y solo su hash va dentro del
     * state firmado, asi que quien intercepte el state no puede fabricar la
     * cookie.
     */
    const txSecret = crypto.randomBytes(32).toString('hex');
    const txHash = crypto.createHash('sha256').update(txSecret).digest('hex');

    const data = JSON.stringify({
      returnTo: cleanReturnTo,
      userId: payload.userId || '',
      provider: payload.provider,
      intent: payload.intent,
      ts: Date.now(),
      nonce,
      txHash,
    });
    const hmac = crypto.createHmac('sha256', secret).update(data).digest('hex');
    const stateKey = `OAUTH_STATE_${crypto.createHash('sha256').update(nonce).digest('hex')}`;
    const stateValue = crypto.createHash('sha256').update(data).digest('hex');
    await this.prisma.systemSetting.create({
      data: { key: stateKey, value: stateValue, isSecret: true },
    });
    await this.prisma.systemSetting.deleteMany({
      where: {
        key: { startsWith: 'OAUTH_STATE_' },
        updatedAt: { lt: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    return {
      state: Buffer.from(JSON.stringify({ data, sig: hmac })).toString('base64url'),
      txSecret,
    };
  }

  /**
   * Verificación de firma y expiración de OAuth State
   */
  async consumeOAuthState(
    state: string,
    expectedProvider: 'google' | 'discord',
    txSecret: string,
  ): Promise<{ returnTo: string; userId?: string; intent: 'login' | 'link' }> {
    const secret = getRequiredSecret(this.configService, 'OAUTH_STATE_SECRET');
    try {
      const decoded = JSON.parse(Buffer.from(state, 'base64url').toString('utf-8'));
      if (typeof decoded.data !== 'string' || !/^[a-f0-9]{64}$/.test(decoded.sig)) {
        throw new Error('Malformed OAuth state');
      }
      const expectedSig = crypto.createHmac('sha256', secret).update(decoded.data).digest('hex');
      if (!crypto.timingSafeEqual(Buffer.from(expectedSig, 'hex'), Buffer.from(decoded.sig, 'hex'))) {
        throw new Error('Invalid OAuth state signature');
      }
      const parsed = JSON.parse(decoded.data);
      if (
        typeof parsed.ts !== 'number' ||
        parsed.ts > Date.now() + 30_000 ||
        Date.now() - parsed.ts > 15 * 60 * 1000 ||
        typeof parsed.nonce !== 'string' ||
        typeof parsed.txHash !== 'string' ||
        !/^[a-f0-9]{64}$/.test(parsed.txHash) ||
        parsed.provider !== expectedProvider ||
        !['login', 'link'].includes(parsed.intent) ||
        (parsed.intent === 'link' && (typeof parsed.userId !== 'string' || !parsed.userId.trim())) ||
        (parsed.intent === 'login' && parsed.userId)
      ) {
        throw new Error('Expired or inconsistent OAuth state');
      }
      /*
       * El navegador, antes de gastar el state y antes de canjear el codigo.
       *
       * Va aqui a proposito: si se comprobara despues, un callback presentado en
       * otro navegador ya habria quemado el state -y con el la posibilidad de
       * que su dueno lo usara- aunque luego se rechazara.
       */
      const txHashRecibido = crypto
        .createHash('sha256')
        .update(txSecret || '')
        .digest('hex');
      if (
        !txSecret ||
        !crypto.timingSafeEqual(
          Buffer.from(txHashRecibido, 'hex'),
          Buffer.from(parsed.txHash, 'hex'),
        )
      ) {
        throw new Error('OAuth state from a different browser');
      }

      const stateKey = `OAUTH_STATE_${crypto.createHash('sha256').update(parsed.nonce).digest('hex')}`;
      const stateValue = crypto.createHash('sha256').update(decoded.data).digest('hex');
      const consumed = await this.prisma.systemSetting.deleteMany({
        where: { key: stateKey, value: stateValue },
      });
      if (consumed.count !== 1) throw new Error('OAuth state already used');
      const cleanReturnTo = (parsed.returnTo && parsed.returnTo.startsWith('/') && !parsed.returnTo.startsWith('//') && !parsed.returnTo.includes(':') && !parsed.returnTo.includes('\\'))
        ? parsed.returnTo
        : '/connections';
      return {
        returnTo: cleanReturnTo,
        userId: parsed.userId ? String(parsed.userId) : undefined,
        intent: parsed.intent,
      };
    } catch {
      throw new UnauthorizedException('Estado OAuth inválido, expirado o reutilizado.');
    }
  }

  async getSessions(userId: string, currentSessionToken?: string, clientIp = '127.0.0.1', userAgent = '') {
    let sessions = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
    });

    // Si no hay sesiones guardadas todavía, registrar la sesión actual
    if (sessions.length === 0 && currentSessionToken) {
      const deviceInfo = this.detectDeviceInfo(userAgent, clientIp);
      const fallbackSession = await this.prisma.session.create({
        data: {
          userId,
          sessionToken: currentSessionToken,
          ipAddress: clientIp,
          userAgent: userAgent || 'Navegador Web',
          deviceName: deviceInfo.deviceName,
          deviceType: deviceInfo.deviceType,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
          iconType: deviceInfo.iconType,
          lastActiveAt: new Date(),
        },
      });
      sessions = [fallbackSession];
    }

    return sessions.map((s) => ({
      id: s.id,
      sessionToken: s.sessionToken,
      ipAddress: s.ipAddress || '127.0.0.1',
      userAgent: s.userAgent,
      deviceName: s.deviceName || 'Dispositivo Desconocido',
      deviceType: s.deviceType || 'DESKTOP',
      browser: s.browser || 'Navegador Web',
      os: s.os || 'Desconocido',
      iconType: s.iconType || 'DEFAULT',
      isCurrent: currentSessionToken ? s.sessionToken === currentSessionToken : false,
      lastActiveAt: s.lastActiveAt,
      createdAt: s.createdAt,
    }));
  }

  async revokeSession(userId: string, sessionId: string) {
    const session = await this.prisma.session.findFirst({
      where: { id: sessionId, userId },
    });
    if (!session) {
      throw new NotFoundException('La sesión no existe o ya fue cerrada.');
    }
    await this.prisma.session.delete({ where: { id: sessionId } });
    return { message: 'Sesión revocada exitosamente.' };
  }

  async revokeOtherSessions(userId: string, currentSessionToken?: string) {
    if (currentSessionToken) {
      await this.prisma.session.deleteMany({
        where: {
          userId,
          sessionToken: { not: currentSessionToken },
        },
      });
    } else {
      await this.prisma.session.deleteMany({
        where: { userId },
      });
    }
    return { message: 'Todas las demás sesiones remotas han sido finalizadas.' };
  }

  async revokeSessionByToken(userId: string, sessionToken: string) {
    try {
      await this.prisma.session.deleteMany({
        where: { userId, sessionToken },
      });
    } catch {}
    return { message: 'Sesión finalizada exitosamente.' };
  }

  /**
   * Inicio de Sesión y Auto-Registro mediante OAuth Social (Google, Discord, GitHub)
   */
  async handleSocialAuthLogin(
    data: {
      provider: 'google' | 'discord' | 'github';
      providerId: string;
      email: string;
      username: string;
      emailVerified: boolean;
      avatarUrl?: string | null;
      currentUserId?: string;
    },
    clientIp = '127.0.0.1',
    userAgent = '',
  ) {
    const email = data.email.trim().toLowerCase();
    if (!data.providerId || !data.emailVerified) {
      throw new UnauthorizedException('El proveedor no confirmó una identidad y correo verificables.');
    }

    let user: any = null;

    // 1. Si la petición proviene de un usuario autenticado (vinculación directa)
    if (data.currentUserId) {
      user = await this.prisma.user.findUnique({
        where: { id: data.currentUserId },
        include: { settings: true },
      });
    }

    // 2. Si no viene con currentUserId, buscar usuario por ID social o por email
    if (!user) {
      user = await this.prisma.user.findFirst({
        where: {
          OR: [
            data.provider === 'google' ? { googleId: data.providerId } : undefined,
            data.provider === 'discord' ? { discordId: data.providerId } : undefined,
            data.provider === 'github' ? { githubId: data.providerId } : undefined,
            { email },
          ].filter(Boolean) as any,
        },
        include: { settings: true },
      });
    }

    if (user) {
      // S06: Respetar desactivación y suspensión administrativa; nunca reactivar forzadamente
      if (!user.isActive) {
        throw new UnauthorizedException('Tu cuenta ha sido desactivada por un administrador.');
      }
      if (user.settings?.isSuspended) {
        throw new UnauthorizedException('Tu cuenta ha sido suspendida por el administrador.');
      }

      // Si el usuario ya existe, vinculamos su proveedor social sin tocar su username ni su avatar
      const updateData: any = {};
      if (data.provider === 'google' && user.googleId !== data.providerId) updateData.googleId = data.providerId;
      if (data.provider === 'discord' && user.discordId !== data.providerId) updateData.discordId = data.providerId;
      if (data.provider === 'github' && user.githubId !== data.providerId) updateData.githubId = data.providerId;

      if (Object.keys(updateData).length > 0) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: updateData,
          include: { settings: true },
        });
      }
    } else {
      // S05: Aplicar la política de admisión de dominios antes de crear la cuenta social
      const domainCheck = await this.checkDomain(email);
      if (!domainCheck.isAllowed) {
        throw new BadRequestException(domainCheck.message);
      }

      // Auto-registro solo para usuarios nuevos desde /login o /register
      // Sanitizar username
      let baseUsername = data.username ? data.username.replace(/[^a-zA-Z0-9_-]/g, '').trim() : email.split('@')[0];
      if (!baseUsername || baseUsername.length < 3) baseUsername = `user_${data.providerId.slice(-4)}`;

      let uniqueUsername = baseUsername;
      let counter = 1;
      while (await this.prisma.user.findFirst({ where: { username: uniqueUsername } })) {
        uniqueUsername = `${baseUsername}_${counter}`;
        counter++;
      }

      const userToken = `usr_live_${crypto.randomBytes(12).toString('hex')}`;
      const webhookToken = `whk_live_${crypto.randomBytes(16).toString('hex')}`;

      user = await this.prisma.user.create({
        data: {
          email,
          username: uniqueUsername,
          userToken,
          webhookToken,
          isActive: true,
          role: Role.USER,
          avatarUrl: null,
          googleId: data.provider === 'google' ? data.providerId : null,
          discordId: data.provider === 'discord' ? data.providerId : null,
          githubId: data.provider === 'github' ? data.providerId : null,
          settings: {
            create: {
              canScrobble: true,
              canAccessCatalog: true,
              canEditMappings: true,
              canSyncAnilist: true,
              canSyncMal: true,
            },
          },
        },
        include: { settings: true },
      });
    }

    // Registrar sesión activa
    const sessionToken = `ses_live_${crypto.randomBytes(24).toString('hex')}`;
    const deviceInfo = this.detectDeviceInfo(userAgent, clientIp);

    // Limpiar sesiones previas del mismo cliente/navegador e IP para evitar duplicación
    try {
      await this.prisma.session.deleteMany({
        where: {
          userId: user.id,
          ipAddress: clientIp,
          browser: deviceInfo.browser,
          os: deviceInfo.os,
        },
      });
    } catch {}

    await this.prisma.session.create({
      data: {
        userId: user.id,
        sessionToken,
        ipAddress: clientIp,
        userAgent: userAgent || 'OAuth Client',
        deviceName: deviceInfo.deviceName,
        deviceType: deviceInfo.deviceType,
        browser: deviceInfo.browser,
        os: deviceInfo.os,
        iconType: deviceInfo.iconType,
        lastActiveAt: new Date(),
      },
    });

    const payload = {
      sub: user.id,
      userToken: user.userToken,
      email: user.email,
      username: user.username,
      role: user.role,
      sessionToken,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  /**
   * Helper: Obtener la URL pública del Frontend
   */
  async getFrontendUrl(): Promise<string> {
    const domainSetting = await this.prisma.systemSetting.findUnique({
      where: { key: 'APP_DOMAIN' },
    });
    return (
      domainSetting?.value ||
      process.env.FRONTEND_URL ||
      'http://localhost:3000'
    ).replace(/\/$/, '');
  }

  /**
   * Envío de correo por el SMTP configurado en `SystemSetting`, con el entorno
   * como respaldo.
   *
   * No hay ningún otro proveedor detrás: sin `SMTP_HOST` esto devuelve `false` y
   * el correo no sale. Lo que se pierde así es la activación de cuenta, el
   * restablecimiento de contraseña y el cambio de correo, o sea, toda forma de
   * entrar sin un administrador delante.
   */
  async sendEmail(to: string, subject: string, html: string): Promise<boolean> {
    try {
      const settings = await this.prisma.systemSetting.findMany({
        where: {
          key: { in: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM'] },
        },
      });

      const map = new Map(settings.map((s) => [s.key, s.value]));
      const host = map.get('SMTP_HOST') || process.env.SMTP_HOST;
      const port = Number(map.get('SMTP_PORT') || process.env.SMTP_PORT || 587);
      const user = map.get('SMTP_USER') || process.env.SMTP_USER;
      let pass = map.get('SMTP_PASS') || process.env.SMTP_PASS;
      if (pass && this.encryptionService) {
        try {
          pass = this.encryptionService.decrypt(pass);
        } catch {}
      }
      const from = map.get('SMTP_FROM') || process.env.SMTP_FROM || 'SyncSekai <noreply@syncsekai.com>';

      if (!host) {
        this.logger.warn(`[SMTP] No configurado. Correo a ${to} simulado en consola.`);
        return false;
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: user && pass ? { user, pass } : undefined,
        tls: { rejectUnauthorized: false },
      });

      await transporter.sendMail({
        from,
        to,
        subject,
        html,
      });

      this.logger.log(`[SMTP] Correo enviado exitosamente a ${to} ("${subject}")`);
      return true;
    } catch (err: any) {
      this.logger.error(`[SMTP] Error enviando correo a ${to}: ${err.message}`);
      return false;
    }
  }

  /**
   * 1. Solicitar recuperación de contraseña (Forgot Password)
   * Anti-enumeración: Siempre responde con éxito para no exponer si el correo existe
   */
  async forgotPassword(dto: ForgotPasswordDto): Promise<{ message: string }> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const genericResponse = {
      message: 'Si el correo electrónico existe en nuestra plataforma, recibirás un enlace de recuperación en tu bandeja de entrada en breve.',
    };

    const user = await this.prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: 'insensitive' },
      },
    });

    if (!user || !user.isActive) {
      return genericResponse;
    }

    // Generar token criptográfico aleatorio de 32 bytes (64 caracteres hex)
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // Válido por 60 minutos

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordResetToken: resetToken,
        passwordResetExpiresAt: expiresAt,
      },
    });

    const frontendUrl = await this.getFrontendUrl();
    const resetLink = `${frontendUrl}/reset-password/${resetToken}`;

    const htmlContent = plantillaCorreo({
      frontendUrl,
      titulo: 'Restablece tu contraseña',
      parrafos: [
        `Hola <strong>${escapar(user.username)}</strong>, alguien ha pedido restablecer la contraseña de tu cuenta.`,
      ],
      boton: { texto: 'Elegir contraseña nueva', url: resetLink },
      nota: 'El enlace sirve una sola vez y caduca en 60 minutos. Si no has sido tú, no hagas nada: tu contraseña actual sigue siendo válida.',
    });

    await this.sendEmail(user.email, 'SyncSekai — Restablece tu contraseña', htmlContent);

    return genericResponse;
  }

  /**
   * 2. Ejecutar restablecimiento de contraseña con token (Reset Password)
   */
  async resetPassword(dto: ResetPasswordDto): Promise<{ message: string }> {
    const cleanToken = dto.token.trim();

    const user = await this.prisma.user.findFirst({
      where: {
        passwordResetToken: cleanToken,
      },
    });

    if (!user) {
      throw new BadRequestException('El enlace de recuperación es inválido o ya ha sido utilizado.');
    }

    if (user.passwordResetExpiresAt && user.passwordResetExpiresAt < new Date()) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetToken: null,
          passwordResetExpiresAt: null,
        },
      });
      throw new BadRequestException('El enlace de recuperación ha expirado. Por favor, solicita uno nuevo.');
    }

    if (dto.newPassword.length < 12) {
      throw new BadRequestException('La nueva contraseña debe contener al menos 12 caracteres.');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, 10);

    // Actualizar contraseña y limpiar token de recuperación
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // Revocar todas las sesiones previas por máxima seguridad
    try {
      await this.prisma.session.deleteMany({
        where: { userId: user.id },
      });
    } catch {}

    // Notificar por correo del cambio exitoso
    const confirmationHtml = plantillaCorreo({
      frontendUrl: await this.getFrontendUrl(),
      titulo: 'Tu contraseña ha cambiado',
      parrafos: [
        `Hola <strong>${escapar(user.username)}</strong>, la contraseña de tu cuenta de SyncSekai se acaba de cambiar.`,
        'Si has sido tú, no tienes que hacer nada más.',
      ],
      nota: 'Si no has sido tú, alguien tiene acceso a tu correo o a tu cuenta. Escribe al administrador cuanto antes.',
    });
    this.sendEmail(user.email, 'SyncSekai — Tu contraseña ha sido actualizada', confirmationHtml).catch(() => {});

    return {
      message: 'Tu contraseña ha sido restablecida con éxito. Ya puedes iniciar sesión.',
    };
  }

  /**
   * 3. Generar nuevo lote de 8 códigos de recuperación de emergencia
   */
  async generateBackupCodes(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // Generar 8 códigos alfanuméricos legibles en formato XXXX-XXXX
    const charset = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
    const codes: string[] = [];

    for (let i = 0; i < 8; i++) {
      let part1 = '';
      let part2 = '';
      for (let j = 0; j < 4; j++) {
        part1 += charset[crypto.randomInt(0, charset.length)];
        part2 += charset[crypto.randomInt(0, charset.length)];
      }
      codes.push(`${part1}-${part2}`);
    }

    // Elegir un índice de desafío al azar (0 a 7)
    const challengeIndex = crypto.randomInt(0, codes.length);

    // S07: Persistir desafío y lote en servidor para garantizar consumo único y validación autorizada
    await this.prisma.systemSetting.upsert({
      where: { key: `BACKUP_CODES_SETUP_${userId}` },
      create: {
        key: `BACKUP_CODES_SETUP_${userId}`,
        value: this.encryptionService.encrypt(
          JSON.stringify({
            codes,
            challengeIndex,
            expiresAt: Date.now() + 10 * 60 * 1000,
          }),
        ),
        isSecret: true,
      },
      update: {
        value: this.encryptionService.encrypt(
          JSON.stringify({
            codes,
            challengeIndex,
            expiresAt: Date.now() + 10 * 60 * 1000,
          }),
        ),
        isSecret: true,
      },
    });

    return {
      codes,
      challengeIndex,
      challengeNumber: challengeIndex + 1,
      totalCodes: codes.length,
    };
  }

  /**
   * 4. Verificar código de desafío y guardar códigos hasheados en la BD
   */
  async verifyAndSaveBackupCodes(
    userId: string,
    data: { codes: string[]; challengeIndex: number; confirmedCode: string },
  ) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Usuario no encontrado.');

    // S07: Validar contra el desafío almacenado en el servidor
    const pending = await this.prisma.systemSetting.findUnique({
      where: { key: `BACKUP_CODES_SETUP_${userId}` },
    });
    if (!pending) {
      throw new BadRequestException('No hay un lote de códigos de recuperación pendiente de verificación o ha expirado.');
    }

    let parsed: any;
    try {
      parsed = JSON.parse(this.encryptionService.decrypt(pending.value));
    } catch {
      await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });
      throw new BadRequestException('Fallo al desencriptar el lote de verificación.');
    }

    if (!parsed.codes || Number(parsed.expiresAt) < Date.now()) {
      await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });
      throw new BadRequestException('La solicitud de códigos de recuperación ha expirado.');
    }

    const expectedCode = String(parsed.codes[parsed.challengeIndex] || '').trim().toUpperCase().replace(/\s+/g, '');
    const providedCode = (data.confirmedCode || '').trim().toUpperCase().replace(/\s+/g, '');

    if (!providedCode || providedCode !== expectedCode) {
      throw new BadRequestException(
        `El código ingresado no coincide con el Código #${parsed.challengeIndex + 1}. Asegúrate de haber guardado todos tus códigos e intenta nuevamente.`,
      );
    }

    // Hashear cada código de emergencia desde la lista auténtica generada por el servidor
    const hashedCodes = await Promise.all(
      parsed.codes.map((c: string) => bcrypt.hash(c.trim().toUpperCase(), 10)),
    );

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        backupCodes: hashedCodes,
        backupCodesGeneratedAt: new Date(),
      },
    });

    await this.prisma.systemSetting.deleteMany({ where: { key: pending.key } });

    // Registrar en AuditLog
    await this.prisma.auditLog.create({
      data: {
        level: 'INFO',
        service: 'AUTH_SECURITY',
        message: `Usuario @${user.username} generó y activó 8 nuevos códigos de recuperación de emergencia.`,
      },
    });

    return {
      success: true,
      message: 'Códigos de recuperación de emergencia activados y guardados con éxito.',
      remainingCount: hashedCodes.length,
      generatedAt: new Date(),
    };
  }

  /**
   * 5. Obtener estado de los códigos de recuperación del usuario
   */
  async getBackupCodesStatus(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        backupCodes: true,
        backupCodesGeneratedAt: true,
      },
    });

    if (!user) throw new NotFoundException('Usuario no encontrado.');

    return {
      hasBackupCodes: (user.backupCodes || []).length > 0,
      remainingCount: (user.backupCodes || []).length,
      generatedAt: user.backupCodesGeneratedAt,
    };
  }

  /**
   * 6. Restablecer contraseña utilizando un Código de Recuperación de Emergencia (Sin Correo)
   */
  async recoverWithBackupCode(data: {
    identifier: string;
    backupCode: string;
    newPassword: string;
  }) {
    const cleanIdentifier = (data.identifier || '').trim().toLowerCase();
    const cleanCode = (data.backupCode || '').trim().toUpperCase().replace(/\s+/g, '');

    if (!cleanIdentifier || !cleanCode) {
      throw new BadRequestException('Debes proporcionar tu usuario o correo electrónico y el código de emergencia.');
    }

    if (!data.newPassword || data.newPassword.length < 12) {
      throw new BadRequestException('La nueva contraseña debe tener al menos 12 caracteres.');
    }

    // Buscar usuario por correo o nombre de usuario
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: cleanIdentifier, mode: 'insensitive' } },
          { username: { equals: cleanIdentifier, mode: 'insensitive' } },
        ],
      },
    });

    if (!user || !user.backupCodes || user.backupCodes.length === 0) {
      throw new BadRequestException('Credenciales o código de recuperación de emergencia no válidos.');
    }

    // Comprobar si el código coincide con alguno de los hashes almacenados
    let matchIndex = -1;
    for (let i = 0; i < user.backupCodes.length; i++) {
      const isMatch = await bcrypt.compare(cleanCode, user.backupCodes[i]);
      if (isMatch) {
        matchIndex = i;
        break;
      }
    }

    if (matchIndex === -1) {
      throw new BadRequestException('El código de recuperación de emergencia es incorrecto o ya fue utilizado anteriormente.');
    }

    // Quemar / Eliminar el código usado de la lista
    const updatedBackupCodes = [...user.backupCodes];
    updatedBackupCodes.splice(matchIndex, 1);

    const newPasswordHash = await bcrypt.hash(data.newPassword, 10);

    // Actualizar contraseña y guardar lista de códigos restantes
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        backupCodes: updatedBackupCodes,
        passwordResetToken: null,
        passwordResetExpiresAt: null,
      },
    });

    // Revocar todas las sesiones abiertas
    try {
      await this.prisma.session.deleteMany({
        where: { userId: user.id },
      });
    } catch {}

    // Registrar en AuditLog
    await this.prisma.auditLog.create({
      data: {
        level: 'WARN',
        service: 'EMERGENCY_RECOVERY',
        message: `Usuario @${user.username} recuperó su cuenta exitosamente usando un código de emergencia. Quedan ${updatedBackupCodes.length} códigos válidos.`,
      },
    });

    return {
      success: true,
      message: 'Tu contraseña ha sido restablecida exitosamente con tu código de emergencia. Ya puedes iniciar sesión con tu nueva contraseña.',
      remainingCodes: updatedBackupCodes.length,
    };
  }
}
