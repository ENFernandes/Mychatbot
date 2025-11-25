import { Router, Request, Response } from 'express';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { sendSupportEmail } from '../services/emailService';

const router = Router();

router.use(requireAuth);

// Rate limiting: simple in-memory store (for production, use Redis)
const requestCounts = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS_PER_WINDOW = 5;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const userLimit = requestCounts.get(userId);

  if (!userLimit || now > userLimit.resetAt) {
    requestCounts.set(userId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (userLimit.count >= MAX_REQUESTS_PER_WINDOW) {
    return false;
  }

  userLimit.count++;
  return true;
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).userId as string;
    const { subject, category, message } = req.body as {
      subject: string;
      category: string;
      message: string;
    };

    // Validation
    if (!subject || !subject.trim()) {
      return res.status(400).json({ error: 'Subject is required' });
    }
    if (!category || !category.trim()) {
      return res.status(400).json({ error: 'Category is required' });
    }
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Rate limiting
    if (!checkRateLimit(userId)) {
      return res.status(429).json({ 
        error: 'Too many support requests. Please try again later.' 
      });
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, name: true },
    });

    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Create support request in database
    const supportRequest = await prisma.supportRequest.create({
      data: {
        userId,
        subject: subject.trim(),
        category: category.trim(),
        message: message.trim(),
        status: 'OPEN',
      },
    });

    // Send email notification
    try {
      await sendSupportEmail({
        requestId: supportRequest.id,
        userEmail: user.email,
        userName: user.name || 'User',
        subject: supportRequest.subject,
        category: supportRequest.category,
        message: supportRequest.message,
      });
    } catch (emailError) {
      console.error('[support] Failed to send email notification:', emailError);
      // Don't fail the request if email fails
    }

    res.json({
      ok: true,
      requestId: supportRequest.id,
      message: 'Support request submitted successfully',
    });
  } catch (error: any) {
    console.error('[support] Error creating support request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;

