import { Router, Request, Response } from 'express';
import { ApiProvider } from '@prisma/client';
import { prisma } from '../config/database';
import { encrypt } from '../services/encryptionService';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const router = Router();

router.use(requireAuth);
router.use(enforceActiveSubscription);

function parseProvider(value: string | undefined): ApiProvider | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase() as keyof typeof ApiProvider;
  return ApiProvider[normalized] ?? null;
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const keys = await prisma.userApiKey.findMany({
      where: { userId },
      select: {
        provider: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { provider: 'asc' },
    });
    res.json({
      keys: keys.map((key) => ({
        provider: key.provider.toLowerCase(),
        created_at: key.createdAt,
        updated_at: key.updatedAt,
      })),
    });
  } catch (error: any) {
    console.error('Error fetching API keys:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

router.put('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { provider, apiKey } = req.body as { provider: 'openai' | 'gemini' | 'claude'; apiKey: string };
    if (!provider || !apiKey) return res.status(400).json({ error: 'provider and apiKey are required' });

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(401).json({ error: 'user not found' });
    }

    const providerEnum = parseProvider(provider);
    if (!providerEnum) {
      return res.status(400).json({ error: 'invalid provider' });
    }

    const { cipherText, iv } = encrypt(apiKey);

    await prisma.userApiKey.upsert({
      where: {
        userId_provider: {
          userId,
          provider: providerEnum,
        },
      },
      create: {
        userId,
        provider: providerEnum,
        encryptedKey: cipherText,
        iv,
      },
      update: {
        encryptedKey: cipherText,
        iv,
      },
    });
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error saving API key:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:provider', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const providerEnum = parseProvider(req.params.provider);

    if (!providerEnum) {
      return res.status(400).json({ error: 'invalid provider' });
    }

    await prisma.userApiKey.deleteMany({
      where: { userId, provider: providerEnum },
    });

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;


