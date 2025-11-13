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

/**
 * Converts Prisma Bytes field to Buffer
 * Prisma can return Bytes as Buffer, Uint8Array, or other formats depending on the database driver
 */
export function toBuffer(value: any): Buffer {
  // Handle null/undefined
  if (value == null) {
    throw new Error('Cannot convert null/undefined to Buffer');
  }
  
  // Already a Buffer
  if (Buffer.isBuffer(value)) {
    return value;
  }
  
  // Uint8Array (common Prisma format)
  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }
  
  // ArrayBuffer
  if (value instanceof ArrayBuffer) {
    return Buffer.from(value);
  }
  
  // Handle objects
  if (value && typeof value === 'object') {
    // TypedArray with buffer property (e.g., Uint8Array view)
    if ('buffer' in value && value.buffer instanceof ArrayBuffer) {
      const byteOffset = value.byteOffset || 0;
      const byteLength = value.byteLength !== undefined ? value.byteLength : (value.buffer.byteLength - byteOffset);
      return Buffer.from(value.buffer, byteOffset, byteLength);
    }
    
    // Handle objects with data property (some Prisma drivers)
    if ('data' in value && Array.isArray(value.data)) {
      return Buffer.from(value.data);
    }
    
    // Handle Prisma Bytes type (may have toString method)
    if (typeof value.toString === 'function' && value.constructor?.name === 'Bytes') {
      // Try to get the underlying buffer
      if (value.buffer) {
        return Buffer.from(value.buffer);
      }
    }
  }
  
  // Fallback: try to convert directly
  try {
    // If it's an array-like object, try Array.from first
    if (Array.isArray(value) || (typeof value === 'object' && 'length' in value && typeof value.length === 'number')) {
      return Buffer.from(Array.from(value));
    }
    return Buffer.from(value);
  } catch (error: any) {
    throw new Error(`Cannot convert value to Buffer: ${typeof value}, constructor: ${value?.constructor?.name}, error: ${error?.message}`);
  }
}

export function decrypt(cipherWithTag: Buffer, iv: Buffer): string {
  const tag = cipherWithTag.slice(cipherWithTag.length - 16);
  const data = cipherWithTag.slice(0, cipherWithTag.length - 16);
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), iv);
  decipher.setAuthTag(tag);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString('utf8');
}


