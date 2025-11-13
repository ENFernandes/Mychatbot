-- Create enums with names that Prisma expects (case-sensitive with quotes)
DO $$
BEGIN
  -- Create ApiProvider enum (Prisma expects this exact name)
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ApiProvider') THEN
    CREATE TYPE "ApiProvider" AS ENUM ('OPENAI', 'GEMINI', 'CLAUDE');
  END IF;

  -- Create MessageRole enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MessageRole') THEN
    CREATE TYPE "MessageRole" AS ENUM ('USER', 'ASSISTANT');
  END IF;

  -- Create BillingProvider enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BillingProvider') THEN
    CREATE TYPE "BillingProvider" AS ENUM ('STRIPE', 'INTERNAL');
  END IF;

  -- Create SubscriptionStatus enum
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

  -- Create PlanCode enum
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PlanCode') THEN
    CREATE TYPE "PlanCode" AS ENUM ('FREE', 'TRIAL', 'PRO', 'ENTERPRISE');
  END IF;
END $$;

