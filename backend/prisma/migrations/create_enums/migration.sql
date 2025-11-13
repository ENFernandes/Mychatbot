-- Fix missing enums in database
DO $$
BEGIN
  -- Create ApiProvider enum if it doesn't exist (matching Prisma's expected name)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApiProvider') THEN
    CREATE TYPE "ApiProvider" AS ENUM ('OPENAI', 'GEMINI', 'CLAUDE');
  END IF;

  -- Create api_provider enum if it doesn't exist (for compatibility)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'api_provider') THEN
    CREATE TYPE api_provider AS ENUM ('openai', 'gemini', 'claude');
  END IF;

  -- Create MessageRole enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageRole') THEN
    CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');
  END IF;

  -- Create message_role enum if it doesn't exist (for compatibility)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'message_role') THEN
    CREATE TYPE message_role AS ENUM ('user', 'assistant');
  END IF;

  -- Create BillingProvider enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingProvider') THEN
    CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'INTERNAL');
  END IF;

  -- Create billing_provider enum if it doesn't exist (for compatibility)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
    CREATE TYPE billing_provider AS ENUM ('stripe', 'internal');
  END IF;

  -- Create SubscriptionStatus enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SubscriptionStatus') THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM (
      'TRIALING',
      'ACTIVE',
      'PAST_DUE',
      'CANCELED',
      'INCOMPLETE',
      'INCOMPLETE_EXPIRED',
      'UNPAID',
      'PAUSED'
    );
  END IF;

  -- Create subscription_status enum if it doesn't exist (for compatibility)
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

  -- Create PlanCode enum if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanCode') THEN
    CREATE TYPE "PlanCode" AS ENUM ('FREE', 'TRIAL', 'PRO', 'ENTERPRISE');
  END IF;

  -- Create plan_code enum if it doesn't exist (for compatibility)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'plan_code') THEN
    CREATE TYPE plan_code AS ENUM ('free', 'trial', 'pro', 'enterprise');
  END IF;
END $$;

