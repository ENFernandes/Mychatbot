-- Fix missing enums in database
DO $$
BEGIN
  -- Create api_provider enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_provider') THEN
    CREATE TYPE api_provider AS ENUM ('openai', 'gemini', 'claude');
  END IF;

  -- Create message_role enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE message_role AS ENUM ('user', 'assistant');
  END IF;

  -- Create billing_provider enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
    CREATE TYPE billing_provider AS ENUM ('stripe', 'internal');
  END IF;

  -- Create subscription_status enum if it doesn't exist
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

  -- Create plan_code enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_code') THEN
    CREATE TYPE plan_code AS ENUM ('free', 'trial', 'pro', 'enterprise');
  END IF;
END $$;





