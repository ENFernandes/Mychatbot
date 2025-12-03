import { Router, Request, Response } from 'express';
import { ApiProvider } from '@prisma/client';
import { runWorkflow } from '../services/agentWorkflowService';
import { prisma } from '../config/database';
import { encrypt, decrypt, toBuffer } from '../services/encryptionService';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const router = Router();

// List all workflows for the user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;

    const workflows = await prisma.userWorkflow.findMany({
      where: { userId },
      select: {
        id: true,
        name: true,
        model: true,
        instructions: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ workflows });
  } catch (error: any) {
    console.error('Error listing workflows:', error);
    return res.status(500).json({ error: 'Failed to list workflows' });
  }
});

// Get a single workflow
router.get('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    const workflow = await prisma.userWorkflow.findFirst({
      where: { id, userId },
      select: {
        id: true,
        name: true,
        model: true,
        instructions: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    return res.json({ workflow });
  } catch (error: any) {
    console.error('Error getting workflow:', error);
    return res.status(500).json({ error: 'Failed to get workflow' });
  }
});

// Create a new workflow
router.post('/', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { name, workflowId, model, instructions, isDefault } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (!workflowId || typeof workflowId !== 'string' || !workflowId.trim()) {
      return res.status(400).json({ error: 'Workflow ID is required' });
    }

    // Encrypt the workflow ID
    const { cipherText, iv } = encrypt(workflowId.trim());

    // If this is set as default, unset other defaults
    if (isDefault) {
      await prisma.userWorkflow.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const workflow = await prisma.userWorkflow.create({
      data: {
        userId,
        name: name.trim(),
        encryptedWorkflowId: cipherText,
        iv,
        model: model || 'gpt-4o',
        instructions: instructions || null,
        isDefault: isDefault || false,
      },
      select: {
        id: true,
        name: true,
        model: true,
        instructions: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.status(201).json({ workflow });
  } catch (error: any) {
    console.error('Error creating workflow:', error);
    return res.status(500).json({ error: 'Failed to create workflow' });
  }
});

// Update a workflow
router.put('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;
    const { name, workflowId, model, instructions, isDefault } = req.body;

    // Check if workflow exists and belongs to user
    const existing = await prisma.userWorkflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    const updateData: any = {};

    if (name && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
    }

    if (workflowId && typeof workflowId === 'string' && workflowId.trim()) {
      const { cipherText, iv } = encrypt(workflowId.trim());
      updateData.encryptedWorkflowId = cipherText;
      updateData.iv = iv;
    }

    if (model) {
      updateData.model = model;
    }

    if (instructions !== undefined) {
      updateData.instructions = instructions || null;
    }

    if (isDefault !== undefined) {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await prisma.userWorkflow.updateMany({
          where: { userId, isDefault: true, id: { not: id } },
          data: { isDefault: false },
        });
      }
      updateData.isDefault = isDefault;
    }

    const workflow = await prisma.userWorkflow.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        model: true,
        instructions: true,
        isDefault: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ workflow });
  } catch (error: any) {
    console.error('Error updating workflow:', error);
    return res.status(500).json({ error: 'Failed to update workflow' });
  }
});

// Delete a workflow
router.delete('/:id', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { id } = req.params;

    // Check if workflow exists and belongs to user
    const existing = await prisma.userWorkflow.findFirst({
      where: { id, userId },
    });

    if (!existing) {
      return res.status(404).json({ error: 'Workflow not found' });
    }

    await prisma.userWorkflow.delete({
      where: { id },
    });

    return res.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting workflow:', error);
    return res.status(500).json({ error: 'Failed to delete workflow' });
  }
});

// Run a workflow
router.post('/run', requireAuth, enforceActiveSubscription, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { message, workflowId } = req.body;

    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Get user's OpenAI API key (required for Agent SDK)
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
        error: 'OpenAI API key not configured. Agent mode requires an OpenAI API key.' 
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
      console.error('Failed to decrypt OpenAI API key for workflow:', decryptError.message);
      return res.status(401).json({
        error: 'invalid_api_key',
        message: 'The stored OpenAI API key is invalid. Please re-enter it in Settings.',
      });
    }

    // Get workflow configuration if workflowId is provided
    let workflowConfig = {
      workflowId: 'wf_default',
      model: 'gpt-4o',
      instructions: 'You are a helpful AI assistant.',
    };

    if (workflowId) {
      const workflow = await prisma.userWorkflow.findFirst({
        where: { id: workflowId, userId },
      });

      if (workflow) {
        try {
          const encryptedBuffer = toBuffer(workflow.encryptedWorkflowId);
          const ivBuffer = toBuffer(workflow.iv);
          const decryptedWorkflowId = decrypt(encryptedBuffer, ivBuffer);
          
          workflowConfig = {
            workflowId: decryptedWorkflowId,
            model: workflow.model,
            instructions: workflow.instructions || 'You are a helpful AI assistant.',
          };
        } catch (err) {
          console.error('Failed to decrypt workflow ID:', err);
        }
      }
    }

    // Run the workflow
    const result = await runWorkflow({
      input_as_text: message.trim(),
      apiKey: decryptedApiKey,
      workflowId: workflowConfig.workflowId,
      model: workflowConfig.model,
      instructions: workflowConfig.instructions,
    });

    return res.json({
      message: result.output_text,
      provider: 'agent',
    });
  } catch (error: any) {
    console.error('Error running workflow:', error);
    return res.status(500).json({
      error: error.message || 'Failed to run agent workflow',
    });
  }
});

export default router;
