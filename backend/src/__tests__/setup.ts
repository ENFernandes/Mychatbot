import { jest } from '@jest/globals';

jest.setTimeout(30000);

process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
process.env.ACCESS_SIGNATURE = 'test-access-signature-key-for-testing-only';
process.env.ENCRYPTION_KEY = 'test-encryption-key-32bytes!!!';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';
process.env.STRIPE_WEBHOOK_SECRET = 'test-stripe-webhook-secret';
process.env.RESEND_API_KEY = 'test-resend-api-key';

beforeAll(() => {
  console.log = jest.fn();
  console.error = jest.fn();
  console.warn = jest.fn();
});

afterAll(() => {
  jest.restoreAllMocks();
});
