import crypto from 'crypto';

const RAW_KEY = process.env.ENCRYPTION_KEY || 'dev-secret-key-change-me-please-32bytes!!';

function getKey(): Buffer {
  // Ensure 32 bytes
  const buf = Buffer.alloc(32);
  const source = Buffer.from(RAW_KEY);
  source.copy(buf, 0, 0, Math.min(source.length, 32));
  return buf;
}

export function encrypt(value: string): { cipherText: Buffer; iv: Buffer } {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const enc = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { cipherText: Buffer.concat([enc, tag]), iv };
}

export function decrypt(cipherWithTag: Buffer, iv: Buffer): string {
  const tag = cipherWithTag.slice(cipherWithTag.length - 16);
  const data = cipherWithTag.slice(0, cipherWithTag.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}


