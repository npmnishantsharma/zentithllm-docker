export type EncryptedApiPayload = {
  encrypted: true;
  alg: 'aes-256-gcm';
  iv: string;
  tag: string;
  data: string;
};

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary);
}

function fromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function normalizeAesKey(bytes: Uint8Array): Uint8Array {
  // Web Crypto AES requires 16 bytes (128-bit) or 32 bytes (256-bit).
  if (bytes.length === 16 || bytes.length === 32) {
    return bytes;
  }

  // Normalize arbitrary input to 32 bytes to match server-side behavior.
  const normalized = new Uint8Array(32);
  normalized.set(bytes.slice(0, 32));
  return normalized;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function createRequestEncryptionKeyBase64(): string {
  const key = new Uint8Array(32);
  crypto.getRandomValues(key);
  return toBase64(key);
}

export async function decryptApiPayloadClient<T>(payload: EncryptedApiPayload, keyBase64: string): Promise<T> {
  const keyBytes = normalizeAesKey(fromBase64(keyBase64));
  const key = await crypto.subtle.importKey('raw', toArrayBuffer(keyBytes), 'AES-GCM', false, ['decrypt']);

  const iv = fromBase64(payload.iv);
  const tag = fromBase64(payload.tag);
  const data = fromBase64(payload.data);

  // Web Crypto expects ciphertext + tag concatenated for AES-GCM.
  const cipherWithTag = new Uint8Array(data.length + tag.length);
  cipherWithTag.set(data, 0);
  cipherWithTag.set(tag, data.length);

  const plaintextBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
      tagLength: 128,
    },
    key,
    toArrayBuffer(cipherWithTag)
  );

  const plaintext = new TextDecoder().decode(plaintextBuffer);
  return JSON.parse(plaintext) as T;
}
