import { Request, Response, NextFunction } from 'express';
import { pool } from '../config/database';

type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'incomplete'
  | 'incomplete_expired'
  | 'canceled'
  | 'unpaid'
  | null
  | string;

const ALLOWED_PRO_STATUSES = new Set<SubscriptionStatus>(['active', 'trialing']);
const BLOCKED_PRO_STATUSES = new Set<SubscriptionStatus>(['past_due', 'incomplete', 'incomplete_expired', 'canceled', 'unpaid']);

function coerceIso(value: any): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export async function enforceActiveSubscription(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId as string | undefined;
    if (!userId) {
      return res.status(401).json({ error: 'not authenticated' });
    }

    const result = await pool.query(
      'SELECT plan, subscription_status, trial_ends_at FROM users WHERE id=$1',
      [userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'user not found' });
    }

    const row = result.rows[0] as {
      plan: 'trial' | 'pro';
      subscription_status: SubscriptionStatus;
      trial_ends_at: Date | string | null;
    };

    const now = Date.now();
    const trialEndsAtDate = row.trial_ends_at ? new Date(row.trial_ends_at) : null;
    const trialEndsAtIso = coerceIso(row.trial_ends_at);

    let isActive = false;

    if (row.plan === 'trial') {
      if (!trialEndsAtDate) {
        isActive = true;
      } else {
        isActive = trialEndsAtDate.getTime() > now;
      }
    } else if (row.plan === 'pro') {
      if (!row.subscription_status) {
        isActive = false;
      } else if (ALLOWED_PRO_STATUSES.has(row.subscription_status)) {
        isActive = true;
      } else if (BLOCKED_PRO_STATUSES.has(row.subscription_status)) {
        isActive = false;
      } else {
        // Unknown status, default to blocking to be safe.
        isActive = false;
      }
    }

    if (!isActive) {
      return res.status(402).json({
        error: 'subscription_required',
        redirect: '/update-plan',
        metadata: {
          plan: row.plan,
          subscriptionStatus: row.subscription_status,
          trialEndsAt: trialEndsAtIso,
        },
      });
    }

    (req as any).subscriptionState = {
      plan: row.plan,
      subscriptionStatus: row.subscription_status,
      trialEndsAt: trialEndsAtIso,
    };

    next();
  } catch (error) {
    console.error('Subscription enforcement error', error);
    res.status(500).json({ error: 'internal server error' });
  }
}

