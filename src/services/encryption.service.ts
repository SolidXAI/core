import * as crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const SCRYPT_SALT = 'solid-encryption-salt';
const ENC_PREFIX = 'enc:';

export class EncryptionService {
  private readonly key: Buffer;

  constructor(secret: string) {
    if (!secret) throw new Error('EncryptionService: secret must not be empty');
    this.key = crypto.scryptSync(secret, SCRYPT_SALT, KEY_LENGTH) as Buffer;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${ENC_PREFIX}${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    if (!ciphertext.startsWith(ENC_PREFIX)) {
      throw new Error('EncryptionService: value does not appear to be encrypted');
    }
    const payload = ciphertext.slice(ENC_PREFIX.length);
    const [ivHex, authTagHex, encryptedHex] = payload.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encryptedBuf = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, this.key, iv, { authTagLength: AUTH_TAG_LENGTH });
    decipher.setAuthTag(authTag);
    return decipher.update(encryptedBuf).toString('utf8') + decipher.final('utf8');
  }

  isEncrypted(value: string): boolean {
    return typeof value === 'string' && value.startsWith(ENC_PREFIX);
  }
}
