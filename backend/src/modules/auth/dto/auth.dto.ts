import { IsArray, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'El formato de correo no es válido.' })
  email: string;

  @IsNotEmpty({ message: 'El nombre de usuario es obligatorio.' })
  username: string;

  @MinLength(12, { message: 'La contraseña debe contener al menos 12 caracteres.' })
  password: string;
}

export class LoginDto {
  @IsEmail({}, { message: 'El formato de correo no es válido.' })
  email: string;

  @IsNotEmpty({ message: 'La contraseña es obligatoria.' })
  password: string;

  @IsOptional()
  twoFactorCode?: string;
}

export class ForgotPasswordDto {
  @IsEmail({}, { message: 'El formato de correo no es válido.' })
  email: string;
}

export class ResetPasswordDto {
  @IsNotEmpty({ message: 'El token de recuperación es obligatorio.' })
  token: string;

  @MinLength(12, { message: 'La nueva contraseña debe tener al menos 12 caracteres.' })
  newPassword: string;
}

export class VerifyBackupCodesDto {
  @IsArray({ message: 'La lista de códigos debe ser un arreglo de cadenas.' })
  @IsNotEmpty({ message: 'La lista de códigos es obligatoria.' })
  codes: string[];

  @IsInt({ message: 'El índice de desafío debe ser un entero.' })
  @Min(0)
  challengeIndex: number;

  @IsNotEmpty({ message: 'El código de confirmación es obligatorio.' })
  @IsString()
  confirmedCode: string;
}

export class RecoverWithBackupCodeDto {
  @IsNotEmpty({ message: 'El usuario o correo electrónico es obligatorio.' })
  identifier: string;

  @IsNotEmpty({ message: 'El código de recuperación de emergencia es obligatorio.' })
  backupCode: string;

  @MinLength(12, { message: 'La nueva contraseña debe tener al menos 12 caracteres.' })
  newPassword: string;
}

