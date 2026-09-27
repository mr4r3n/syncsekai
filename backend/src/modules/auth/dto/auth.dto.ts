import { IsArray, IsEmail, IsInt, IsNotEmpty, IsOptional, IsString, Min, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'The email format is not valid.' })
  email: string;

  @IsNotEmpty({ message: 'The username is required.' })
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

