import { Request, Response } from 'express';
import Stripe from 'stripe';
import { pool } from '../config/database';
import { getStripe } from '../providers/stripeClient';

function toIso(timestamp: number | null | undefined) {
  return timestamp ? new Date(timestamp * 1000).toISOString() : null;
}

function resolvePlanFromStatus(status: Stripe.Subscription.Status) {
  const downgradeStatuses: Stripe.Subscription.Status[] = ['canceled', 'incomplete_expired', 'unpaid'];
  return downgradeStatuses.includes(status) ? 'trial' : 'pro';
}

async function updateUserSubscription(options: {
  userId?: string | null;
  customerId?: string | Stripe.Customer | null;
  subscriptionId?: string | null;
  plan?: 'trial' | 'pro';
  status?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEnd?: string | null;
}) {
  const { userId, customerId, subscriptionId, plan, status, trialEndsAt, currentPeriodEnd } = options;
  const params = [plan, subscriptionId, status, trialEndsAt, currentPeriodEnd];

  if (userId) {
    await pool.query(
      `UPDATE users
       SET plan = COALESCE($1, plan),
           stripe_subscription_id = COALESCE($2, stripe_subscription_id),
           subscription_status = COALESCE($3, subscription_status),
           trial_ends_at = COALESCE($4, trial_ends_at),
           current_period_end = COALESCE($5, current_period_end),
           stripe_customer_id = COALESCE($6, stripe_customer_id),
           updated_at = now()
       WHERE id = $7`,
      [...params, customerId ?? null, userId]
    );
    return;
  }

  if (subscriptionId) {
    await pool.query(
      `UPDATE users
       SET plan = COALESCE($1, plan),
           stripe_subscription_id = COALESCE($2, stripe_subscription_id),
           subscription_status = COALESCE($3, subscription_status),
           trial_ends_at = COALESCE($4, trial_ends_at),
           current_period_end = COALESCE($5, current_period_end),
           stripe_customer_id = COALESCE($6, stripe_customer_id),
           updated_at = now()
       WHERE stripe_subscription_id = $2`,
      [...params, customerId ?? null]
    );
    return;
  }

  if (customerId) {
    await pool.query(
      `UPDATE users
       SET plan = COALESCE($1, plan),
           subscription_status = COALESCE($3, subscription_status),
           trial_ends_at = COALESCE($4, trial_ends_at),
           current_period_end = COALESCE($5, current_period_end),
           stripe_subscription_id = COALESCE($2, stripe_subscription_id),
           stripe_customer_id = COALESCE($6, stripe_customer_id),
           updated_at = now()
       WHERE stripe_customer_id = $6`,
      [...params, customerId ?? null]
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const userId = session.metadata?.userId ?? undefined;

  if (!customerId) {
    return;
  }

  await updateUserSubscription({
    userId,
    customerId,
    subscriptionId,
  });
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const subscriptionId = subscription.id;
  const status = subscription.status;
  const userId = subscription.metadata?.userId ?? undefined;
  const plan = resolvePlanFromStatus(status);
  const trialEndsAt = toIso(subscription.trial_end);
  const currentPeriodEnd = toIso(subscription.current_period_end);

  await updateUserSubscription({
    userId,
    customerId,
    subscriptionId,
    plan,
    status,
    trialEndsAt,
    currentPeriodEnd,
  });
}

export async function stripeWebhookHandler(req: Request, res: Response) {
  const signature = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error('Missing STRIPE_WEBHOOK_SECRET');
    return res.status(500).send('Webhook misconfigured');
  }

  if (!signature) {
    return res.status(400).send('Missing Stripe signature header');
  }

  const stripe = getStripe();

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(req.body, signature, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature validation failed', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;
      default:
        break;
    }

    res.json({ received: true });
  } catch (err) {
    console.error('Stripe webhook handler error', err);
    res.status(500).send('Webhook handler error');
  }
}


