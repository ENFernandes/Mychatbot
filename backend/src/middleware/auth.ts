import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'não autenticado' });
  try {
    const payload: any = jwt.verify(token, JWT_SECRET);
    (req as any).userId = payload.sub;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'token inválido' });
  }
}


