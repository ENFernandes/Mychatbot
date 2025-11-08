import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const ACCESS_EXPIRES = '3h';

type UserRow = {
  id: string;
  email: string;
  name: string | null;
  plan: 'trial' | 'pro';
  subscription_status: string | null;
  trial_ends_at: string | null;
  current_period_end: string | null;
};

function signAccess(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function serializeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    trialEndsAt: row.trial_ends_at,
    currentPeriodEnd: row.current_period_end,
  };
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password are required' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO users(email, password_hash, name)
       VALUES($1,$2,$3)
       RETURNING id, email, name, plan, subscription_status, trial_ends_at, current_period_end`,
      [email, hash, name || null]
    );
    const user = result.rows[0] as UserRow;
    const token = signAccess(user);
    res.json({ token, user: serializeUser(user) });
  } catch (e: any) {
    if (e?.code === '23505') return res.status(409).json({ error: 'email already exists' });
    res.status(500).json({ error: 'error registering user' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT id, email, password_hash, name, plan, subscription_status, trial_ends_at, current_period_end
       FROM users WHERE email=$1`,
      [email]
    );
    const user = result.rows[0] as UserRow & { password_hash: string };
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, (user as any).password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    const token = signAccess(user);
    res.json({ token, user: serializeUser(user) });
  } catch (e) {
    res.status(500).json({ error: 'authentication error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const payload: any = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    const newToken = jwt.sign({ sub: payload.sub, email: payload.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
    res.json({ token: newToken });
  } catch (e) {
    res.status(401).json({ error: 'invalid token' });
  }
});

router.post('/recover', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (result.rowCount === 0) {
      // Don't reveal if email exists
      return res.json({ ok: true });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1h
    await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [resetToken, expires, email]
    );
    // In production, send email here with reset link
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'error processing request' });
  }
});

router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires > now()',
      [token]
    );
    if (result.rowCount === 0) return res.status(400).json({ error: 'invalid or expired token' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE reset_token=$2',
      [hash, token]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'error resetting password' });
  }
});

export default router;


