import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET, ACCESS_SIGNATURE } from '../config/authConfig';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'not authenticated' });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    if (payload.sig !== ACCESS_SIGNATURE) {
      return res.status(401).json({ error: 'invalid token signature' });
    }
    (req as any).userId = payload.sub;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'invalid token' });
  }
}


