import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { sendVerificationEmail, sendPasswordResetEmail } from '../services/emailService';
import { JWT_SECRET, ACCESS_EXPIRES, ACCESS_SIGNATURE } from '../config/authConfig';
import { requireAuth } from '../middleware/auth';
import {
  ensureDefaultPlans,
  ensureTrialSubscription,
  getSubscriptionSummary,
  subscriptionToResponse,
  syncStripeSubscriptionIfExists,
} from '../services/subscriptionService';

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

    const existing = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });

    if (existing) {
      return res.status(409).json({ error: 'email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const verificationToken = crypto.randomBytes(32).toString('hex');
    const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        passwordHash: hash,
        name: trimmedName,
        emailVerified: false,
        verificationToken,
        verificationTokenExpires: verificationExpires,
      },
    });

    await ensureDefaultPlans();
    await ensureTrialSubscription(user.id);

    try {
      await sendVerificationEmail(normalizedEmail, verificationToken);
    } catch (emailError: any) {
      console.error('[auth] Failed to send verification email', {
        email: normalizedEmail,
        error: emailError.message,
      });
      // Continue anyway - user is created, they can request a new verification email
    }

    res.status(201).json({ message: 'Verification email sent. Please confirm to activate your account.' });
  } catch (e: any) {
    console.error('[auth] Registration error', { error: e.message, stack: e.stack });
    res.status(500).json({ error: 'error registering user' });
  }
});

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = email?.trim().toLowerCase();
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });
    if (!user) return res.status(401).json({ error: 'invalid credentials' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'invalid credentials' });
    if (!user.emailVerified) return res.status(403).json({ error: 'email not verified' });

    // Sincroniza com Stripe antes de buscar o resumo para garantir dados atualizados
    await syncStripeSubscriptionIfExists(user.id);

    const summary = await getSubscriptionSummary(user.id);
    const token = signAccess(user);
    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ...subscriptionToResponse(summary),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'authentication error' });
  }
});

router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    const payload: any = jwt.verify(token, JWT_SECRET);
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
    const { email, name } = req.body;
    
    // Validate inputs
    const emailError = validateEmail(email);
    if (emailError) return res.status(400).json({ error: emailError });
    
    const nameError = validateName(name);
    if (nameError) return res.status(400).json({ error: nameError });
    
    const normalizedEmail = email.trim().toLowerCase();
    const trimmedName = name.trim();
    
    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true },
    });
    
    // Check if user exists and name matches (case-insensitive)
    if (!user || user.name?.trim().toLowerCase() !== trimmedName.toLowerCase()) {
      console.log('[auth] Password recovery failed - invalid credentials', {
        email: normalizedEmail,
        providedName: trimmedName,
      });
      return res.status(400).json({ error: 'Os dados fornecidos não estão corretos ou não existem na base de dados.' });
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const expires = new Date(Date.now() + 3600000); // 1h
    
    await prisma.user.update({
      where: { email: normalizedEmail },
      data: {
        resetToken,
        resetTokenExpires: expires,
      },
    });
    
    // Send password reset email
    try {
      await sendPasswordResetEmail(normalizedEmail, resetToken);
      console.log('[auth] Password reset email sent successfully', {
        email: normalizedEmail,
      });
    } catch (emailError: any) {
      console.error('[auth] Failed to send password reset email', {
        email: normalizedEmail,
        error: emailError.message,
      });
      return res.status(500).json({ error: 'Erro ao enviar email de recuperação. Por favor, tente novamente.' });
    }
    
    res.json({ ok: true, message: 'Email de recuperação enviado com sucesso.' });
  } catch (e: any) {
    console.error('[auth] Password recovery error', { error: e.message, stack: e.stack });
    res.status(500).json({ error: 'Erro ao processar pedido. Por favor, tente novamente.' });
  }
});

router.get('/reset/validate', async (req: Request, res: Response) => {
  try {
    const token = req.query.token as string;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token é obrigatório.' });
    }
    
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }
    
    res.json({ valid: true });
  } catch (e: any) {
    console.error('[auth] Error validating reset token', { error: e.message });
    res.status(500).json({ error: 'Erro ao validar token.' });
  }
});

router.post('/reset', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'Token é obrigatório.' });
    }
    
    const passwordError = validatePassword(password);
    if (passwordError) return res.status(400).json({ error: passwordError });
    
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpires: {
          gt: new Date(),
        },
      },
      select: { id: true },
    });
    
    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }
    
    const hash = await bcrypt.hash(password, 10);
    await prisma.user.updateMany({
      where: { resetToken: token },
      data: {
        passwordHash: hash,
        resetToken: null,
        resetTokenExpires: null,
      },
    });
    
    res.json({ ok: true, message: 'Password redefinida com sucesso.' });
  } catch (e: any) {
    console.error('[auth] Error resetting password', { error: e.message });
    res.status(500).json({ error: 'Erro ao redefinir password.' });
  }
});

router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { token } = req.body;
    if (!token || typeof token !== 'string') {
      return res.status(400).json({ error: 'verification token is required' });
    }

    // First, try to find user with this token
    const userWithToken = await prisma.user.findFirst({
      where: {
        verificationToken: token,
        verificationTokenExpires: {
          gt: new Date(),
        },
      },
    });

    // If token is valid, verify the user
    if (userWithToken) {
      const verifiedUser = await prisma.user.update({
        where: { id: userWithToken.id },
        data: {
          emailVerified: true,
          verificationToken: null,
          verificationTokenExpires: null,
        },
      });

      await ensureTrialSubscription(verifiedUser.id);
      const summary = await getSubscriptionSummary(verifiedUser.id);
      const accessToken = signAccess(verifiedUser);

      return res.json({
        token: accessToken,
        user: {
          id: verifiedUser.id,
          email: verifiedUser.email,
          name: verifiedUser.name,
          ...subscriptionToResponse(summary),
        },
      });
    }

    // If token not found, check if user might already be verified
    // Try to find any user that might have used this token (by checking recently verified users)
    // Since we can't track which token was used, we'll check if there's a user with emailVerified=true
    // and no verificationToken (meaning they were verified)
    // But we can't match the token to the user, so we'll just return an error
    
    // However, if the user is already verified and trying to verify again,
    // we should check if they're authenticated and return success
    // For now, return error for invalid/expired token
    return res.status(400).json({ error: 'invalid or expired token' });
  } catch (e) {
    console.error('[auth] Error verifying email', e);
    res.status(500).json({ error: 'error verifying email' });
  }
});

router.get('/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return res.status(404).json({ error: 'user not found' });
    }

    // Sincroniza com Stripe antes de buscar o resumo para garantir dados atualizados
    await syncStripeSubscriptionIfExists(user.id);

    const summary = await getSubscriptionSummary(user.id);
    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        ...subscriptionToResponse(summary),
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'error fetching user' });
  }
});

export default router;


