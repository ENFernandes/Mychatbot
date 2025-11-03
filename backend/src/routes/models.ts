import { Router, Request, Response } from 'express';
import { openaiListModels } from '../providers/openaiClient';
import { geminiListModels } from '../providers/geminiClient';
import { claudeListModels } from '../providers/claudeClient';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const provider = (req.query.provider as string) || '';
    const apiKey = (req.headers['x-api-key'] as string) || (req.query.apiKey as string) || '';
    if (!provider) return res.status(400).json({ error: 'provider é obrigatório' });
    if (!apiKey) return res.status(400).json({ error: 'x-api-key é obrigatório' });

    let models: string[] = [];
    if (provider === 'openai') {
      models = await openaiListModels(apiKey);
    } else if (provider === 'gemini') {
      models = await geminiListModels(apiKey);
    } else if (provider === 'claude') {
      models = await claudeListModels(apiKey);
    } else {
      return res.status(400).json({ error: 'provider inválido' });
    }

    res.json({ models });
  } catch (err: any) {
    console.error('Erro ao listar modelos:', err);
    res.status(500).json({ error: err?.message || 'Erro ao listar modelos' });
  }
});

export default router;


