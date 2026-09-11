import {
  IsBoolean,
  IsString,
  IsOptional,
  IsInt,
  Min,
  Max,
  IsDateString,
} from 'class-validator';

export class UpdateAnnouncementDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsOptional()
  createdAt?: any;

  @IsOptional()
  updatedAt?: any;

  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @IsString()
  @IsOptional()
  themePreset?: string;

  @IsString()
  @IsOptional()
  badgeText?: string;

  @IsString()
  @IsOptional()
  badgeBgColor?: string;

  @IsString()
  @IsOptional()
  badgeTextColor?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  mediaType?: string; // NONE, IMAGE, GIF, ICON

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  mediaPosition?: string; // LEFT, RIGHT, BACKGROUND

  @IsString()
  @IsOptional()
  backgroundType?: string; // GRADIENT, SOLID, IMAGE, GIF

  @IsString()
  @IsOptional()
  backgroundValue?: string;

  @IsString()
  @IsOptional()
  textColor?: string;

  @IsString()
  @IsOptional()
  effectType?: string; // NONE, SNOWFLAKES, FLOATING_HEARTS, CONFETTI, SPOOKY_BATS, CYBER_GLOW, SPARKLES

  @IsString()
  @IsOptional()
  ctaText?: string;

  @IsString()
  @IsOptional()
  ctaUrl?: string;

  @IsString()
  @IsOptional()
  ctaTarget?: string; // _self, _blank

  @IsString()
  @IsOptional()
  ctaBgColor?: string;

  @IsString()
  @IsOptional()
  ctaTextColor?: string;

  @IsBoolean()
  @IsOptional()
  isClosable?: boolean;

  @IsString()
  @IsOptional()
  targetAudience?: string; // ALL, AUTHENTICATED, GUEST, ADMIN_ONLY

  @IsDateString()
  @IsOptional()
  startsAt?: string;

  @IsDateString()
  @IsOptional()
  endsAt?: string;

  @IsString()
  @IsOptional()
  category?: string; // FESTIVE, PROMO, INFO, CUSTOM

  @IsBoolean()
  @IsOptional()
  enableGlobalAtmosphere?: boolean;

  @IsInt()
  @Min(1)
  @Max(365)
  @IsOptional()
  dismissExpiryDays?: number;
}

export class CreateCustomPresetDto {
  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  category?: string;

  @IsString()
  @IsOptional()
  themePreset?: string;

  @IsString()
  @IsOptional()
  badgeText?: string;

  @IsString()
  @IsOptional()
  badgeBgColor?: string;

  @IsString()
  @IsOptional()
  badgeTextColor?: string;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsOptional()
  mediaType?: string;

  @IsString()
  @IsOptional()
  mediaUrl?: string;

  @IsString()
  @IsOptional()
  mediaPosition?: string;

  @IsString()
  @IsOptional()
  backgroundType?: string;

  @IsString()
  @IsOptional()
  backgroundValue?: string;

  @IsString()
  @IsOptional()
  textColor?: string;

  @IsString()
  @IsOptional()
  effectType?: string;

  @IsBoolean()
  @IsOptional()
  enableGlobalAtmosphere?: boolean;

  @IsString()
  @IsOptional()
  ctaText?: string;

  @IsString()
  @IsOptional()
  ctaUrl?: string;

  @IsString()
  @IsOptional()
  ctaTarget?: string;

  @IsString()
  @IsOptional()
  ctaBgColor?: string;

  @IsString()
  @IsOptional()
  ctaTextColor?: string;

  @IsBoolean()
  @IsOptional()
  isClosable?: boolean;
}


