import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { encrypt, decrypt } from '../services/encryptionService';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const result = await pool.query('SELECT provider, created_at, updated_at FROM user_api_keys WHERE user_id=$1', [userId]);
    res.json({ keys: result.rows });
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
    
    const userCheck = await pool.query('SELECT id FROM users WHERE id=$1', [userId]);
    if (userCheck.rowCount === 0) {
      return res.status(401).json({ error: 'user not found' });
    }
    
    const { cipherText, iv } = encrypt(apiKey);
    await pool.query(
      `INSERT INTO user_api_keys(user_id, provider, encrypted_key, iv) VALUES($1,$2,$3,$4)
       ON CONFLICT (user_id, provider) DO UPDATE SET encrypted_key=$3, iv=$4, updated_at=now()`,
      [userId, provider, cipherText, iv]
    );
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error saving API key:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'user not found' });
    }
    res.status(500).json({ error: 'internal server error' });
  }
});

router.get('/:provider/temp', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const provider = req.params.provider;
    const result = await pool.query('SELECT encrypted_key, iv FROM user_api_keys WHERE user_id=$1 AND provider=$2', [userId, provider]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'key not found' });
    const key = decrypt(result.rows[0].encrypted_key, result.rows[0].iv);
    res.json({ apiKey: key });
  } catch (error: any) {
    console.error('Error fetching temporary API key:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

router.delete('/:provider', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const provider = req.params.provider;
    await pool.query('DELETE FROM user_api_keys WHERE user_id=$1 AND provider=$2', [userId, provider]);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Error deleting API key:', error);
    res.status(500).json({ error: 'internal server error' });
  }
});

export default router;


