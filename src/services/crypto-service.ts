import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;

function getRequiredSecret(secret: string | undefined, name: string): string {
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(`${name} must be configured in production to encrypt data.`);
    }
    return 'dev-only-cs2-encryption-key';
  }

  if (process.env.NODE_ENV === 'production' && secret.length < 32) {
    throw new Error(`${name} must be at least 32 characters in production.`);
  }

  return secret;
}

function getPrimaryEncryptionSecret(): string {
  const dataKey = process.env.DATA_ENCRYPTION_KEY?.trim();
  return getRequiredSecret(
    dataKey || process.env.AUTH_SECRET?.trim(),
    dataKey ? 'DATA_ENCRYPTION_KEY' : 'AUTH_SECRET'
  );
}

function getDecryptionSecrets(): string[] {
  const authSecret = process.env.AUTH_SECRET?.trim();
  return Array.from(
    new Set([getPrimaryEncryptionSecret(), authSecret].filter(Boolean) as string[])
  );
}

function deriveKey(secret: string): Buffer {
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(text: string): string {
  if (!text) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = deriveKey(getPrimaryEncryptionSecret());
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      return encryptedText;
    }

    const [ivHex, tagHex, ciphertextHex] = parts;
    if (
      !/^[0-9a-fA-F]+$/.test(ivHex) ||
      !/^[0-9a-fA-F]+$/.test(tagHex) ||
      !/^[0-9a-fA-F]+$/.test(ciphertextHex)
    ) {
      return encryptedText;
    }

    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');

    for (const secret of getDecryptionSecrets()) {
      try {
        const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, deriveKey(secret), iv);
        decipher.setAuthTag(tag);

        let decrypted = decipher.update(ciphertext, undefined, 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
      } catch {
        // Try the next key in the key ring.
      }
    }

    return '';
  } catch (error) {
    console.error('Failed to decrypt secure data:', error);
    return '';
  }
}
