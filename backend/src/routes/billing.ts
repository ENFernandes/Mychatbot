import { Router } from 'express';
import { PlanCode } from '@prisma/client';
import { prisma } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { getStripe } from '../providers/stripeClient';
import {
  ensureDefaultPlans,
  ensureTrialSubscription,
  getSubscriptionSummary,
  isSubscriptionActive,
} from '../services/subscriptionService';

const router = Router();

router.use(requireAuth);

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL;
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL;
const STRIPE_PORTAL_RETURN_URL = process.env.STRIPE_PORTAL_RETURN_URL || STRIPE_SUCCESS_URL;
const TRIAL_DURATION_HOURS = Number(process.env.TRIAL_DURATION_HOURS || '4');

router.post('/checkout', async (req, res) => {
  try {
    if (!STRIPE_PRICE_ID || !STRIPE_SUCCESS_URL || !STRIPE_CANCEL_URL) {
      return res.status(500).json({ error: 'Stripe configuration missing on server' });
    }

    const userId = (req as any).userId as string;
    const stripe = getStripe();

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        stripeCustomer: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    await ensureDefaultPlans();
    await ensureTrialSubscription(userId);
    const summary = await getSubscriptionSummary(userId);

    if (summary.planCode === PlanCode.PRO && isSubscriptionActive(summary)) {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    let customerId = user.stripeCustomer?.customerId;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId,
        },
      });
      customerId = customer.id;
      await prisma.stripeCustomer.create({
        data: {
          userId,
          customerId,
          email: user.email,
        },
      });
    }

    const metadata = { userId };

    const trialExtensionHours = !Number.isNaN(TRIAL_DURATION_HOURS) && TRIAL_DURATION_HOURS > 0 ? TRIAL_DURATION_HOURS : 0;
    const trialEndTimestamp =
      trialExtensionHours > 0 ? Math.floor((Date.now() + trialExtensionHours * 60 * 60 * 1000) / 1000) : undefined;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [
        {
          price: STRIPE_PRICE_ID,
          quantity: 1,
        },
      ],
      allow_promotion_codes: true,
      success_url: STRIPE_SUCCESS_URL,
      cancel_url: STRIPE_CANCEL_URL,
      metadata,
      subscription_data: {
        ...(trialEndTimestamp ? { trial_end: trialEndTimestamp } : {}),
        metadata,
      },
    });

    return res.json({ url: session.url, id: session.id });
  } catch (error: any) {
    console.error('Error creating Stripe checkout session', error);
    return res.status(500).json({ error: 'Unable to create checkout session' });
  }
});

router.post('/portal', async (req, res) => {
  try {
    if (!STRIPE_PORTAL_RETURN_URL) {
      return res.status(500).json({ error: 'Stripe portal return URL missing on server' });
    }

    const userId = (req as any).userId as string;
    const stripe = getStripe();

    const customer = await prisma.stripeCustomer.findUnique({
      where: { userId },
      select: { customerId: true },
    });

    if (!customer) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!customer.customerId) {
      return res.status(400).json({ error: 'No Stripe customer associated with user' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customer.customerId,
      return_url: STRIPE_PORTAL_RETURN_URL,
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating Stripe portal session', error);
    return res.status(500).json({ error: 'Unable to create portal session' });
  }
});

router.post('/cancel', async (req, res) => {
  try {
    const userId = (req as any).userId as string;
    const stripe = getStripe();

    // Find user's Stripe customer
    const customer = await prisma.stripeCustomer.findUnique({
      where: { userId },
      select: { customerId: true },
    });

    if (!customer || !customer.customerId) {
      return res.status(404).json({ error: 'No Stripe subscription found for this user' });
    }

    // Find active subscription in Stripe
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.customerId,
      status: 'active',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      return res.status(404).json({ error: 'No active subscription found' });
    }

    const subscription = subscriptions.data[0];

    // Cancel the subscription at period end (recommended) or immediately
    // Using cancel_at_period_end: true to allow user to continue until period ends
    const canceledSubscription = await stripe.subscriptions.update(subscription.id, {
      cancel_at_period_end: true,
    });

    // The webhook will handle updating the database when Stripe processes the cancellation
    return res.json({ 
      message: 'Subscription will be canceled at the end of the current billing period',
      cancelAtPeriodEnd: canceledSubscription.cancel_at_period_end,
      currentPeriodEnd: new Date(canceledSubscription.current_period_end * 1000).toISOString(),
    });
  } catch (error: any) {
    console.error('Error canceling Stripe subscription', error);
    return res.status(500).json({ error: 'Unable to cancel subscription' });
  }
});

export default router;



