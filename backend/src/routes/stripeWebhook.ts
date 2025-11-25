import { Request, Response } from 'express';
import Stripe from 'stripe';
import { BillingProvider, PlanCode, Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { getStripe } from '../providers/stripeClient';
import {
  ensureDefaultPlans,
  ensureTrialSubscription,
  setSubscriptionStatus,
} from '../services/subscriptionService';

const STATUS_PLAN_DOWNGRADE = new Set<Stripe.Subscription.Status>(['canceled', 'incomplete_expired', 'unpaid']);

const STATUS_MAP: Record<Stripe.Subscription.Status, SubscriptionStatus> = {
  trialing: SubscriptionStatus.TRIALING,
  active: SubscriptionStatus.ACTIVE,
  past_due: SubscriptionStatus.PAST_DUE,
  canceled: SubscriptionStatus.CANCELED,
  incomplete: SubscriptionStatus.INCOMPLETE,
  incomplete_expired: SubscriptionStatus.INCOMPLETE_EXPIRED,
  unpaid: SubscriptionStatus.UNPAID,
  paused: SubscriptionStatus.PAUSED,
};

function toDate(timestamp: number | null | undefined) {
  return typeof timestamp === 'number' ? new Date(timestamp * 1000) : null;
}

function resolvePlanFromStatus(status: Stripe.Subscription.Status): PlanCode {
  return STATUS_PLAN_DOWNGRADE.has(status) ? PlanCode.TRIAL : PlanCode.PRO;
}

function toJsonPayload(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value));
}

async function recordSubscriptionEvent(stripeSubscriptionId: string, type: string, payload: unknown) {
  const subscription = await prisma.stripeSubscription.findUnique({
    where: { subscriptionId: stripeSubscriptionId },
    select: { id: true },
  });

  if (!subscription) return;

  await prisma.subscriptionEvent.create({
    data: {
      stripeSubscriptionId: subscription.id,
      type,
      payload: toJsonPayload(payload),
    },
  });
}

async function upsertStripeCustomer(
  customerId: string,
  userId: string | undefined,
  email?: string | null
): Promise<{ id: string; userId: string } | null> {
  // If no userId provided, try to find existing customer or lookup by email
  if (!userId) {
    const existing = await prisma.stripeCustomer.findUnique({
      where: { customerId },
      select: { id: true, userId: true },
    });
    
    if (existing) {
      return existing;
    }

    // Fallback: try to find user by email if email is provided
    if (email) {
      const userByEmail = await prisma.user.findUnique({
        where: { email: email.trim().toLowerCase() },
        select: { id: true },
      });
      
      if (userByEmail) {
        console.log('[webhook] Found user by email fallback:', email);
        userId = userByEmail.id;
        // Continue to create the customer record below
      } else {
        console.warn('[webhook] No userId in metadata and no user found by email:', email);
        return null;
      }
    } else {
      console.warn('[webhook] No userId in metadata and no email provided');
      return null;
    }
  }

  await ensureDefaultPlans();

  const customer = await prisma.stripeCustomer.upsert({
    where: { customerId },
    update: {
      email: email ?? undefined,
    },
    create: {
      userId,
      customerId,
      email: email ?? undefined,
    },
    select: { id: true, userId: true },
  });

  await ensureTrialSubscription(customer.userId);

  return customer;
}

export async function upsertStripeSubscriptionRecord(subscription: Stripe.Subscription, eventType: string) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) return;

  const userId = (subscription.metadata?.userId as string | undefined) || undefined;
  const stripeCustomer = await upsertStripeCustomer(customerId, userId);

  if (!stripeCustomer) return;

  const status = STATUS_MAP[subscription.status] ?? SubscriptionStatus.PAUSED;
  const planCode = resolvePlanFromStatus(subscription.status);
  const trialEndsAt = toDate(subscription.trial_end);
  const currentPeriodStart = toDate(subscription.current_period_start);
  const currentPeriodEnd = toDate(subscription.current_period_end);
  const canceledAt = toDate(subscription.canceled_at ?? null);

  const userSubscription = await ensureTrialSubscription(stripeCustomer.userId);

  const rawData = toJsonPayload(subscription);

  const record = await prisma.stripeSubscription.upsert({
    where: { subscriptionId: subscription.id },
    update: {
      stripeCustomerId: stripeCustomer.id,
      planCode,
      status,
      currentPeriodStart: currentPeriodStart ?? undefined,
      currentPeriodEnd: currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: canceledAt ?? undefined,
      rawData,
      userSubscriptionId: userSubscription.id,
    },
    create: {
      stripeCustomerId: stripeCustomer.id,
      subscriptionId: subscription.id,
      planCode,
      status,
      currentPeriodStart: currentPeriodStart ?? undefined,
      currentPeriodEnd: currentPeriodEnd ?? undefined,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      canceledAt: canceledAt ?? undefined,
      rawData,
      userSubscriptionId: userSubscription.id,
    },
  });

  await setSubscriptionStatus(stripeCustomer.userId, status, {
    planCode,
    provider: BillingProvider.STRIPE,
    trialEndsAt,
    currentPeriodEnd,
    cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
  });

  await recordSubscriptionEvent(subscription.id, eventType, subscription);

  return record;
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session, eventType: string) {
  const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
  const subscriptionId = typeof session.subscription === 'string' ? session.subscription : session.subscription?.id;
  const userId = session.metadata?.userId ?? undefined;

  if (!customerId || !subscriptionId) {
    return;
  }

  // Ignore unpaid or incomplete sessions
  if (session.payment_status !== 'paid') {
    console.log('[webhook] Ignoring checkout session with payment_status:', session.payment_status);
    return;
  }

  const customer = await upsertStripeCustomer(customerId, userId, session.customer_details?.email);

  if (!customer) return;

  // Fetch the full subscription from Stripe to get complete status
  const stripe = getStripe();
  let subscription: Stripe.Subscription;
  try {
    subscription = await stripe.subscriptions.retrieve(subscriptionId);
  } catch (err: any) {
    console.error('[webhook] Failed to retrieve subscription', subscriptionId, err);
    return;
  }

  // Use the existing upsertStripeSubscriptionRecord to properly sync the subscription
  // This will update user_subscriptions with the correct plan_code and status
  await upsertStripeSubscriptionRecord(subscription, eventType);

  // Record the checkout session event as well
  await recordSubscriptionEvent(subscriptionId, eventType, session);
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
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session, event.type);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        await upsertStripeSubscriptionRecord(event.data.object as Stripe.Subscription, event.type);
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


