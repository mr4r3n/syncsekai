import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { getRequiredSecret } from '../security/required-secret';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private configService: ConfigService) {
    const rawKey = getRequiredSecret(this.configService, 'ENCRYPTION_KEY');
    // Ensure key is 32 bytes (256 bits)
    this.key = crypto.createHash('sha256').update(rawKey).digest();
  }

  encrypt(text: string): string {
    if (!text) return text;
    const iv = crypto.randomBytes(12); // 96-bit IV recommended for GCM
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const tag = cipher.getAuthTag().toString('hex');

    // Format: iv:tag:encrypted
    return `${iv.toString('hex')}:${tag}:${encrypted}`;
  }

  isEncrypted(payload: string | null | undefined): boolean {
    if (!payload) return false;
    return /^[0-9a-f]{24}:[0-9a-f]{32}:[0-9a-f]+$/i.test(payload);
  }

  decrypt(encryptedPayload: string): string {
    if (!encryptedPayload) return encryptedPayload;
    const parts = encryptedPayload.split(':');
    if (parts.length !== 3) {
      // Return as-is if unencrypted or legacy
      return encryptedPayload;
    }

    const [ivHex, tagHex, encryptedText] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');

    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }
}
