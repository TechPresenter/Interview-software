import crypto from 'node:crypto';
import { config } from '../config/index.js';

/**
 * Symmetric encryption for secrets at rest (AI provider API keys).
 *
 * AES-256-GCM. The 32-byte key is derived (sha256) from AI_ENCRYPTION_KEY, or —
 * so the app runs out of the box — from the JWT access secret. Set a dedicated
 * AI_ENCRYPTION_KEY in production and never change it without re-encrypting.
 *
 * Stored format:  enc:v1:<iv_b64>:<tag_b64>:<ciphertext_b64>
 */

const PREFIX = 'enc:v1:';
let keyCache = null;

function key() {
  if (keyCache) return keyCache;
  const secret = config.ai.encryptionKey || config.jwt.accessSecret;
  keyCache = crypto.createHash('sha256').update(String(secret)).digest(); // 32 bytes
  return keyCache;
}

/** Is this value an encrypted blob produced by encryptSecret()? */
export function isEncrypted(v) {
  return typeof v === 'string' && v.startsWith(PREFIX);
}

/** Encrypt a plaintext secret. Idempotent + passes through empty values. */
export function encryptSecret(plain) {
  if (plain == null || plain === '') return plain;
  if (isEncrypted(plain)) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + [iv.toString('base64'), tag.toString('base64'), ct.toString('base64')].join(':');
}

/**
 * Decrypt a blob. Legacy/plaintext values (not in the enc: format) are returned
 * as-is so pre-encryption rows keep working. Returns null if decryption fails
 * (e.g. the key changed).
 */
export function decryptSecret(value) {
  if (!isEncrypted(value)) return value;
  try {
    const [, , ivB64, tagB64, ctB64] = value.split(':');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

export default { encryptSecret, decryptSecret, isEncrypted };
