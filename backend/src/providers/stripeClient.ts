import Stripe from 'stripe';

const API_VERSION: Stripe.LatestApiVersion = '2023-10-16';

let stripeClient: Stripe | null = null;

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY is not configured');
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, { apiVersion: API_VERSION });
  }

  return stripeClient;
}



