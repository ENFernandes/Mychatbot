#!/usr/bin/env ts-node
/**
 * Backfill Script: Sync Stripe Subscriptions
 * 
 * This script fetches all active subscriptions from Stripe and syncs them
 * to the local database, ensuring that users who paid during trial are
 * properly upgraded to the PRO plan.
 * 
 * Usage:
 *   npx ts-node backend/scripts/backfill-stripe-subscriptions.ts
 * 
 * Environment:
 *   Requires STRIPE_SECRET_KEY and DATABASE_URL to be set
 */

import Stripe from 'stripe';
import { BillingProvider, PlanCode, Prisma, SubscriptionStatus } from '@prisma/client';
import { prisma } from '../src/config/database';
import { getStripe } from '../src/providers/stripeClient';
import {
  ensureDefaultPlans,
  ensureTrialSubscription,
  setSubscriptionStatus,
} from '../src/services/subscriptionService';

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

async function upsertStripeCustomer(
  customerId: string,
  email?: string | null
): Promise<{ id: string; userId: string } | null> {
  // Try to find existing customer
  const existing = await prisma.stripeCustomer.findUnique({
    where: { customerId },
    select: { id: true, userId: true },
  });

  if (existing) {
    return existing;
  }

  // Try to find user by email
  if (email) {
    const userByEmail = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true },
    });

    if (userByEmail) {
      console.log('[backfill] Found user by email:', email);
      
      await ensureDefaultPlans();
      
      const customer = await prisma.stripeCustomer.create({
        data: {
          userId: userByEmail.id,
          customerId,
          email: email ?? undefined,
        },
        select: { id: true, userId: true },
      });

      await ensureTrialSubscription(customer.userId);
      return customer;
    }
  }

  console.warn('[backfill] Could not find user for Stripe customer:', customerId);
  return null;
}

async function syncStripeSubscription(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customerId) {
    console.warn('[backfill] Subscription has no customer:', subscription.id);
    return;
  }

  // Fetch customer details from Stripe to get email
  const stripe = getStripe();
  let customerEmail: string | null = null;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && customer.email) {
      customerEmail = customer.email;
    }
  } catch (err) {
    console.error('[backfill] Failed to fetch customer:', customerId, err);
  }

  const stripeCustomer = await upsertStripeCustomer(customerId, customerEmail);

  if (!stripeCustomer) {
    console.warn('[backfill] Skipping subscription (no customer match):', subscription.id);
    return;
  }

  const status = STATUS_MAP[subscription.status] ?? SubscriptionStatus.PAUSED;
  const planCode = resolvePlanFromStatus(subscription.status);
  const trialEndsAt = toDate(subscription.trial_end);
  const currentPeriodStart = toDate(subscription.current_period_start);
  const currentPeriodEnd = toDate(subscription.current_period_end);
  const canceledAt = toDate(subscription.canceled_at ?? null);

  const userSubscription = await ensureTrialSubscription(stripeCustomer.userId);

  const rawData = toJsonPayload(subscription);

  await prisma.stripeSubscription.upsert({
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

  console.log('[backfill] Synced subscription:', subscription.id, '→', planCode, status);
}

async function main() {
  console.log('[backfill] Starting Stripe subscription backfill...');
  
  const stripe = getStripe();
  
  let hasMore = true;
  let startingAfter: string | undefined = undefined;
  let totalProcessed = 0;
  let totalSynced = 0;

  while (hasMore) {
    const params: Stripe.SubscriptionListParams = {
      limit: 100,
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    };

    const subscriptions = await stripe.subscriptions.list(params);

    for (const subscription of subscriptions.data) {
      totalProcessed++;
      try {
        await syncStripeSubscription(subscription);
        totalSynced++;
      } catch (err) {
        console.error('[backfill] Error syncing subscription:', subscription.id, err);
      }
    }

    hasMore = subscriptions.has_more;
    if (hasMore && subscriptions.data.length > 0) {
      startingAfter = subscriptions.data[subscriptions.data.length - 1].id;
    }
  }

  console.log('[backfill] Completed!');
  console.log(`[backfill] Total processed: ${totalProcessed}`);
  console.log(`[backfill] Total synced: ${totalSynced}`);
}

main()
  .catch((err) => {
    console.error('[backfill] Fatal error:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

