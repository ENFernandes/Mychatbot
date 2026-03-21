import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many authentication attempts, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    return req.ip || req.headers['x-forwarded-for']?.toString() || 'unknown';
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'test';
  },
});

export const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: { error: 'Too many chat requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as any).userId;
    return userId || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'test';
  },
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,
  message: { error: 'Too many API requests, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as any).userId;
    return userId || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'test';
  },
});

export const fileUploadLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  message: { error: 'Too many file uploads, please slow down.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: Request) => {
    const userId = (req as any).userId;
    return userId || req.ip || 'unknown';
  },
  skip: (req: Request) => {
    return process.env.NODE_ENV === 'test';
  },
});
