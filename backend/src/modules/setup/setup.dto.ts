import { IsString, IsNotEmpty, IsEmail, IsOptional, IsInt, Min, Max, MinLength, MaxLength, IsUrl } from 'class-validator';

export class InitializeSetupDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  bootstrapToken: string;

  // Dominio & Red
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  appDomain: string;

  @IsOptional()
  @IsUrl({ require_protocol: true, protocols: ['https', 'http'] })
  webhookPublicUrl?: string;

  // SMTP Correo
  @IsString()
  @IsOptional()
  smtpHost?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  smtpPort?: number;

  @IsString()
  @IsOptional()
  smtpUser?: string;

  @IsString()
  @IsOptional()
  smtpPassword?: string;

  @IsString()
  @IsOptional()
  smtpFrom?: string;

  // APIs Externas
  @IsString()
  @IsOptional()
  anilistClientId?: string;

  @IsString()
  @IsOptional()
  anilistClientSecret?: string;

  @IsString()
  @IsOptional()
  malClientId?: string;

  @IsString()
  @IsOptional()
  malClientSecret?: string;

  @IsString()
  @IsOptional()
  googleClientId?: string;

  @IsString()
  @IsOptional()
  googleClientSecret?: string;

  @IsString()
  @IsOptional()
  discordClientId?: string;

  @IsString()
  @IsOptional()
  discordClientSecret?: string;

  @IsString()
  @IsOptional()
  plexClientId?: string;

  // SuperAdministrador
  @IsString()
  @IsNotEmpty()
  adminUsername: string;

  @IsEmail()
  @IsNotEmpty()
  adminEmail: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  adminPassword: string;
}

export class TestSmtpDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(256)
  bootstrapToken: string;

  @IsString()
  @IsNotEmpty()
  smtpHost: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  smtpPort: number;

  @IsString()
  @IsOptional()
  smtpUser?: string;

  @IsString()
  @IsOptional()
  smtpPassword?: string;

  @IsString()
  @IsNotEmpty()
  smtpFrom: string;

  @IsEmail()
  @IsNotEmpty()
  testRecipient: string;
}
