import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api, setAccessToken, refreshToken } from '../services/api';

describe('api service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it('should export setAccessToken function', () => {
    expect(typeof setAccessToken).toBe('function');
  });

  it('should export refreshToken function', () => {
    expect(typeof refreshToken).toBe('function');
  });

  it('should have api configured', () => {
    expect(api).toBeDefined();
    expect(api.defaults).toBeDefined();
  });

  it('setAccessToken should not throw', () => {
    expect(() => setAccessToken('test-token')).not.toThrow();
    expect(() => setAccessToken(null)).not.toThrow();
  });
});
