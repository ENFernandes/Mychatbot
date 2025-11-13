import { Router, Request, Response } from 'express';
import { ApiProvider, MessageRole } from '@prisma/client';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { enforceActiveSubscription } from '../middleware/subscription';

const router = Router();
router.use(requireAuth);
router.use(enforceActiveSubscription);

router.get('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const conversations = await prisma.conversation.findMany({
    where: { userId },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
  });

  res.json({
    conversations: conversations.map((conv) => ({
      id: conv.id,
      title: conv.title,
      created_at: conv.createdAt,
      updated_at: conv.updatedAt,
    })),
  });
});

router.post('/', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { title } = req.body as { title?: string };

  const conversation = await prisma.conversation.create({
    data: {
      userId,
      title: title?.trim() || 'New conversation',
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  res.json({
    id: conversation.id,
    title: conversation.title,
    created_at: conversation.createdAt,
    updated_at: conversation.updatedAt,
  });
});

router.patch('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const { title } = req.body as { title: string };

  await prisma.conversation.updateMany({
    where: { id, userId },
    data: { title: title?.trim() || 'New conversation' },
  });

  res.json({ ok: true });
});

router.delete('/:id', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  await prisma.conversation.deleteMany({
    where: { id, userId },
  });

  res.json({ ok: true });
});

router.get('/:id/messages', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!conversation) return res.status(404).json({ error: 'conversation not found' });

  const messages = await prisma.message.findMany({
    where: { conversationId: id },
    select: {
      id: true,
      role: true,
      content: true,
      provider: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  res.json({
    messages: messages.map((message) => ({
      id: message.id,
      role: toResponseRole(message.role),
      content: message.content,
      provider: toResponseProvider(message.provider),
      created_at: message.createdAt,
    })),
  });
});

function parseMessageRole(value: string): MessageRole | null {
  const normalized = value?.trim().toUpperCase() as keyof typeof MessageRole;
  return MessageRole[normalized] ?? null;
}

function parseProvider(value: string | undefined): ApiProvider | null {
  if (!value) return null;
  const normalized = value.trim().toUpperCase() as keyof typeof ApiProvider;
  return ApiProvider[normalized] ?? null;
}

function toResponseRole(value: MessageRole) {
  return value.toLowerCase();
}

function toResponseProvider(value: ApiProvider | null | undefined) {
  return value ? value.toLowerCase() : null;
}

router.post('/:id/messages', async (req: Request, res: Response) => {
  const userId = (req as any).userId as string;
  const { id } = req.params;
  const { role, content, provider } = req.body as { role: 'user' | 'assistant'; content: string; provider?: 'openai' | 'gemini' | 'claude' };

  const conversation = await prisma.conversation.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!conversation) return res.status(404).json({ error: 'conversation not found' });

  const roleEnum = parseMessageRole(role);
  if (!roleEnum) return res.status(400).json({ error: 'invalid role' });

  const providerEnum = parseProvider(provider);

  const message = await prisma.message.create({
    data: {
      conversationId: id,
      role: roleEnum,
      content,
      provider: providerEnum ?? null,
    },
    select: {
      id: true,
      role: true,
      content: true,
      provider: true,
      createdAt: true,
    },
  });

  await prisma.conversation.update({
    where: { id },
    data: { updatedAt: new Date() },
  });

  res.json({
    id: message.id,
    role: toResponseRole(message.role),
    content: message.content,
    provider: toResponseProvider(message.provider),
    created_at: message.createdAt,
  });
});

export default router;


