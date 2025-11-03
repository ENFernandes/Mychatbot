import { Router, Request, Response } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/auth';

const router = Router();
router.use(requireAuth);

router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const result = await pool.query(
    'SELECT id, title, created_at, updated_at FROM conversations WHERE user_id=$1 ORDER BY updated_at DESC',
    [userId]
  );
  res.json({ conversations: result.rows });
});

router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { title } = req.body as { title?: string };
  const result = await pool.query(
    'INSERT INTO conversations(user_id, title) VALUES($1,$2) RETURNING id, title, created_at, updated_at',
    [userId, title || 'New conversation']
  );
  res.json(result.rows[0]);
});

router.patch('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const { title } = req.body as { title: string };
  await pool.query('UPDATE conversations SET title=$1, updated_at=now() WHERE id=$2 AND user_id=$3', [title, id, userId]);
  res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  await pool.query('DELETE FROM conversations WHERE id=$1 AND user_id=$2', [id, userId]);
  res.json({ ok: true });
});

router.get('/:id/messages', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const conv = await pool.query('SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2', [id, userId]);
  if (conv.rowCount === 0) return res.status(404).json({ error: 'conversation not found' });
  const result = await pool.query(
    'SELECT id, role, content, created_at FROM messages WHERE conversation_id=$1 ORDER BY created_at',
    [id]
  );
  res.json({ messages: result.rows });
});

router.post('/:id/messages', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const { role, content } = req.body as { role: 'user' | 'assistant'; content: string };
  const conv = await pool.query('SELECT 1 FROM conversations WHERE id=$1 AND user_id=$2', [id, userId]);
  if (conv.rowCount === 0) return res.status(404).json({ error: 'conversation not found' });
  const result = await pool.query(
    'INSERT INTO messages(conversation_id, role, content) VALUES($1,$2,$3) RETURNING id, role, content, created_at',
    [id, role, content]
  );
  await pool.query('UPDATE conversations SET updated_at=now() WHERE id=$1', [id]);
  res.json(result.rows[0]);
});

export default router;


