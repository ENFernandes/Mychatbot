import { Router, Request, Response } from 'express';
import { openaiListModels } from '../providers/openaiClient';
import { geminiListModels } from '../providers/geminiClient';
import { claudeListModels } from '../providers/claudeClient';
import { ApiProvider } from '@prisma/client';
import { prisma } from '../config/database';
import { decrypt, toBuffer } from '../services/encryptionService';
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

function providerToName(provider: ApiProvider) {
  switch (provider) {
    case ApiProvider.OPENAI:
      return 'OpenAI';
    case ApiProvider.GEMINI:
      return 'Gemini';
    case ApiProvider.CLAUDE:
      return 'Claude';
    default:
      return 'unknown provider';
  }
}

function isAuthError(error: any) {
  if (!error) return false;
  const status = error.status ?? error.statusCode;
  if (typeof status === 'number' && [401, 403].includes(status)) {
    return true;
  }
  const message = (typeof error.message === 'string' ? error.message : '') + ' ' + (typeof error.code === 'string' ? error.code : '');
  return /unauthorized|invalid api key|permission|key is not valid|api.?key.*required|x-api-key.*required/i.test(message);
}

router.get('/', async (req: Request, res: Response) => {
  console.log('GET /api/models called with provider:', req.query.provider);
  try {
    const providerQuery = req.query.provider as string | undefined;
    const providerEnum = parseProvider(providerQuery);
    if (!providerEnum) return res.status(400).json({ error: 'provider is required' });

    const userId = (req as any).userId as string;
    
    if (!userId) {
      console.error('No userId found in request');
      return res.status(401).json({ 
        error: 'not_authenticated',
        message: 'User not authenticated' 
      });
    }
    
    console.log('Fetching API key for user:', userId, 'provider:', providerEnum);
    
    // Fetch API key from database
    let keyRecord;
    try {
      keyRecord = await prisma.userApiKey.findUnique({
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
    } catch (dbError: any) {
      console.error('Database error fetching API key:', {
        error: dbError.message,
        stack: dbError.stack,
        userId,
        provider: providerEnum,
        errorName: dbError.name,
        errorCode: dbError.code,
      });
      return res.status(500).json({ 
        error: 'database_error',
        message: 'Failed to fetch API key from database. Please try again later.' 
      });
    }

    // Require API key to be configured
    if (!keyRecord) {
      return res.status(404).json({ 
        error: 'api_key_not_configured',
        message: `API key for ${providerToName(providerEnum)} is not configured. Please add it in Settings.` 
      });
    }

    // Decrypt API key
    let apiKey: string;
    try {
      const encryptedKeyBuffer = toBuffer(keyRecord.encryptedKey);
      const ivBuffer = toBuffer(keyRecord.iv);
      
      // Validate buffer sizes
      if (encryptedKeyBuffer.length < 16) {
        throw new Error(`Invalid encrypted key length: ${encryptedKeyBuffer.length}`);
      }
      if (ivBuffer.length !== 12) {
        throw new Error(`Invalid IV length: ${ivBuffer.length}, expected 12`);
      }
      
      apiKey = decrypt(encryptedKeyBuffer, ivBuffer);
    } catch (decryptError: any) {
      console.error('Failed to decrypt API key for user', userId, 'provider', providerToName(providerEnum), {
        error: decryptError.message,
        stack: decryptError.stack,
        encryptedKeyType: typeof keyRecord.encryptedKey,
        encryptedKeyConstructor: keyRecord.encryptedKey?.constructor?.name,
        encryptedKeyLength: keyRecord.encryptedKey?.length,
        encryptedKeyBufferLength: encryptedKeyBuffer.length,
        encryptedKeyIsBuffer: Buffer.isBuffer(keyRecord.encryptedKey),
        encryptedKeyIsUint8Array: keyRecord.encryptedKey instanceof Uint8Array,
        ivType: typeof keyRecord.iv,
        ivConstructor: keyRecord.iv?.constructor?.name,
        ivLength: keyRecord.iv?.length,
        ivBufferLength: ivBuffer.length,
        ivIsBuffer: Buffer.isBuffer(keyRecord.iv),
        ivIsUint8Array: keyRecord.iv instanceof Uint8Array,
        note: 'This usually means the encryption key changed or the data was corrupted. Please re-enter the API key in Settings.',
      });
      return res.status(401).json({ 
        error: 'invalid_api_key',
        message: `The stored API key for ${providerToName(providerEnum)} is invalid. Please re-enter it in Settings.` 
      });
    }

    // Fetch models from provider API
    let models: string[] = [];
    try {
      if (providerEnum === ApiProvider.OPENAI) {
        models = await openaiListModels(apiKey);
      } else if (providerEnum === ApiProvider.GEMINI) {
        models = await geminiListModels(apiKey);
      } else if (providerEnum === ApiProvider.CLAUDE) {
        models = await claudeListModels(apiKey);
      } else {
        return res.status(400).json({ error: 'invalid provider' });
      }

      // Ensure we have models
      if (!models || models.length === 0) {
        return res.status(503).json({ 
          error: 'no_models_available',
          message: `No models available from ${providerToName(providerEnum)}. Please check your API key.` 
        });
      }

      return res.json({ models });
    } catch (providerError: any) {
      // Check if it's an authentication error
      if (isAuthError(providerError)) {
        console.warn(`Authentication error fetching models from ${providerToName(providerEnum)}:`, {
          message: providerError?.message,
          status: providerError?.status || providerError?.statusCode,
        });
        return res.status(401).json({ 
          error: 'invalid_api_key',
          message: `Invalid API key for ${providerToName(providerEnum)}. Please update it in Settings.` 
        });
      }

      // Other API errors
      console.error(`Error fetching models from ${providerToName(providerEnum)} API:`, {
        message: providerError?.message,
        status: providerError?.status || providerError?.statusCode,
        stack: providerError?.stack,
      });
      return res.status(503).json({ 
        error: 'provider_api_error',
        message: `Failed to fetch models from ${providerToName(providerEnum)}. Please try again later.` 
      });
    }
  } catch (err: any) {
    console.error('Error listing models:', err);
    return res.status(500).json({ error: err?.message || 'Error listing models' });
  }
});

export default router;


