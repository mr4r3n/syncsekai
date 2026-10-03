import { Controller, Post, Get, Query, UseGuards, BadRequestException, Res, Req } from '@nestjs/common';
import type { Response } from 'express';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { OAuthStateService } from './oauth-state.service';
import { AccountService } from './account.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/crypto/encryption.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { setOAuthTxCookie, setSessionCookie, clearOAuthTxCookie, readCookie, deviceIdFrom } from './auth-cookies';
import { requestIp } from '../../common/security/client-ip';
import { readStoredSetting } from '../../common/crypto/stored-setting';

/**
 * The code sent to /auth/callback when a social sign-in fails. Only fixed codes travel
 * in the URL: the page shows its own translated text, never text taken from the URL,
 * which anyone can write in a link.
 *
 * ponytail: matched on the messages AuthService and RegistrationService throw; a new
 * message falls back to the generic code (safe, just less precise).
 */
export function oauthErrorCode(err: unknown): string {
  const message = err instanceof Error ? err.message : '';
  const codes: Array<[RegExp, string]> = [
    [/verifiable identity/i, 'IDENTITY_NOT_VERIFIED'],
    [/deactivated/i, 'ACCOUNT_DEACTIVATED'],
    [/suspended/i, 'ACCOUNT_SUSPENDED'],
    [/registration is closed/i, 'REGISTRATION_CLOSED'],
    [/emails are not allowed|requires manual approval/i, 'EMAIL_DOMAIN_NOT_ALLOWED'],
  ];
  return codes.find(([pattern]) => pattern.test(message))?.[1] || 'SOCIAL_AUTH_FAILED';
}

/** Sign-in and account linking with Google and Discord (OAuth). */
@Controller('api/auth')
export class SocialAuthController {
  constructor(
    private authService: AuthService,
    private oauthStateService: OAuthStateService,
    private accountService: AccountService,
    private configService: ConfigService,
    private prisma: PrismaService,
    private encryptionService: EncryptionService,
  ) {}

  private getConfigValue(key: string): Promise<string> {
    return readStoredSetting(this.prisma, this.encryptionService, key);
  }

  // Social linking endpoints
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
    if (!clientId) throw new BadRequestException('Google OAuth is not configured.');
    const { state, txSecret } = await this.oauthStateService.createOAuthState({
      returnTo: '/settings/security',
      userId: user.id,
      provider: 'google',
      intent: 'link',
    });
    setOAuthTxCookie(res, txSecret);
    return {
      url: `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=openid%20email%20profile&state=${encodeURIComponent(state)}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('social/unlink-google')
  async unlinkGoogle(@CurrentUser() user: any) {
    return this.accountService.unlinkSocial(user.id, 'google');
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
    if (!clientId) throw new BadRequestException('Discord OAuth is not configured.');
    const { state, txSecret } = await this.oauthStateService.createOAuthState({
      returnTo: '/settings/security',
      userId: user.id,
      provider: 'discord',
      intent: 'link',
    });
    setOAuthTxCookie(res, txSecret);
    return {
      url: `https://discord.com/api/oauth2/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(callbackUrl)}&response_type=code&scope=identify%20email&state=${encodeURIComponent(state)}`,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Post('social/unlink-discord')
  async unlinkDiscord(@CurrentUser() user: any) {
    return this.accountService.unlinkSocial(user.id, 'discord');
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

    const { state: stateToken, txSecret } = await this.oauthStateService.createOAuthState({
      returnTo,
      provider: 'google',
      intent: 'login',
    });
    setOAuthTxCookie(res, txSecret);
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

    const txSecret = readCookie(req, 'plexsync_oauth_tx');
    clearOAuthTxCookie(res);
    const verifiedState = await this.oauthStateService.consumeOAuthState(state || '', 'google', txSecret);
    const targetReturnTo = verifiedState.returnTo;
    const currentUserId = verifiedState.userId;

    if (error || !code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=ACCESS_DENIED&return_to=${encodeURIComponent(targetReturnTo)}`);
    }

    try {
      // 1. Exchange the code for an access token
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
        throw new BadRequestException(`Could not get the Google access token: ${tokenData.error_description || tokenData.error || 'OAuth failure'}`);
      }

      // 2. Fetch the profile
      const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await userRes.json();

      const clientIp = requestIp(req);
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
        deviceIdFrom(req, res),
      );

      setSessionCookie(res, accessToken);
      return res.redirect(`${frontendUrl}/auth/callback?return_to=${encodeURIComponent(targetReturnTo)}`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${oauthErrorCode(err)}&return_to=${encodeURIComponent(targetReturnTo)}`);
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

    const { state: stateToken, txSecret } = await this.oauthStateService.createOAuthState({
      returnTo,
      provider: 'discord',
      intent: 'login',
    });
    setOAuthTxCookie(res, txSecret);
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

    const txSecret = readCookie(req, 'plexsync_oauth_tx');
    clearOAuthTxCookie(res);
    const verifiedState = await this.oauthStateService.consumeOAuthState(state || '', 'discord', txSecret);
    const targetReturnTo = verifiedState.returnTo;
    const currentUserId = verifiedState.userId;

    if (error || !code) {
      return res.redirect(`${frontendUrl}/auth/callback?error=ACCESS_DENIED&return_to=${encodeURIComponent(targetReturnTo)}`);
    }

    try {
      // 1. Exchange the code
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
        throw new BadRequestException(`Could not get the Discord access token: ${tokenData.error_description || tokenData.error || 'OAuth failure'}`);
      }

      // 2. Fetch the user
      const userRes = await fetch('https://discord.com/api/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      const profile = await userRes.json();

      const avatarUrl = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;

      const clientIp = requestIp(req);
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
        deviceIdFrom(req, res),
      );

      setSessionCookie(res, accessToken);
      return res.redirect(`${frontendUrl}/auth/callback?return_to=${encodeURIComponent(targetReturnTo)}`);
    } catch (err: any) {
      return res.redirect(`${frontendUrl}/auth/callback?error=${oauthErrorCode(err)}&return_to=${encodeURIComponent(targetReturnTo)}`);
    }
  }
}
