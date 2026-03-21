import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import modelsRouter from './routes/models';
import authRouter from './routes/auth';
import apiKeysRouter from './routes/apiKeys';
import conversationsRouter from './routes/conversations';
import projectsRouter from './routes/projects';
import billingRouter from './routes/billing';
import supportRouter from './routes/support';
import workflowsRouter from './routes/workflows';
import chatkitRouter from './routes/chatkit';
import filesRouter from './routes/files';
import { stripeWebhookHandler } from './routes/stripeWebhook';
import { chat, chatStream, parseProvider } from './services/chatService';
import { connectDatabase, disconnectDatabase, checkDatabaseConnection } from './config/database';
import { requireAuth } from './middleware/auth';
import { enforceActiveSubscription } from './middleware/subscription';
import { authLimiter, chatLimiter, apiLimiter } from './middleware/rateLimiter';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());

app.post('/api/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

app.use(express.json());
app.use('/api/models', apiLimiter, modelsRouter);
app.use('/api/auth', authLimiter, authRouter);
app.use('/api/user/keys', apiLimiter, apiKeysRouter);
app.use('/api/conversations', apiLimiter, conversationsRouter);
app.use('/api/projects', apiLimiter, projectsRouter);
app.use('/api/billing', apiLimiter, billingRouter);
app.use('/api/support', apiLimiter, supportRouter);
app.use('/api/workflows', apiLimiter, workflowsRouter);
app.use('/api/chatkit', apiLimiter, chatkitRouter);
app.use('/api/files', apiLimiter, filesRouter);

app.post('/api/chat', chatLimiter, requireAuth, enforceActiveSubscription, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { message, messages, provider, model, fileIds, conversationId, stream } = req.body as any;

    if (!message && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Message is required' });
    }

    const providerEnum = parseProvider(provider);
    if (!providerEnum) {
      return res.status(400).json({ error: 'Invalid provider' });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();

      await chatStream(
        { userId, message, messages, provider: providerEnum, model, fileIds, conversationId },
        {
          onChunk: (text) => {
            res.write(`data: ${JSON.stringify({ type: 'chunk', text })}\n\n`);
          },
          onComplete: (fullText) => {
            res.write(`data: ${JSON.stringify({ type: 'complete', message: fullText })}\n\n`);
            res.end();
          },
          onError: (error) => {
            console.error('Stream error:', error);
            res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
            res.end();
          },
        }
      );
    } else {
      const result = await chat({
        userId,
        message,
        messages,
        provider: providerEnum,
        model,
        fileIds,
        conversationId,
      });
      return res.json(result);
    }
  } catch (error: any) {
    console.error('Error processing chat:', error);

    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: error.message || 'Error communicating with OpenAI API',
      });
    }

    if (error.message?.includes('API key') || error.message?.includes('File not found')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Internal server error' });
  }
});

app.get('/', async (req: Request, res: Response) => {
  try {
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
    res.json({ status: 'ok', database: 'connected' });
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
});

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({ status: 'unhealthy', database: 'disconnected' });
    }
    res.json({ status: 'ok', database: 'connected' });
  } catch (error: any) {
    res.status(503).json({ status: 'unhealthy', error: error.message });
  }
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

