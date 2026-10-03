import { IsArray, IsBoolean, IsEmail, IsIn, IsInt, IsNotEmpty, IsOptional, IsString, Matches, Max, Min, MinLength } from 'class-validator';
import { USERNAME_PATTERN, USERNAME_RULE } from '../../../common/text/username';

export class RegisterDto {
  @IsEmail({}, { message: 'The email format is not valid.' })
  email: string;

  @IsNotEmpty({ message: 'The username is required.' })
  @Matches(USERNAME_PATTERN, { message: USERNAME_RULE })
  username: string;

  @MinLength(12, { message: 'The password must contain at least 12 characters.' })
  password: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'The email format is not valid.' })
  email: string;

  @IsNotEmpty({ message: 'The password is required.' })
  password: string;

  @IsOptional()
  twoFactorCode?: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'The email format is not valid.' })
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'The recovery token is required.' })
  token: string;

  @MinLength(12, { message: 'The new password must be at least 12 characters long.' })
  newPassword: string;
}

export class VerifyBackupCodesDto {
  @IsArray({ message: 'The code list must be an array of strings.' })
  @IsNotEmpty({ message: 'The code list is required.' })
  codes: string[];

  @IsInt({ message: 'The challenge index must be an integer.' })
  @Min(0)
  challengeIndex: number;

  @IsNotEmpty({ message: 'The confirmation code is required.' })
  @IsString()
  confirmedCode: string;
}

export class RecoverWithBackupCodeDto {
  @IsNotEmpty({ message: 'The username or email is required.' })
  identifier: string;

  @IsNotEmpty({ message: 'The emergency recovery code is required.' })
  backupCode: string;

  @MinLength(12, { message: 'The new password must be at least 12 characters long.' })
  newPassword: string;
}


/**
 * User settings, from Rules, Notifications and Appearance. Both endpoints that save
 * them (/api/auth/settings and /api/connections/settings) take this: before, they
 * stored any number or any text of any length.
 */
export class UpdateSettingsDto {
  @IsOptional() @IsInt() @Min(50) @Max(95)
  completionPercentage?: number;

  @IsOptional() @IsBoolean()
  syncRatings?: boolean;

  @IsOptional() @IsBoolean()
  emailErrorAlerts?: boolean;

  @IsOptional() @IsBoolean()
  discordNotifications?: boolean;

  @IsOptional() @IsBoolean()
  webNotifications?: boolean;

  @IsOptional() @IsBoolean()
  autoApproveMappings?: boolean;

  @IsOptional() @IsBoolean()
  showInLeaderboard?: boolean;

  @IsOptional() @IsIn(['BOTH', 'ANILIST', 'MAL', 'KITSU'])
  preferredTracker?: string;

  // Current palettes plus the legacy names still stored by older accounts (normalizePalette).
  @IsOptional() @IsIn(['sync', 'plex', 'grafito', 'carbon', 'marfil', 'discord-dark', 'discord-ash', 'discord-light'])
  themePalette?: string;

  @IsOptional() @IsIn(['dark', 'light'])
  themeMode?: string;
}
