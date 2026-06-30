import crypto from 'crypto';

const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 12 bytes IV for GCM

// Derive a 32-byte key from AUTH_SECRET (or fallback value if not set)
function getEncryptionKey(): Buffer {
  const secret = process.env.AUTH_SECRET?.trim();
  if (!secret) {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('AUTH_SECRET must be configured in production to encrypt data.');
    }
    return crypto.createHash('sha256').update('dev-only-cs2-encryption-key').digest();
  }
  return crypto.createHash('sha256').update(secret).digest();
}

/**
 * Encrypts a plain text string to a secure, hex-encoded string containing IV, Auth Tag, and Ciphertext.
 * Format: iv_hex:tag_hex:ciphertext_hex
 */
export function encrypt(text: string): string {
  if (!text) return '';

  const iv = crypto.randomBytes(IV_LENGTH);
  const key = getEncryptionKey();

  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const tag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted}`;
}

/**
 * Decrypts a secure hex-encoded string back to plain text.
 * Handles potential errors by returning an empty string or throwing.
 */
export function decrypt(encryptedText: string): string {
  if (!encryptedText) return '';

  try {
    const parts = encryptedText.split(':');
    if (parts.length !== 3) {
      // If it doesn't match the encrypted format, it might be unencrypted legacy data
      return encryptedText;
    }

    const [ivHex, tagHex, ciphertextHex] = parts;

    // Validate hex formatting to avoid runtime crashes on malformed input
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

    const key = getEncryptionKey();
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let decrypted = decipher.update(ciphertext, undefined, 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt secure data:', error);
    // Fail closed: do not return ciphertext as plaintext fallback
    return '';
  }
}
