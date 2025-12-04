import { Router, Request, Response } from 'express';
import { ApiProvider } from '@prisma/client';
import OpenAI from 'openai';
import { prisma } from '../config/database';
import { decrypt, toBuffer } from '../services/encryptionService';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const router = Router();

// Create a ChatKit session
router.post('/session', requireAuth, enforceActiveSubscription, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { workflowId } = req.body;

    if (!workflowId || typeof workflowId !== 'string' || !workflowId.trim()) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    // Get user's OpenAI API key (required for ChatKit)
    const keyRecord = await prisma.userApiKey.findUnique({
      where: {
        userId_provider: {
          userId,
          provider: ApiProvider.OPENAI,
        },
      },
      select: {
        encryptedKey: true,
        iv: true,
      },
    });

    if (!keyRecord) {
      return res.status(400).json({ 
        error: 'OpenAI API key not configured. ChatKit requires an OpenAI API key.' 
      });
    }

    let decryptedApiKey: string;
    try {
      const encryptedKeyBuffer = toBuffer(keyRecord.encryptedKey);
      const ivBuffer = toBuffer(keyRecord.iv);

      if (encryptedKeyBuffer.length < 16) {
        throw new Error(`Invalid encrypted key length: ${encryptedKeyBuffer.length}`);
      }
      if (ivBuffer.length !== 12) {
        throw new Error(`Invalid IV length: ${ivBuffer.length}, expected 12`);
      }

      decryptedApiKey = decrypt(encryptedKeyBuffer, ivBuffer);
    } catch (decryptError: any) {
      console.error('Failed to decrypt OpenAI API key for ChatKit:', decryptError.message);
      return res.status(401).json({
        error: 'invalid_api_key',
        message: 'The stored OpenAI API key is invalid. Please re-enter it in Settings.',
      });
    }

    // Get user information for ChatKit session
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Decrypt workflow ID if it's from user workflows
    let finalWorkflowId = workflowId.trim();
    
    // Check if workflowId is a user workflow ID (UUID format)
    // If it is, we need to decrypt the actual workflow ID
    const userWorkflow = await prisma.userWorkflow.findFirst({
      where: { 
        id: workflowId,
        userId 
      },
      select: {
        encryptedWorkflowId: true,
        iv: true,
      },
    });

    if (userWorkflow) {
      try {
        const encryptedBuffer = toBuffer(userWorkflow.encryptedWorkflowId);
        const ivBuffer = toBuffer(userWorkflow.iv);
        finalWorkflowId = decrypt(encryptedBuffer, ivBuffer);
      } catch (err) {
        console.error('Failed to decrypt workflow ID:', err);
        return res.status(400).json({ error: 'Invalid workflow ID' });
      }
    }

    // Create ChatKit session using REST API
    // The ChatKit API endpoint for creating sessions
    const response = await fetch('https://api.openai.com/v1/chatkit/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${decryptedApiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'chatkit_beta=v1',
      },
      body: JSON.stringify({
        user: user.id,
        workflow: { id: finalWorkflowId }
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(errorData.error?.message || errorData.error || `HTTP ${response.status}`);
    }

    const session = await response.json();
    return res.json({ client_secret: session.client_secret });
  } catch (error: any) {
    console.error('Error creating ChatKit session:', error);
    
    if (error instanceof OpenAI.APIError) {
      return res.status(error.status || 500).json({
        error: error.message || 'Error creating ChatKit session',
      });
    }

    return res.status(500).json({
      error: error.message || 'Failed to create ChatKit session',
    });
  }
});

export default router;

