import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendVerificationEmail } from '../services/emailService';
import { JWT_SECRET, ACCESS_EXPIRES, ACCESS_SIGNATURE } from '../config/authConfig';

const router = Router();

function signAccess(user: { id: string; email: string }) {
  return jwt.sign({ sub: user.id, email: user.email, sig: ACCESS_SIGNATURE }, JWT_SECRET, { expiresIn: ACCESS_EXPIRES });
}

function validateEmail(email: string) {
  if (!email || typeof email !== 'string') return 'email is required';
  const trimmed = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(trimmed)) return 'email format is invalid';
  return null;
}

function validateName(name: string | undefined | null) {
  if (!name || typeof name !== 'string') return 'name is required';
  const trimmed = name.trim();
  if (trimmed.length < 3) return 'name must be at least 3 characters long';
  return null;
}

function validatePassword(password: string) {
  if (!password || typeof password !== 'string') return 'password is required';
  if (password.length < 10) return 'password must be at least 10 characters long';
  if (!/[A-Z]/.test(password)) return 'password must include at least one uppercase letter';
  if (!/[a-z]/.test(password)) return 'password must include at least one lowercase letter';
  if (!/[0-9]/.test(password)) return 'password must include at least one number';
  if (!/[!@#$%^&*(),.?":{}|<>\[\];'`~\\/_+=-]/.test(password)) return 'password must include at least one symbol';
  return null;
}

router.post('/register', async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body;
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ error: emailError });
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ error: nameError });
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });

    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();

    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    await pool.query(
      `INSERT INTO users(email, password_hash, name, email_verified, verification_token, verification_token_expires)
       VALUES($1,$2,$3,false,$4,$5)`
        + ' ON CONFLICT (email) DO NOTHING',
      [normalizedEmail, hash, trimmedName, verificationToken, verificationExpires]
    );

    const inserted = await pool.query('SELECT id FROM users WHERE email=$1', [normalizedEmail]);
    if (inserted.rowCount === 0) {
      return res.status(409).json({ error: 'email already exists' });
    }

    await sendVerificationEmail(normalizedEmail, verificationToken);

    res.status(201).json({ message: 'Verification email sent. Please confirm to activate your account.' });
  } catch (e: any) {
    if (e?.code === '23505') return res.status(409).json({ error: 'email already exists' });
    res.status(500).json({ error: 'error registering user' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const result = await pool.query('SELECT id, email, password_hash, name, email_verified FROM users WHERE email=$1', [normalizedEmail]);
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.password_hash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    if (!user.email_verified) return res.status(403).json({ error: 'email not verified' });
    const token = signAccess(user);
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } });
  } catch (e) {
    res.status(500).json({ error: 'authentication error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const payload: any = jwt.verify(token, JWT_SECRET, { ignoreExpiration: true });
    if (payload.sig !== ACCESS_SIGNATURE) {
      return res.status(401).json({ error: 'invalid token' });
    }
    const newToken = jwt.sign({ sub: payload.sub, email: payload.email, sig: ACCESS_SIGNATURE }, JWT_SECRET, {
      expiresIn: ACCESS_EXPIRES,
    });
    res.json({ token: newToken });
  } catch (e) {
    res.status(401).json({ error: 'invalid token' });
  }
});

router.post('/recover', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const result = await pool.query('SELECT id FROM users WHERE email=$1', [normalizedEmail]);
    if (result.rowCount === 0) {
      // Don't reveal if email exists
      return res.json({ ok: true });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1h
    await pool.query(
      'UPDATE users SET reset_token=$1, reset_token_expires=$2 WHERE email=$3',
      [resetToken, expires, normalizedEmail]
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
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
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

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'verification token is required' });
    }

    const result = await pool.query(
      `SELECT id, email FROM users WHERE verification_token=$1 AND verification_token_expires > now()`,
      [token]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'invalid or expired token' });
    }

    const user = result.rows[0];

    const updated = await pool.query(
      `UPDATE users
       SET email_verified=true,
           verification_token=NULL,
           verification_token_expires=NULL,
           updated_at=now()
       WHERE id=$1
       RETURNING id, email, name`,
      [user.id]
    );

    const verifiedUser = updated.rows[0];
    const accessToken = signAccess(verifiedUser);

    res.json({ token: accessToken, user: verifiedUser });
  } catch (e) {
    res.status(500).json({ error: 'error verifying email' });
  }
});

export default router;


