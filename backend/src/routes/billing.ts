import { Router } from 'express';
import { pool } from '../config/database';
import { requireAuth } from '../middleware/auth';
import { getStripe } from '../providers/stripeClient';

const router = Router();

router.use(requireAuth);

const STRIPE_PRICE_ID = process.env.STRIPE_PRICE_ID;
const STRIPE_SUCCESS_URL = process.env.STRIPE_SUCCESS_URL;
const STRIPE_CANCEL_URL = process.env.STRIPE_CANCEL_URL;
const STRIPE_PORTAL_RETURN_URL = process.env.STRIPE_PORTAL_RETURN_URL || STRIPE_SUCCESS_URL;

router.post('/checkout', async (req, res) => {
  try {
    if (!STRIPE_PRICE_ID || !STRIPE_SUCCESS_URL || !STRIPE_CANCEL_URL) {
      return res.status(500).json({ error: 'Stripe configuration missing on server' });
    }

    const userId = (req as any).userId as string;
    const stripe = getStripe();

    const userResult = await pool.query(
      `SELECT id, email, plan, stripe_customer_id, subscription_status
       FROM users WHERE id=$1`,
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0] as {
      id: string;
      email: string;
      plan: 'trial' | 'pro';
      stripe_customer_id: string | null;
      subscription_status: string | null;
    };

    if (user.plan === 'pro' && user.subscription_status && user.subscription_status !== 'canceled') {
      return res.status(400).json({ error: 'User already has an active subscription' });
    }

    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: {
          userId,
        },
      });
      customerId = customer.id;
      await pool.query('UPDATE users SET stripe_customer_id=$1, updated_at=now() WHERE id=$2', [customerId, userId]);
    }

    const metadata = { userId };

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
        trial_period_days: 2,
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

    const userResult = await pool.query(
      'SELECT stripe_customer_id FROM users WHERE id=$1',
      [userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const { stripe_customer_id: customerId } = userResult.rows[0] as { stripe_customer_id: string | null };
    if (!customerId) {
      return res.status(400).json({ error: 'No Stripe customer associated with user' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: STRIPE_PORTAL_RETURN_URL,
    });

    return res.json({ url: session.url });
  } catch (error: any) {
    console.error('Error creating Stripe portal session', error);
    return res.status(500).json({ error: 'Unable to create portal session' });
  }
});

export default router;



