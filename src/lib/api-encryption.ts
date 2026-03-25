import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export type EncryptedApiPayload = {
  encrypted: true;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
};

function normalizeKey(keyBase64: string): Buffer {
  const raw = Buffer.from(keyBase64, 'base64');
  if (raw.length === 32) return raw;

  // Normalize any incoming key length to 32 bytes deterministically.
  const normalized = Buffer.alloc(32);
  raw.copy(normalized, 0, 0, Math.min(raw.length, 32));
  return normalized;
}

export function createRequestEncryptionKeyBase64(): string {
  return randomBytes(32).toString('base64');
}

export function encryptApiPayload(payload: unknown, keyBase64: string): EncryptedApiPayload {
  const key = normalizeKey(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  const plaintext = JSON.stringify(payload);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return {
    encrypted: true,
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    data: encrypted.toString('base64'),
  };
}

export function decryptApiPayload<T>(payload: EncryptedApiPayload, keyBase64: string): T {
  const key = normalizeKey(keyBase64);
  const iv = Buffer.from(payload.iv, 'base64');
  const tag = Buffer.from(payload.tag, 'base64');
  const encrypted = Buffer.from(payload.data, 'base64');

  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');

  return JSON.parse(decrypted) as T;
}
