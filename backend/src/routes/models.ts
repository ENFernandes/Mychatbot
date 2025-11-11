import { Router, Request, Response } from 'express';
import { openaiListModels } from '../providers/openaiClient';
import { geminiListModels } from '../providers/geminiClient';
import { claudeListModels } from '../providers/claudeClient';
import { pool } from '../config/database';
import { decrypt } from '../services/encryptionService';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const router = Router();

router.use(requireAuth);
router.use(enforceActiveSubscription);

router.get('/', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || '';
    if (!provider) return res.status(400).json({ error: 'provider is required' });

    const userId = (req as any).userId as string;
    const keyResult = await pool.query(
      'SELECT encrypted_key, iv FROM user_api_keys WHERE user_id=$1 AND provider=$2',
      [userId, provider]
    );

    if (keyResult.rowCount === 0) {
      return res.status(404).json({ error: 'api key not configured' });
    }

    const { encrypted_key: encryptedKey, iv } = keyResult.rows[0];
    const apiKey = decrypt(encryptedKey, iv);

    let models: string[] = [];
    if (provider === 'openai') {
      models = await openaiListModels(apiKey);
    } else if (provider === 'gemini') {
      models = await geminiListModels(apiKey);
    } else if (provider === 'claude') {
      models = await claudeListModels(apiKey);
    } else {
      return res.status(400).json({ error: 'invalid provider' });
    }

    res.json({ models });
  } catch (err: any) {
    console.error('Error listing models:', err);
    res.status(500).json({ error: err?.message || 'Error listing models' });
  }
});

export default router;


