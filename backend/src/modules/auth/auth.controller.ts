import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Query,
  UseGuards,
  Param,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Res,
  Req,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { 
  RegisterDto, 
  LoginDto, 
  ForgotPasswordDto, 
  ResetPasswordDto,
  VerifyBackupCodesDto,
  RecoverWithBackupCodeDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  private async getConfigValue(key: string): Promise<string> {
    try {
      const setting = await this.prisma.systemSetting.findUnique({
        where: { key },
      });
      if (setting && setting.value) {
        if (setting.isSecret) {
          try {
            return this.encryptionService.decrypt(setting.value);
          } catch {
            return setting.value;
          }
        }
        return setting.value;
      }
    } catch {}
    return this.configService.get<string>(key) || process.env[key] || '';
  }

  private setSessionCookie(res: Response, accessToken: string) {
    res.cookie('plexsync_session', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });
  }

  /*
   * Cookie de la transaccion OAuth.
   *
   * Vive lo mismo que el state (15 minutos) y solo se manda a /api/auth, que es
   * el unico sitio que la mira. `sameSite: 'lax'` es lo que hace falta y lo mas
   * estricto posible: el callback del proveedor llega como navegacion GET de
   * primer nivel, y en ese caso Lax si envia la cookie; 'strict' no lo haria y
   * romperia el propio inicio de sesion.
   */
  private setOAuthTxCookie(res: Response, txSecret: string) {
    res.cookie('plexsync_oauth_tx', txSecret, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
      maxAge: 15 * 60 * 1000,
    });
  }

  private clearOAuthTxCookie(res: Response) {
    res.clearCookie('plexsync_oauth_tx', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/auth',
    });
  }

  /**
   * Lee una cookie de la cabecera cruda.
   *
   * El proyecto no monta cookie-parser: la estrategia JWT ya parte la cabecera a
   * mano (jwt.strategy.ts), asi que se hace igual en vez de anadir una
   * dependencia para leer un valor.
   */
  private leerCookie(req: any, nombre: string): string {
    const cabecera: string = req?.headers?.cookie || '';
    const trozo = cabecera
      .split(';')
      .map((p: string) => p.trim())
      .find((p: string) => p.startsWith(`${nombre}=`));
    return trozo ? decodeURIComponent(trozo.slice(nombre.length + 1)) : '';
  }

  private clearSessionCookie(res: Response) {
    res.clearCookie('plexsync_session', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Get('check-domain')
  async checkDomain(@Query('email') email: string) {
    return this.authService.checkDomain(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Get('activate/:token')
  async activateAccount(@Param('token') token: string) {
    return this.authService.activateAccount(token);
  }

  @Get('confirm-email/:token')
  async confirmEmailChange(@Param('token') token: string) {
    return this.authService.confirmEmailChange(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    const result = await this.authService.login(dto, clientIp, userAgent);
    if (result.accessToken) {
      this.setSessionCookie(res, result.accessToken);
      const { accessToken: _accessToken, ...safeResult } = result;
      return safeResult;
    }
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('recover-with-backup-code')
  async recoverWithBackupCode(@Body() dto: RecoverWithBackupCodeDto) {
    return this.authService.recoverWithBackupCode(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('backup-codes/generate')
  async generateBackupCodes(@CurrentUser() user: any) {
    return this.authService.generateBackupCodes(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('backup-codes/verify-and-save')
  async verifyAndSaveBackupCodes(
    @CurrentUser() user: any,
    @Body() dto: VerifyBackupCodesDto,
  ) {
    return this.authService.verifyAndSaveBackupCodes(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('backup-codes/status')
  async getBackupCodesStatus(@CurrentUser() user: any) {
    return this.authService.getBackupCodesStatus(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async getProfile(@CurrentUser() user: any) {
    const userPayload = {
      id: user.id,
      userToken: user.userToken,
      email: user.email,
      username: user.username,
      avatarUrl: user.avatarUrl,
      role: user.role,
      webhookToken: user.webhookToken,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorType: user.twoFactorType || 'NONE',
      hasPassword: Boolean(user.passwordHash),
      googleId: user.googleId,
      discordId: user.discordId,
      settings: user.settings,
      plexConnection: user.plexConnection ? {
        serverName: user.plexConnection.serverName,
        serverUrl: user.plexConnection.serverUrl,
        plexUsername: user.plexConnection.plexUsername,
        monitoredLibraries: user.plexConnection.monitoredLibraries,
        isConnected: user.plexConnection.isConnected,
        lastSyncAt: user.plexConnection.lastSyncAt,
      } : null,
      animeConnections: user.animeConnections ? user.animeConnections.map((c: any) => ({
        provider: c.provider,
        remoteUsername: c.remoteUsername,
        avatarUrl: c.avatarUrl,
        isConnected: c.isConnected,
        lastLatencyMs: c.lastLatencyMs,
        lastCheckedAt: c.lastCheckedAt,
      })) : [],
    };

    return {
      user: userPayload,
      ...userPayload,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('regenerate-webhook-token')
  async regenerateWebhookToken(@CurrentUser() user: any) {
    return this.authService.regenerateWebhookToken(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { username?: string; email?: string; currentPassword?: string },
  ) {
    return this.authService.updateProfile(user.id, body);
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar')
  @UseInterceptors(FileInterceptor('avatar', {
    limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  }))
  async uploadAvatar(
    @CurrentUser() user: any,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    const uploadedFile = file || req.file;
    if (!uploadedFile) {
      throw new BadRequestException('Debes adjuntar un archivo de imagen válido.');
    }
    return this.authService.uploadAvatar(user.id, uploadedFile.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get('preset-avatars')
  async listPresetAvatars() {
    return { avatars: await this.authService.listarAvataresPredeterminados() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar/preset')
  async setPresetAvatar(@CurrentUser() user: any, @Body() body: { avatar?: string }) {
    return this.authService.setAvatarPreset(user.id, body?.avatar);
  }

  @SkipThrottle()
  @Get('avatar/preset/:filename')
  async servePresetAvatar(@Param('filename') filename: string, @Res() res: any) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'avatars-preset', safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Avatar no encontrado');
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }

  @SkipThrottle()
  @Get('avatar/:filename')
  async serveAvatar(@Param('filename') filename: string, @Res() res: any) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'avatars', safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Avatar no encontrado');
    }
    res.setHeader('Content-Type', 'image/webp');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.sendFile(filePath);
  }

  @UseGuards(JwtAuthGuard)
  @Post('password')
  async updatePassword(
    @CurrentUser() user: any,
    @Body() body: { currentPassword?: string; newPassword?: string; twoFactorCode?: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.authService.updatePassword(user.id, body, user.currentSessionToken);
    this.clearSessionCookie(res);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('settings')
  async updateSettings(
    @CurrentUser() user: any,
    @Body() body: any,
  ) {
    return this.authService.updateSettings(user.id, body);
  }

  // 2FA Endpoints
  @UseGuards(JwtAuthGuard)
  @Post('2fa/generate-totp')
  async generateTotp(
    @CurrentUser() user: any,
    @Body() body?: { currentPasswordOrCode?: string },
  ) {
    return this.authService.generateTotp(user.id, body?.currentPasswordOrCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable-totp')
  async enableTotp(
    @CurrentUser() user: any,
    @Body() body: { token: string; currentPasswordOrCode?: string },
  ) {
    return this.authService.enableTotp(user.id, body.token, body.currentPasswordOrCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/request-email-otp')
  async requestEmailOtp(@CurrentUser() user: any) {
    return this.authService.requestEmailOtp(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable-email')
  async enableEmailOtp(
    @CurrentUser() user: any,
    @Body() body: { code: string },
  ) {
    return this.authService.enableEmailOtp(user.id, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disable2Fa(
    @CurrentUser() user: any,
    @Body() body: { password?: string; verificationCode?: string },
  ) {
    return this.authService.disable2Fa(user.id, body.password, body.verificationCode);
  }

  // Social Linking Endpoints
  @UseGuards(JwtAuthGuard)
  @Post('social/link-google/start')
  async startGoogleLink(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const clientId = await this.getConfigValue('GOOGLE_CLIENT_ID');
    const callbackUrl = (await this.getConfigValue('GOOGLE_CALLBACK_URL')) || `${frontendUrl}/api/auth/google/callback`;
    if (!clientId) throw new BadRequestException('Google OAuth no está configurado.');
    const { state, txSecret } = await this.authService.createOAuthState({
      returnTo: '/settings/security',
      userId: user.id,
      provider: 'google',
      intent: 'link',
    });
    this.setOAuthTxCookie(res, txSecret);
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid%20email%20profile&state=${encodeURIComponent(state)}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('social/unlink-google')
  async unlinkGoogle(@CurrentUser() user: any) {
    return this.authService.unlinkSocial(user.id, 'google');
  }

  @UseGuards(JwtAuthGuard)
  @Post('social/link-discord/start')
  async startDiscordLink(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const clientId = await this.getConfigValue('DISCORD_CLIENT_ID');
    const callbackUrl = (await this.getConfigValue('DISCORD_CALLBACK_URL')) || `${frontendUrl}/api/auth/discord/callback`;
    if (!clientId) throw new BadRequestException('Discord OAuth no está configurado.');
    const { state, txSecret } = await this.authService.createOAuthState({
      returnTo: '/settings/security',
      userId: user.id,
      provider: 'discord',
      intent: 'link',
    });
    this.setOAuthTxCookie(res, txSecret);
    return {
      url: `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=identify%20email&state=${encodeURIComponent(state)}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('social/unlink-discord')
  async unlinkDiscord(@CurrentUser() user: any) {
    return this.authService.unlinkSocial(user.id, 'discord');
  }

  // Endpoints de Gestión de Sesiones Activas & Dispositivos
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@CurrentUser() user: any, @Req() req: any) {
    const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || '';
    return this.authService.getSessions(user.id, user.currentSessionToken, clientIp, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.authService.revokeSession(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (user.currentSessionToken) {
      await this.authService.revokeSessionByToken(user.id, user.currentSessionToken);
    }
    this.clearSessionCookie(res);
    return { message: 'Sesión finalizada exitosamente.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  async revokeOtherSessions(@CurrentUser() user: any) {
    return this.authService.revokeOtherSessions(user.id, user.currentSessionToken);
  }

  // ==========================================
  // GOOGLE OAUTH 2.0
  // ==========================================
  @Get('google')
  async googleAuth(
    @Query('returnTo') returnTo: string,
    @Res() res: any,
  ) {
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const clientId = await this.getConfigValue('GOOGLE_CLIENT_ID');
    const callbackUrl = (await this.getConfigValue('GOOGLE_CALLBACK_URL')) || `${frontendUrl}/api/auth/google/callback`;

    if (!clientId) {
      return res.redirect(`${frontendUrl}/auth/callback?error=GOOGLE_NOT_CONFIGURED&return_to=/login`);
    }

    const { state: stateToken, txSecret } = await this.authService.createOAuthState({
      returnTo,
      provider: 'google',
      intent: 'login',
    });
    this.setOAuthTxCookie(res, txSecret);
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl,
    )}&response_type=code&scope=openid%20email%20profile&access_type=offline&prompt=consent&state=${encodeURIComponent(stateToken)}`;

    return res.redirect(authUrl);
  }

  @Get('google/callback')
  async googleCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const clientId = await this.getConfigValue('GOOGLE_CLIENT_ID');
    const clientSecret = await this.getConfigValue('GOOGLE_CLIENT_SECRET');
    const callbackUrl = (await this.getConfigValue('GOOGLE_CALLBACK_URL')) || `${frontendUrl}/api/auth/google/callback`;

    const txSecret = this.leerCookie(req, 'plexsync_oauth_tx');
    this.clearOAuthTxCookie(res);
    const verifiedState = await this.authService.consumeOAuthState(state || '', 'google', txSecret);
    const targetReturnTo = verifiedState.returnTo;
    const currentUserId = verifiedState.userId;

    if (error || !code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error || 'ACCESS_DENIED')}&return_to=${encodeURIComponent(targetReturnTo)}`);
    }

    try {
      // 1. Canjear código por token de acceso
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: clientId || '',
          client_secret: clientSecret || '',
          redirect_uri: callbackUrl,
          grant_type: 'authorization_code',
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new BadRequestException(`No se pudo obtener el token de acceso de Google: ${tokenData.error_description || tokenData.error || 'Fallo OAuth'}`);
      }

      // 2. Obtener datos de perfil
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await userRes.json();

      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      const { user, accessToken } = await this.authService.handleSocialAuthLogin(
        {
          provider: 'google',
          providerId: profile.id,
          email: profile.email,
          emailVerified: profile.verified_email === true,
          username: profile.name || profile.email.split('@')[0],
          avatarUrl: profile.picture || null,
          currentUserId,
        },
        clientIp,
        userAgent,
      );

      this.setSessionCookie(res, accessToken);
      return res.redirect(`${frontendUrl}/auth/callback?username=${encodeURIComponent(user.username)}&return_to=${encodeURIComponent(targetReturnTo)}`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(err.message || 'GOOGLE_AUTH_FAILED')}&return_to=${encodeURIComponent(targetReturnTo)}`);
    }
  }

  // ==========================================
  // DISCORD OAUTH 2.0
  // ==========================================
  @Get('discord')
  async discordAuth(
    @Query('returnTo') returnTo: string,
    @Res() res: any,
  ) {
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const clientId = await this.getConfigValue('DISCORD_CLIENT_ID');
    const callbackUrl = (await this.getConfigValue('DISCORD_CALLBACK_URL')) || `${frontendUrl}/api/auth/discord/callback`;

    if (!clientId) {
      return res.redirect(`${frontendUrl}/auth/callback?error=DISCORD_NOT_CONFIGURED&return_to=/login`);
    }

    const { state: stateToken, txSecret } = await this.authService.createOAuthState({
      returnTo,
      provider: 'discord',
      intent: 'login',
    });
    this.setOAuthTxCookie(res, txSecret);
    const authUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(
      callbackUrl,
    )}&response_type=code&scope=identify%20email&state=${encodeURIComponent(stateToken)}`;

    return res.redirect(authUrl);
  }

  @Get('discord/callback')
  async discordCallback(
    @Query('code') code: string,
    @Query('error') error: string,
    @Query('state') state: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const domain = (await this.getConfigValue('APP_DOMAIN')) || (await this.getConfigValue('FRONTEND_URL')) || 'http://localhost:3000';
    const frontendUrl = domain.replace(/\/$/, '');
    const clientId = await this.getConfigValue('DISCORD_CLIENT_ID');
    const clientSecret = await this.getConfigValue('DISCORD_CLIENT_SECRET');
    const callbackUrl = (await this.getConfigValue('DISCORD_CALLBACK_URL')) || `${frontendUrl}/api/auth/discord/callback`;

    const txSecret = this.leerCookie(req, 'plexsync_oauth_tx');
    this.clearOAuthTxCookie(res);
    const verifiedState = await this.authService.consumeOAuthState(state || '', 'discord', txSecret);
    const targetReturnTo = verifiedState.returnTo;
    const currentUserId = verifiedState.userId;

    if (error || !code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(error || 'ACCESS_DENIED')}&return_to=${encodeURIComponent(targetReturnTo)}`);
    }

    try {
      // 1. Canjear código
      const tokenRes = await fetch('https://discord.com/api/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId || '',
          client_secret: clientSecret || '',
          grant_type: 'authorization_code',
          code,
          redirect_uri: callbackUrl,
        }),
      });

      const tokenData = await tokenRes.json();
      if (!tokenData.access_token) {
        throw new BadRequestException(`No se pudo obtener el token de acceso de Discord: ${tokenData.error_description || tokenData.error || 'Fallo OAuth'}`);
      }

      // 2. Obtener usuario
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await userRes.json();

      const avatarUrl = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;

      const clientIp = req.ip || req.socket?.remoteAddress || '127.0.0.1';
      const userAgent = req.headers['user-agent'] || '';

      const { user, accessToken } = await this.authService.handleSocialAuthLogin(
        {
          provider: 'discord',
          providerId: profile.id,
          email: profile.email || `${profile.username.toLowerCase()}@discord.local`,
          emailVerified: profile.verified === true && Boolean(profile.email),
          username: profile.global_name || profile.username,
          avatarUrl,
          currentUserId,
        },
        clientIp,
        userAgent,
      );

      this.setSessionCookie(res, accessToken);
      return res.redirect(`${frontendUrl}/auth/callback?username=${encodeURIComponent(user.username)}&return_to=${encodeURIComponent(targetReturnTo)}`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${encodeURIComponent(err.message || 'DISCORD_AUTH_FAILED')}&return_to=${encodeURIComponent(targetReturnTo)}`);
    }
  }
}
