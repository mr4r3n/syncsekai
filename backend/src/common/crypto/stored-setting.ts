import { Logger } from '@nestjs/common';
import type { PrismaService } from '../../prisma/prisma.service';
import type { EncryptionService } from './encryption.service';

const logger = new Logger('StoredSetting');

/**
 * A system credential (OAuth keys, SMTP…): the value set in Administration ->
 * System credentials, or the environment variable of the same name.
 *
 * A secret that no longer decrypts (ENCRYPTION_KEY changed) is reported and skipped.
 * It used to be returned as it was, so the encrypted text was sent to the provider
 * as the secret and sign-in failed with no clue why.
 */
export async function readStoredSetting(
  prisma: PrismaService,
  encryption: EncryptionService,
  key: string,
): Promise<string> {
  try {
    const setting = await prisma.systemSetting.findUnique({ where: { key } });
    if (setting?.value) {
      if (!setting.isSecret) return setting.value;
      try {
        return encryption.decrypt(setting.value);
      } catch {
        logger.error(`${key} cannot be decrypted (was ENCRYPTION_KEY changed?): set it again in System credentials.`);
      }
    }
  } catch (e: any) {
    logger.warn(`Could not read ${key} from the database: ${e.message}`);
  }
  return process.env[key] || '';
}
