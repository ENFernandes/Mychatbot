-- Normalize subscription data structures and prepare Prisma-managed schema

BEGIN;

-- 1. Enumerations ------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
    CREATE TYPE billing_provider AS ENUM ('stripe', 'internal');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'subscription_status') THEN
    CREATE TYPE subscription_status AS ENUM (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'incomplete',
      'incomplete_expired',
      'unpaid',
      'paused'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_code') THEN
    CREATE TYPE plan_code AS ENUM ('free', 'trial', 'pro', 'enterprise');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_provider') THEN
    CREATE TYPE api_provider AS ENUM ('openai', 'gemini', 'claude');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE message_role AS ENUM ('user', 'assistant');
  END IF;
END $$;


-- 1.1 Existing column conversions -------------------------------------------

ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_provider_check;
ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;

-- messages.role -> message_role enum
ALTER TABLE messages
  ALTER COLUMN role TYPE message_role USING LOWER(role)::message_role;

-- messages.provider -> api_provider enum
ALTER TABLE messages
  ALTER COLUMN provider TYPE api_provider USING (
    CASE
      WHEN provider IS NULL THEN NULL
      ELSE LOWER(provider)::api_provider
    END
  );

-- user_api_keys.provider -> api_provider enum
ALTER TABLE user_api_keys
  ALTER COLUMN provider TYPE api_provider USING LOWER(provider)::api_provider;


-- 2. Core tables -------------------------------------------------------------

CREATE TABLE IF NOT EXISTS plans (
  code plan_code PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER,
  currency TEXT DEFAULT 'usd',
  interval TEXT DEFAULT 'month',
  trial_period_days INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  plan_code plan_code NOT NULL REFERENCES plans(code),
  status subscription_status NOT NULL DEFAULT 'trialing',
  provider billing_provider NOT NULL DEFAULT 'stripe',
  trial_ends_at TIMESTAMPTZ,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL UNIQUE,
  email TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stripe_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_customer_id UUID NOT NULL REFERENCES stripe_customers(id) ON DELETE CASCADE,
  subscription_id TEXT NOT NULL UNIQUE,
  plan_code plan_code,
  status subscription_status NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT false,
  canceled_at TIMESTAMPTZ,
  raw_data JSONB,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_subscription_id UUID UNIQUE REFERENCES user_subscriptions(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stripe_subscriptions_customer
  ON stripe_subscriptions(stripe_customer_id);

CREATE TABLE IF NOT EXISTS subscription_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_subscription_id UUID NOT NULL REFERENCES stripe_subscriptions(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);


-- 3. Seed base plans --------------------------------------------------------

INSERT INTO plans (code, name, description, price_cents, currency, interval, trial_period_days)
VALUES
  ('free', 'Free', 'Default free tier', 0, 'usd', 'month', 0),
  ('trial', 'Trial', 'Trial plan for new users', 0, 'usd', 'month', 14),
  ('pro', 'Pro', 'Pro subscription billed monthly', 500, 'usd', 'month', 2)
ON CONFLICT (code) DO NOTHING;


-- 4. Migrate legacy subscription data --------------------------------------

WITH upserted AS (
  INSERT INTO user_subscriptions (
    user_id,
    plan_code,
    status,
    provider,
    trial_ends_at,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    created_at,
    updated_at
  )
  SELECT
    u.id,
    COALESCE(NULLIF(u.plan, '')::plan_code, 'trial') AS plan_code,
    CASE
      WHEN u.subscription_status IS NULL OR u.subscription_status = '' THEN
        CASE WHEN COALESCE(u.plan, 'trial') = 'pro' THEN 'active'::subscription_status ELSE 'trialing'::subscription_status END
      ELSE u.subscription_status::subscription_status
    END AS status,
    CASE
      WHEN u.stripe_customer_id IS NOT NULL THEN 'stripe'::billing_provider
      ELSE 'internal'::billing_provider
    END AS provider,
    u.trial_ends_at,
    u.current_period_end - INTERVAL '30 days', -- best effort estimate
    u.current_period_end,
    false,
    u.created_at,
    u.updated_at
  FROM users u
  WHERE NOT EXISTS (
    SELECT 1 FROM user_subscriptions us WHERE us.user_id = u.id
  )
  RETURNING id, user_id
)
SELECT 1;

-- Stripe customers
WITH inserted_customers AS (
  INSERT INTO stripe_customers (user_id, customer_id, email, created_at, updated_at)
  SELECT
    u.id,
    u.stripe_customer_id,
    u.email,
    u.created_at,
    u.updated_at
  FROM users u
  WHERE u.stripe_customer_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM stripe_customers sc WHERE sc.customer_id = u.stripe_customer_id
    )
  RETURNING id, user_id
)
SELECT 1;

-- Stripe subscriptions
WITH inserted_subscriptions AS (
  INSERT INTO stripe_subscriptions (
    stripe_customer_id,
    subscription_id,
    plan_code,
    status,
    current_period_start,
    current_period_end,
    cancel_at_period_end,
    user_subscription_id,
    created_at,
    updated_at
  )
  SELECT
    sc.id,
    u.stripe_subscription_id,
    COALESCE(NULLIF(u.plan, '')::plan_code, NULL),
    COALESCE(NULLIF(u.subscription_status, '')::subscription_status, 'active'),
    u.current_period_end - INTERVAL '30 days',
    u.current_period_end,
    false,
    us.id,
    u.created_at,
    u.updated_at
  FROM users u
  INNER JOIN stripe_customers sc ON sc.user_id = u.id
  INNER JOIN user_subscriptions us ON us.user_id = u.id
  WHERE u.stripe_subscription_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM stripe_subscriptions ss WHERE ss.subscription_id = u.stripe_subscription_id
    )
  RETURNING id
)
SELECT 1;


-- 5. Cleanup legacy columns -------------------------------------------------

ALTER TABLE users
  DROP COLUMN IF EXISTS plan,
  DROP COLUMN IF EXISTS stripe_customer_id,
  DROP COLUMN IF EXISTS stripe_subscription_id,
  DROP COLUMN IF EXISTS subscription_status,
  DROP COLUMN IF EXISTS trial_ends_at,
  DROP COLUMN IF EXISTS current_period_end;


COMMIT;

