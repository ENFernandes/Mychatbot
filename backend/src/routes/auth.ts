import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-change-me';
const ACCESS_EXPIRES = '3h';

function signAccess(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email e password são obrigatórios' });
    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users(email, password_hash, name) VALUES($1,$2,$3) RETURNING id, email, name',
      [email, hash, name || null]
    );
    const user = result.rows[0];
    const token = signAccess(user);
    res.json({ token, user });
  } catch (e: any) {
    if (e?.code === '23505') return res.status(409).json({ error: 'email já existe' });
    res.status(500).json({ error: 'erro ao registar' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT id, email, password_hash, name FROM users WHERE email=$1', [email]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'credenciais inválidas' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'credenciais inválidas' });
    const token = signAccess(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: 'erro ao autenticar' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const payload: any = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    const newToken = jwt.sign({ sub: payload.sub, email: payload.email }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
    res.json({ token: newToken });
  } catch (e) {
    res.status(401).json({ error: 'token inválido' });
  }
});

router.post('/recover', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const result = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (result.rowCount === 0) {
      // Não revelar se email existe
      return res.json({ ok: true });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1h
    await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [resetToken, expires, email]
    );
    // Em produção, enviar email aqui com link de reset
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'erro ao processar' });
  }
});

router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    const result = await pool.query(
      'SELECT id FROM users WHERE reset_token=$1 AND reset_token_expires > now()',
      [token]
    );
    if (result.rowCount === 0) return res.status(400).json({ error: 'token inválido ou expirado' });
    const hash = await bcrypt.hash(password, 10);
    await pool.query(
      'UPDATE users SET password_hash=$1, reset_token=NULL, reset_token_expires=NULL WHERE reset_token=$2',
      [hash, token]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'erro ao resetar' });
  }
});

export default router;


