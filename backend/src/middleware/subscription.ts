import { Request, Response, NextFunction } from 'express';
import {
  getSubscriptionSummary,
  isSubscriptionActive,
  subscriptionToResponse,
} from '../services/subscriptionService';

export async function enforceActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: 'not authenticated' });
    }

    const summary = await getSubscriptionSummary(userId);

    if (!isSubscriptionActive(summary)) {
      const metadata = subscriptionToResponse(summary);
      return res.status(402).json({
        error: 'subscription_required',
        redirect: '/update-plan',
        metadata,
      });
    }

    (req as any).subscriptionState = subscriptionToResponse(summary);

    next();
  } catch (error: any) {
    console.error('Subscription enforcement error', error);
    const errorMessage = error?.message || 'internal server error';
    const errorStack = error?.stack;
    console.error('Error details:', { errorMessage, errorStack });
    res.status(500).json({ 
      error: 'internal server error',
      message: errorMessage 
    });
  }
}

