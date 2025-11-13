import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { ApiProvider } from '@prisma/client';
import modelsRouter from './routes/models';
import authRouter from './routes/auth';
import apiKeysRouter from './routes/apiKeys';
import conversationsRouter from './routes/conversations';
import billingRouter from './routes/billing';
import { stripeWebhookHandler } from './routes/stripeWebhook';
import { openaiChat } from './providers/openaiClient';
import { geminiChat } from './providers/geminiClient';
import { claudeChat } from './providers/claudeClient';
import { connectDatabase, disconnectDatabase, prisma } from './config/database';
import { decrypt, toBuffer } from './services/encryptionService';
import { requireAuth } from './middleware/auth';
import { enforceActiveSubscription } from './middleware/subscription';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());
app.use('/api/models', modelsRouter);
app.use('/api/auth', authRouter);
app.use('/api/user/keys', apiKeysRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api/billing', billingRouter);

function parseProvider(value: string | undefined): ApiProvider | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase() as keyof typeof ApiProvider;
  return ApiProvider[normalized] ?? null;
}

app.post('/api/chat', requireAuth, enforceActiveSubscription, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { message, messages, provider, model } = req.body as any;

    if (!message && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Message is required' });
    }
    const history = (messages && messages.length > 0) ? messages : [{ role: 'user', content: message }];

    // Convert provider string to ApiProvider enum
    const providerEnum = parseProvider(provider);
    if (!providerEnum) {
      return res.status(400).json({ error: 'invalid provider' });
    }

    const keyRecord = await prisma.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: providerEnum,
        },
      },
      select: {
        encryptedKey: true,
        iv: true,
      },
    });
    if (!keyRecord) {
      return res.status(400).json({ error: `API key ${provider} not configured` });
    }
    
    let decryptedKey: string;
    try {
      // Convert Prisma Bytes to Buffer using helper function
      const encryptedKeyBuffer = toBuffer(keyRecord.encryptedKey);
      const ivBuffer = toBuffer(keyRecord.iv);
      
      // Validate buffer sizes
      if (encryptedKeyBuffer.length < 16) {
        throw new Error(`Invalid encrypted key length: ${encryptedKeyBuffer.length}`);
      }
      if (ivBuffer.length !== 12) {
        throw new Error(`Invalid IV length: ${ivBuffer.length}, expected 12`);
      }
      
      decryptedKey = decrypt(encryptedKeyBuffer, ivBuffer);
    } catch (decryptError: any) {
      console.error('Failed to decrypt API key for user', userId, 'provider', provider, {
        error: decryptError.message,
        stack: decryptError.stack,
        encryptedKeyType: typeof keyRecord.encryptedKey,
        encryptedKeyLength: keyRecord.encryptedKey?.length,
        ivType: typeof keyRecord.iv,
        ivLength: keyRecord.iv?.length,
      });
      return res.status(401).json({
        error: 'invalid_api_key',
        message: `The stored API key for ${provider} is invalid. Please re-enter it.`,
      });
    }

    if (providerEnum === ApiProvider.OPENAI) {
      const result = await openaiChat({ apiKey: decryptedKey, model: model || 'gpt-5', messages: history });
      return res.json(result);
    }

    if (providerEnum === ApiProvider.GEMINI) {
      const result = await geminiChat({ apiKey: decryptedKey, model: model || 'gemini-2.5-flash', messages: history });
      return res.json(result);
    }

    if (providerEnum === ApiProvider.CLAUDE) {
      const result = await claudeChat({ apiKey: decryptedKey, model: model || 'claude-3-5-sonnet-latest', messages: history });
      return res.json(result);
    }

    return res.status(400).json({ error: 'invalid provider' });
  } catch (error: any) {
    console.error('Error processing chat:', error);

    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: error.message || 'Error communicating with OpenAI API',
      });
    }

    res.status(500).json({
      error: 'Internal server error',
    });
  }
});

app.get('/api/health', (req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

app.use((err: any, req: Request, res: Response, next: any) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'internal server error' });
});

process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error: Error) => {
  console.error('Uncaught Exception:', error);
});

async function start() {
  try {
    await connectDatabase();

    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

    const shutdown = async () => {
      console.log('Shutting down server...');
      await disconnectDatabase();
      server.close(() => process.exit(0));
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
  } catch (error) {
    console.error('Failed to start server', error);
    process.exit(1);
  }
}

void start();

