import express, { Request, Response } from 'express';
import cors from 'cors';
import OpenAI from 'openai';
import { ApiProvider } from '@prisma/client';
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
import { openaiChat, FileContent as OpenAIFileContent } from './providers/openaiClient';
import { geminiChat, FileContent as GeminiFileContent } from './providers/geminiClient';
import { claudeChat, FileContent as ClaudeFileContent } from './providers/claudeClient';
import { getStoredFile, removeStoredFile, isFileSupportedByProvider } from './services/fileService';
import { connectDatabase, disconnectDatabase, prisma, checkDatabaseConnection } from './config/database';
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
app.use('/api/projects', projectsRouter);
app.use('/api/billing', billingRouter);
app.use('/api/support', supportRouter);
app.use('/api/workflows', workflowsRouter);
app.use('/api/chatkit', chatkitRouter);
app.use('/api/files', filesRouter);

function parseProvider(value: string | undefined): ApiProvider | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase() as keyof typeof ApiProvider;
  return ApiProvider[normalized] ?? null;
}

app.post('/api/chat', requireAuth, enforceActiveSubscription, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { message, messages, provider, model, fileIds, conversationId } = req.body as any;

    if (!message && (!messages || messages.length === 0)) {
      return res.status(400).json({ error: 'Message is required' });
    }
    let history = (messages && messages.length > 0) ? messages : [{ role: 'user', content: message }];

    // If conversationId is provided, check if it belongs to a project and load context
    if (conversationId) {
      const conversation = await prisma.conversation.findFirst({
        where: { id: conversationId, userId },
        select: { projectId: true },
      });

      if (conversation?.projectId) {
        // Load messages from all other conversations in the same project
        const projectConversations = await prisma.conversation.findMany({
          where: {
            projectId: conversation.projectId,
            userId,
            id: { not: conversationId }, // Exclude current conversation
          },
          select: {
            id: true,
            title: true,
            createdAt: true,
            messages: {
              select: {
                role: true,
                content: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' }, // Older conversations first
        });

        // Build context from project conversations
        const projectContext: Array<{ role: string; content: string }> = [];
        
        for (const conv of projectConversations) {
          if (conv.messages.length > 0) {
            // Add a system message to separate conversations
            projectContext.push({
              role: 'system',
              content: `--- Context from conversation "${conv.title}" ---`,
            });
            
            // Add messages from this conversation
            for (const msg of conv.messages) {
              projectContext.push({
                role: msg.role.toLowerCase(),
                content: msg.content,
              });
            }
          }
        }

        // Prepend project context to the current conversation history
        if (projectContext.length > 0) {
          projectContext.unshift({
            role: 'system',
            content: 'The following is context from other conversations in the same project. Use this context to provide better, more informed responses.',
          });
          history = [...projectContext, ...history];
        }
      }
    }

    // Process file IDs if provided
    const files: Array<{ buffer: Buffer; filename: string; mimeType: string }> = [];
    if (fileIds && Array.isArray(fileIds) && fileIds.length > 0) {
      for (const fileId of fileIds) {
        const storedFile = getStoredFile(fileId);
        if (!storedFile) {
          return res.status(400).json({ error: `File not found: ${fileId}` });
        }
        files.push({
          buffer: storedFile.buffer,
          filename: storedFile.filename,
          mimeType: storedFile.mimeType,
        });
      }
    }

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

    // Validate files are supported by the provider
    if (files.length > 0) {
      const providerName = providerEnum.toLowerCase() as 'openai' | 'gemini' | 'claude';
      for (const file of files) {
        if (!isFileSupportedByProvider(file.mimeType, providerName)) {
          return res.status(400).json({
            error: `File type ${file.mimeType} is not supported by ${provider}`,
          });
        }
      }
    }

    if (providerEnum === ApiProvider.OPENAI) {
      const result = await openaiChat({
        apiKey: decryptedKey,
        model: model || 'gpt-5',
        messages: history,
        files: files.length > 0 ? files : undefined,
      });
      // Clean up stored files after successful processing
      if (fileIds) {
        for (const fileId of fileIds) {
          removeStoredFile(fileId);
        }
      }
      return res.json(result);
    }

    if (providerEnum === ApiProvider.GEMINI) {
      const result = await geminiChat({
        apiKey: decryptedKey,
        model: model || 'gemini-2.5-flash',
        messages: history,
        files: files.length > 0 ? files : undefined,
      });
      // Clean up stored files after successful processing
      if (fileIds) {
        for (const fileId of fileIds) {
          removeStoredFile(fileId);
        }
      }
      return res.json(result);
    }

    if (providerEnum === ApiProvider.CLAUDE) {
      const result = await claudeChat({
        apiKey: decryptedKey,
        model: model || 'claude-3-5-sonnet-latest',
        messages: history,
        files: files.length > 0 ? files : undefined,
      });
      // Clean up stored files after successful processing
      if (fileIds) {
        for (const fileId of fileIds) {
          removeStoredFile(fileId);
        }
      }
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

app.get('/api/health', async (req: Request, res: Response) => {
  try {
    // Check database connection
    const dbConnected = await checkDatabaseConnection();
    if (!dbConnected) {
      return res.status(503).json({ 
        status: 'unhealthy', 
        database: 'disconnected' 
      });
    }
    res.json({ status: 'ok', database: 'connected' });
  } catch (error: any) {
    res.status(503).json({ 
      status: 'unhealthy', 
      error: error.message 
    });
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

