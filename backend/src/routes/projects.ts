import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const router = Router();
router.use(requireAuth);
router.use(enforceActiveSubscription);

// List all projects for the user
router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  
  const projects = await prisma.project.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { conversations: true }
      }
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      description: project.description,
      conversation_count: project._count.conversations,
      created_at: project.createdAt,
      updated_at: project.updatedAt,
    })),
  });
});

// Create a new project
router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { name, description } = req.body as { name: string; description?: string };

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Project name is required' });
  }

  const project = await prisma.project.create({
    data: {
      userId,
      name: name.trim(),
      description: description?.trim() || null,
    },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({
    id: project.id,
    name: project.name,
    description: project.description,
    conversation_count: 0,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  });
});

// Get a single project
router.get('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: {
      id: true,
      name: true,
      description: true,
      createdAt: true,
      updatedAt: true,
      _count: {
        select: { conversations: true }
      }
    },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({
    id: project.id,
    name: project.name,
    description: project.description,
    conversation_count: project._count.conversations,
    created_at: project.createdAt,
    updated_at: project.updatedAt,
  });
});

// Update a project
router.patch('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const { name, description } = req.body as { name?: string; description?: string };

  const data: { name?: string; description?: string | null } = {};

  if (name !== undefined) {
    if (!name.trim()) {
      return res.status(400).json({ error: 'Project name cannot be empty' });
    }
    data.name = name.trim();
  }

  if (description !== undefined) {
    data.description = description?.trim() || null;
  }

  const result = await prisma.project.updateMany({
    where: { id, userId },
    data,
  });

  if (result.count === 0) {
    return res.status(404).json({ error: 'Project not found' });
  }

  res.json({ ok: true });
});

// Delete a project
router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  // First, check if project exists and belongs to user
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: {
      id: true,
      _count: {
        select: { conversations: true }
      }
    },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  // Remove project reference from conversations (set to null)
  await prisma.conversation.updateMany({
    where: { projectId: id },
    data: { projectId: null },
  });

  // Delete the project
  await prisma.project.delete({
    where: { id },
  });

  res.json({ ok: true });
});

// List conversations in a project
router.get('/:id/conversations', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  // Check if project exists and belongs to user
  const project = await prisma.project.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!project) {
    return res.status(404).json({ error: 'Project not found' });
  }

  const conversations = await prisma.conversation.findMany({
    where: { projectId: id, userId },
    select: {
      id: true,
      title: true,
      pinned: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({
    conversations: conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      pinned: conv.pinned,
      project_id: id,
      created_at: conv.createdAt,
      updated_at: conv.updatedAt,
    })),
  });
});

export default router;


