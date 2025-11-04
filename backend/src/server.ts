import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import modelsRouter from './routes/models';
import authRouter from './routes/auth';
import apiKeysRouter from './routes/apiKeys';
import conversationsRouter from './routes/conversations';
import { openaiChat } from './providers/openaiClient';
import { geminiChat } from './providers/geminiClient';
import { claudeChat } from './providers/claudeClient';
import { initializeSchema, pool } from './config/database';
import { decrypt } from './services/encryptionService';
import { requireAuth } from './middleware/auth';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use('/api/models', modelsRouter);
app.use('/api/auth', authRouter);
app.use('/api/user/keys', apiKeysRouter);
app.use('/api/conversations', conversationsRouter);

app.post('/api/chat', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { message, messages, provider, model } = req.body as any;

    if (!message && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Mensagem é obrigatória' });
    }
    const history = (messages && messages.length > 0) ? messages : [{ role: 'user', content: message }];

    // Buscar key encriptada do user
    const keyResult = await pool.query(
      'SELECT encrypted_key, iv FROM user_api_keys WHERE user_id=$1 AND provider=$2',
      [userId, provider]
    );
    if (keyResult.rowCount === 0) {
      return res.status(400).json({ error: `API key ${provider} não configurada` });
    }
    const { encrypted_key, iv } = keyResult.rows[0];
    const decryptedKey = decrypt(encrypted_key, iv);

    if (provider === 'openai') {
      const result = await openaiChat({ apiKey: decryptedKey, model: model || 'gpt-5', messages: history });
      return res.json(result);
    }

    if (provider === 'gemini') {
      const result = await geminiChat({ apiKey: decryptedKey, model: model || 'gemini-2.5-flash', messages: history });
      return res.json(result);
    }

    if (provider === 'claude') {
      const result = await claudeChat({ apiKey: decryptedKey, model: model || 'claude-3-5-sonnet-latest', messages: history });
      return res.json(result);
    }

    return res.status(400).json({ error: 'provider inválido' });
  } catch (error: any) {
    console.error('Erro ao processar chat:', error);

    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: error.message || 'Erro ao comunicar com a API OpenAI',
      });
    }

    res.status(500).json({
      error: 'Erro interno do servidor',
    });
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Erro não tratado:', err);
  res.status(500).json({ error: 'erro interno do servidor' });
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection em:', promise, 'razão:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});

async function initializeSchemaWithRetry(maxAttempts = 20, delayMs = 1000) {
  let attempt = 0;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    attempt += 1;
    try {
      await initializeSchema();
      console.log('Base de dados preparada');
      break;
    } catch (err) {
      if (attempt >= maxAttempts) {
        console.error('Erro ao inicializar BD após várias tentativas', err);
        break;
      }
      console.warn(`BD indisponível (tentativa ${attempt}/${maxAttempts}). A tentar novamente em ${delayMs}ms...`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

initializeSchemaWithRetry();

