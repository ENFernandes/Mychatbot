import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const mockRequest = (headers: Record<string, string> = {}) => ({
  headers,
  body: {},
  params: {},
  query: {},
} as Request);

const mockResponse = () => {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext: NextFunction = jest.fn();

describe('Auth Middleware', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      JWT_SECRET: 'test-jwt-secret',
      ACCESS_SIGNATURE: 'test-access-signature',
    };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('requireAuth', () => {
    it('should return 401 when no authorization header', async () => {
      jest.resetModules();
      
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ACCESS_SIGNATURE = 'test-access-signature';
      
      const { requireAuth } = await import('../middleware/auth');
      
      const req = mockRequest({});
      const res = mockResponse();
      
      requireAuth(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'missing token' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token format', async () => {
      jest.resetModules();
      
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ACCESS_SIGNATURE = 'test-access-signature';
      
      const { requireAuth } = await import('../middleware/auth');
      
      const req = mockRequest({ authorization: 'InvalidFormat' });
      const res = mockResponse();
      
      requireAuth(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid token format' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for invalid token', async () => {
      jest.resetModules();
      
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ACCESS_SIGNATURE = 'test-access-signature';
      
      const { requireAuth } = await import('../middleware/auth');
      
      const req = mockRequest({ authorization: 'Bearer invalid.token.here' });
      const res = mockResponse();
      
      requireAuth(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() for valid token', async () => {
      jest.resetModules();
      
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ACCESS_SIGNATURE = 'test-access-signature';
      
      const { requireAuth } = await import('../middleware/auth');
      
      const payload = { userId: 'user-123' };
      const token = jwt.sign(payload, 'test-jwt-secret');
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      
      requireAuth(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
      expect((req as any).userId).toBe('user-123');
    });

    it('should return 401 when ACCESS_SIGNATURE is missing in token', async () => {
      jest.resetModules();
      
      process.env.JWT_SECRET = 'test-jwt-secret';
      process.env.ACCESS_SIGNATURE = 'test-access-signature';
      
      const { requireAuth } = await import('../middleware/auth');
      
      const payload = { userId: 'user-123' };
      const token = jwt.sign(payload, 'test-jwt-secret', { expiresIn: '1h' });
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      
      requireAuth(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid token' });
    });
  });

  describe('enforceActiveSubscription', () => {
    it('should return 403 when user is in trial and trial has ended', async () => {
      jest.resetModules();
      
      const { enforceActiveSubscription } = await import('../middleware/subscription');
      
      const expiredTrialDate = new Date(Date.now() - 86400000).toISOString();
      const req = mockRequest({});
      (req as any).userId = 'user-123';
      (req as any).user = {
        plan: 'trial',
        trialEndsAt: expiredTrialDate,
        isBillingLocked: false,
      };
      const res = mockResponse();
      
      enforceActiveSubscription(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Trial expired' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when user has active pro subscription', async () => {
      jest.resetModules();
      
      const { enforceActiveSubscription } = await import('../middleware/subscription');
      
      const req = mockRequest({});
      (req as any).userId = 'user-123';
      (req as any).user = {
        plan: 'pro',
        trialEndsAt: null,
        isBillingLocked: false,
      };
      const res = mockResponse();
      
      enforceActiveSubscription(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when user is in active trial', async () => {
      jest.resetModules();
      
      const { enforceActiveSubscription } = await import('../middleware/subscription');
      
      const futureTrialDate = new Date(Date.now() + 86400000).toISOString();
      const req = mockRequest({});
      (req as any).userId = 'user-123';
      (req as any).user = {
        plan: 'trial',
        trialEndsAt: futureTrialDate,
        isBillingLocked: false,
      };
      const res = mockResponse();
      
      enforceActiveSubscription(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
