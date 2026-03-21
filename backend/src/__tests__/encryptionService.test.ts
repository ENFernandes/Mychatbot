import { encrypt, decrypt, toBuffer } from '../services/encryptionService';

describe('EncryptionService', () => {
  const testKey = 'test-encryption-key-32bytes!!!';
  const originalEnv = process.env.ENCRYPTION_KEY;

  beforeEach(() => {
    process.env.ENCRYPTION_KEY = testKey;
  });

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnv;
  });

  describe('encrypt and decrypt', () => {
    it('should encrypt and decrypt a string correctly', () => {
      const plaintext = 'sk-test-api-key-12345';
      const { cipherText, iv } = encrypt(plaintext);

      expect(cipherText).toBeDefined();
      expect(iv).toBeDefined();
      expect(cipherText).not.toBe(plaintext);

      const decrypted = decrypt(cipherText, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertext for same plaintext (due to random IV)', () => {
      const plaintext = 'sk-test-api-key-12345';
      const { cipherText: cipher1, iv: iv1 } = encrypt(plaintext);
      const { cipherText: cipher2, iv: iv2 } = encrypt(plaintext);

      expect(cipher1).not.toEqual(cipher2);
      expect(iv1).not.toEqual(iv2);

      expect(decrypt(cipher1, iv1)).toBe(plaintext);
      expect(decrypt(cipher2, iv2)).toBe(plaintext);
    });

    it('should handle empty string', () => {
      const plaintext = '';
      const { cipherText, iv } = encrypt(plaintext);
      const decrypted = decrypt(cipherText, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle unicode characters', () => {
      const plaintext = 'Hello 世界 🌍 مرحبا';
      const { cipherText, iv } = encrypt(plaintext);
      const decrypted = decrypt(cipherText, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle long strings', () => {
      const plaintext = 'a'.repeat(10000);
      const { cipherText, iv } = encrypt(plaintext);
      const decrypted = decrypt(cipherText, iv);
      expect(decrypted).toBe(plaintext);
    });

    it('should handle special characters', () => {
      const plaintext = '!@#$%^&*()_+-=[]{}|;:,.<>?/`~"\'';
      const { cipherText, iv } = encrypt(plaintext);
      const decrypted = decrypt(cipherText, iv);
      expect(decrypted).toBe(plaintext);
    });
  });

  describe('toBuffer', () => {
    it('should convert Uint8Array to Buffer', () => {
      const uint8 = new Uint8Array([104, 105]);
      const buffer = toBuffer(uint8);
      expect(Buffer.isBuffer(buffer)).toBe(true);
      expect(buffer.toString()).toBe('hi');
    });

    it('should return Buffer as-is if already a Buffer', () => {
      const originalBuffer = Buffer.from('hello');
      const result = toBuffer(originalBuffer);
      expect(result).toBe(originalBuffer);
    });

    it('should handle empty Uint8Array', () => {
      const uint8 = new Uint8Array(0);
      const buffer = toBuffer(uint8);
      expect(Buffer.isBuffer(buffer)).toBe(true);
    });
  });

  describe('error handling', () => {
    it('should throw error with invalid IV length', () => {
      const { cipherText } = encrypt('test');
      const invalidIv = Buffer.from('short');
      
      expect(() => decrypt(cipherText, invalidIv)).toThrow();
    });

    it('should throw error with tampered ciphertext', () => {
      const { cipherText, iv } = encrypt('test');
      const tampered = Buffer.from(cipherText);
      tampered[0] = tampered[0] ^ 0xff;
      
      expect(() => decrypt(tampered, iv)).toThrow();
    });
  });
});
