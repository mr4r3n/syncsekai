import { ConfigService } from '@nestjs/config';

const KNOWN_INSECURE_VALUES = new Set([
  'super_secret_plexsync_jwt_key_2026_change_in_production',
  'plexsync_super_secret_jwt_key_2025',
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
]);

export function getRequiredSecret(
  configService: ConfigService,
  name: string,
  minimumBytes = 32,
): string {
  const value = configService.get<string>(name)?.trim();
  if (!value) {
    throw new Error(`FATAL: ${name} environment variable is required.`);
  }
  if (Buffer.byteLength(value, 'utf8') < minimumBytes) {
    throw new Error(`FATAL: ${name} must contain at least ${minimumBytes} bytes.`);
  }
  if (KNOWN_INSECURE_VALUES.has(value)) {
    throw new Error(`FATAL: ${name} uses a known insecure default and must be rotated.`);
  }
  return value;
}
