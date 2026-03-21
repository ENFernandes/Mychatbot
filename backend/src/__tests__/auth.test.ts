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
      expect(res.json).toHaveBeenCalledWith({ error: 'not authenticated' });
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
      expect(res.json).toHaveBeenCalledWith({ error: 'not authenticated' });
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
      
      const payload = { sub: 'user-123', sig: 'test-access-signature' };
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
      
      const payload = { sub: 'user-123' };
      const token = jwt.sign(payload, 'test-jwt-secret', { expiresIn: '1h' });
      
      const req = mockRequest({ authorization: `Bearer ${token}` });
      const res = mockResponse();
      
      requireAuth(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ error: 'invalid token signature' });
    });
  });

  describe('enforceActiveSubscription', () => {
    let mockGetSubscriptionSummary: jest.Mock;
    let mockIsSubscriptionActive: jest.Mock;
    let mockSubscriptionToResponse: jest.Mock;

    beforeEach(async () => {
      jest.resetModules();
      
      mockGetSubscriptionSummary = jest.fn();
      mockIsSubscriptionActive = jest.fn();
      mockSubscriptionToResponse = jest.fn();
      
      jest.mock('../services/subscriptionService', () => ({
        getSubscriptionSummary: mockGetSubscriptionSummary,
        isSubscriptionActive: mockIsSubscriptionActive,
        subscriptionToResponse: mockSubscriptionToResponse,
      }));
    });

    it('should return 403 when user is in trial and trial has ended', async () => {
      const { enforceActiveSubscription } = await import('../middleware/subscription');
      
      mockGetSubscriptionSummary.mockResolvedValue({
        planCode: 'TRIAL',
        status: 'TRIALING',
        provider: 'INTERNAL',
        trialEndsAt: new Date(Date.now() - 86400000),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      mockIsSubscriptionActive.mockReturnValue(false);
      mockSubscriptionToResponse.mockReturnValue({
        plan: 'trial',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() - 86400000).toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      
      const req = mockRequest({});
      (req as any).userId = 'user-123';
      const res = mockResponse();
      
      await enforceActiveSubscription(req, res, mockNext);
      
      expect(res.status).toHaveBeenCalledWith(402);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ 
        error: 'subscription_required',
        redirect: '/update-plan'
      }));
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next() when user has active pro subscription', async () => {
      const { enforceActiveSubscription } = await import('../middleware/subscription');
      
      mockGetSubscriptionSummary.mockResolvedValue({
        planCode: 'PRO',
        status: 'ACTIVE',
        provider: 'STRIPE',
        trialEndsAt: null,
        currentPeriodEnd: new Date(Date.now() + 86400000),
        cancelAtPeriodEnd: false,
      });
      mockIsSubscriptionActive.mockReturnValue(true);
      mockSubscriptionToResponse.mockReturnValue({
        plan: 'pro',
        subscriptionStatus: 'active',
        trialEndsAt: null,
        currentPeriodEnd: new Date(Date.now() + 86400000).toISOString(),
        cancelAtPeriodEnd: false,
      });
      
      const req = mockRequest({});
      (req as any).userId = 'user-123';
      const res = mockResponse();
      
      await enforceActiveSubscription(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });

    it('should call next() when user is in active trial', async () => {
      const { enforceActiveSubscription } = await import('../middleware/subscription');
      
      mockGetSubscriptionSummary.mockResolvedValue({
        planCode: 'TRIAL',
        status: 'TRIALING',
        provider: 'INTERNAL',
        trialEndsAt: new Date(Date.now() + 86400000),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      mockIsSubscriptionActive.mockReturnValue(true);
      mockSubscriptionToResponse.mockReturnValue({
        plan: 'trial',
        subscriptionStatus: 'trialing',
        trialEndsAt: new Date(Date.now() + 86400000).toISOString(),
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
      });
      
      const req = mockRequest({});
      (req as any).userId = 'user-123';
      const res = mockResponse();
      
      await enforceActiveSubscription(req, res, mockNext);
      
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
