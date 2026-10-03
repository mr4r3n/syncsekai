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
import { AuthService } from './auth.service';
import { SessionsService } from './sessions.service';
import { AvatarsService } from './avatars.service';
import { RegistrationService } from './registration.service';
import { TwoFactorService } from './two-factor.service';
import { AccountLifecycleService } from './account-lifecycle.service';
import { AccountService } from './account.service';
import {
  RegisterDto,
  LoginDto,
  ForgotPasswordDto,
  ResetPasswordDto,
  VerifyBackupCodesDto,
  RecoverWithBackupCodeDto,
  UpdateSettingsDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { setSessionCookie, clearSessionCookie, deviceIdFrom } from './auth-cookies';
import { requestIp } from '../../common/security/client-ip';

@Controller('api/auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private sessionsService: SessionsService,
    private avatarsService: AvatarsService,
    private registrationService: RegistrationService,
    private twoFactorService: TwoFactorService,
    private accountLifecycleService: AccountLifecycleService,
    private accountService: AccountService,
  ) {}

  @Throttle({ default: { limit: 15, ttl: 60000 } })
  @Get('check-domain')
  async checkDomain(@Query('email') email: string) {
    return this.registrationService.checkDomain(email);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.registrationService.register(dto);
  }

  @Get('activate/:token')
  async activateAccount(@Param('token') token: string) {
    return this.registrationService.activateAccount(token);
  }

  @Get('confirm-email/:token')
  async confirmEmailChange(@Param('token') token: string) {
    return this.accountService.confirmEmailChange(token);
  }

  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    const clientIp = requestIp(req);
    const userAgent = req.headers['user-agent'] || '';
    const result = await this.authService.login(dto, clientIp, userAgent, deviceIdFrom(req, res));
    if (result.accessToken) {
      setSessionCookie(res, result.accessToken);
      const { accessToken, ...safeResult } = result;
      return safeResult;
    }
    return result;
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('forgot-password')
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.accountService.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.accountService.resetPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('recover-with-backup-code')
  async recoverWithBackupCode(@Body() dto: RecoverWithBackupCodeDto) {
    return this.twoFactorService.recoverWithBackupCode(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Post('backup-codes/generate')
  async generateBackupCodes(@CurrentUser() user: any) {
    return this.twoFactorService.generateBackupCodes(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('backup-codes/verify-and-save')
  async verifyAndSaveBackupCodes(
    @CurrentUser() user: any,
    @Body() dto: VerifyBackupCodesDto,
  ) {
    return this.twoFactorService.verifyAndSaveBackupCodes(user.id, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('backup-codes/status')
  async getBackupCodesStatus(@CurrentUser() user: any) {
    return this.twoFactorService.getBackupCodesStatus(user.id);
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
    return this.accountService.regenerateWebhookToken(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('profile')
  async updateProfile(
    @CurrentUser() user: any,
    @Body() body: { username?: string; email?: string; currentPassword?: string },
  ) {
    return this.accountService.updateProfile(user.id, body);
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
      throw new BadRequestException('Attach a valid image file.');
    }
    return this.avatarsService.uploadAvatar(user.id, uploadedFile.buffer);
  }

  @UseGuards(JwtAuthGuard)
  @Get('preset-avatars')
  async listPresetAvatars() {
    return { avatars: await this.avatarsService.listDefaultAvatars() };
  }

  @UseGuards(JwtAuthGuard)
  @Post('avatar/preset')
  async setPresetAvatar(@CurrentUser() user: any, @Body() body: { avatar?: string }) {
    return this.avatarsService.setAvatarPreset(user.id, body?.avatar);
  }

  @SkipThrottle()
  @Get('avatar/preset/:filename')
  async servePresetAvatar(@Param('filename') filename: string, @Res() res: any) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'avatars-preset', safeFilename);
    if (!fs.existsSync(filePath)) {
      return res.status(404).send('Avatar not found');
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
      return res.status(404).send('Avatar not found');
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
    const result = await this.accountService.updatePassword(user.id, body, user.currentSessionToken);
    clearSessionCookie(res);
    return result;
  }

  @UseGuards(JwtAuthGuard)
  @Post('settings')
  async updateSettings(
    @CurrentUser() user: any,
    @Body() body: UpdateSettingsDto,
  ) {
    return this.accountService.updateSettings(user.id, body);
  }

  // 2FA Endpoints
  @UseGuards(JwtAuthGuard)
  @Post('2fa/generate-totp')
  async generateTotp(
    @CurrentUser() user: any,
    @Body() body?: { currentPasswordOrCode?: string },
  ) {
    return this.twoFactorService.generateTotp(user.id, body?.currentPasswordOrCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable-totp')
  async enableTotp(
    @CurrentUser() user: any,
    @Body() body: { token: string; currentPasswordOrCode?: string },
  ) {
    return this.twoFactorService.enableTotp(user.id, body.token, body.currentPasswordOrCode);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/request-email-otp')
  async requestEmailOtp(@CurrentUser() user: any) {
    return this.twoFactorService.requestEmailOtp(user.id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/enable-email')
  async enableEmailOtp(
    @CurrentUser() user: any,
    @Body() body: { code: string },
  ) {
    return this.twoFactorService.enableEmailOtp(user.id, body.code);
  }

  @UseGuards(JwtAuthGuard)
  @Post('2fa/disable')
  async disable2Fa(
    @CurrentUser() user: any,
    @Body() body: { password?: string; verificationCode?: string },
  ) {
    return this.twoFactorService.disable2Fa(user.id, body.password, body.verificationCode);
  }

  // Account deletion in three steps: requested with password and 2FA, confirmed
  // through the emailed link, and 24 hours of grace to cancel it.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @UseGuards(JwtAuthGuard)
  @Post('account/request-deletion')
  async requestAccountDeletion(
    @CurrentUser() user: any,
    @Body() body: { password?: unknown; twoFactorCode?: unknown },
  ) {
    return this.accountLifecycleService.requestAccountDeletion(user.id, {
      password: typeof body?.password === 'string' ? body.password : undefined,
      twoFactorCode: typeof body?.twoFactorCode === 'string' ? body.twoFactorCode : undefined,
    });
  }

  // No session: the link arrives by email and may be opened on another device.
  // The token is single-use and expires in one hour.
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('account/confirm-deletion')
  async confirmAccountDeletion(@Body() body: { token?: unknown }) {
    return this.accountLifecycleService.confirmAccountDeletion(
      typeof body?.token === 'string' ? body.token : '',
    );
  }

  @UseGuards(JwtAuthGuard)
  @Post('account/cancel-deletion')
  async cancelAccountDeletion(@CurrentUser() user: any) {
    return this.accountLifecycleService.cancelAccountDeletion(user.id);
  }

  // Active sessions and devices
  @UseGuards(JwtAuthGuard)
  @Get('sessions')
  async getSessions(@CurrentUser() user: any, @Req() req: any) {
    const clientIp = requestIp(req);
    const userAgent = req.headers['user-agent'] || '';
    return this.sessionsService.getSessions(user.id, user.currentSessionToken, clientIp, userAgent);
  }

  @UseGuards(JwtAuthGuard)
  @Delete('sessions/:id')
  async revokeSession(@CurrentUser() user: any, @Param('id') id: string) {
    return this.sessionsService.revokeSession(user.id, id);
  }

  @UseGuards(JwtAuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: any,
    @Res({ passthrough: true }) res: Response,
  ) {
    if (user.currentSessionToken) {
      await this.sessionsService.revokeSessionByToken(user.id, user.currentSessionToken);
    }
    clearSessionCookie(res);
    return { message: 'Signed out.' };
  }

  @UseGuards(JwtAuthGuard)
  @Post('sessions/revoke-others')
  async revokeOtherSessions(@CurrentUser() user: any) {
    return this.sessionsService.revokeOtherSessions(user.id, user.currentSessionToken);
  }
}
