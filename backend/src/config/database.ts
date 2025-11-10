import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgres://chatbot:chatbot@localhost:5432/chatbot';

export const pool = new Pool({ connectionString });

export async function initializeSchema() {
  // Enable pgcrypto for gen_random_uuid
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT,
      email_verified BOOLEAN NOT NULL DEFAULT false,
      verification_token TEXT,
      verification_token_expires TIMESTAMPTZ,
      plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','pro')),
      stripe_customer_id TEXT,
      stripe_subscription_id TEXT,
      subscription_status TEXT,
      trial_ends_at TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'plan'
      ) THEN
        ALTER TABLE users
        ADD COLUMN plan TEXT NOT NULL DEFAULT 'trial' CHECK (plan IN ('trial','pro'));
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'stripe_customer_id'
      ) THEN
        ALTER TABLE users ADD COLUMN stripe_customer_id TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'stripe_subscription_id'
      ) THEN
        ALTER TABLE users ADD COLUMN stripe_subscription_id TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'email_verified'
      ) THEN
        ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT false;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'verification_token'
      ) THEN
        ALTER TABLE users ADD COLUMN verification_token TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'verification_token_expires'
      ) THEN
        ALTER TABLE users ADD COLUMN verification_token_expires TIMESTAMPTZ;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'subscription_status'
      ) THEN
        ALTER TABLE users ADD COLUMN subscription_status TEXT;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'trial_ends_at'
      ) THEN
        ALTER TABLE users ADD COLUMN trial_ends_at TIMESTAMPTZ;
      END IF;

      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'current_period_end'
      ) THEN
        ALTER TABLE users ADD COLUMN current_period_end TIMESTAMPTZ;
      END IF;
    END
    $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS conversations (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL DEFAULT 'New conversation',
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant')),
      content TEXT NOT NULL,
      provider TEXT CHECK (provider IN ('openai','gemini','claude')),
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `);

  // Add provider column if it doesn't exist (migration for existing databases)
  await pool.query(`
    DO $$ 
    BEGIN 
      IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='messages' AND column_name='provider'
      ) THEN
        ALTER TABLE messages ADD COLUMN provider TEXT CHECK (provider IN ('openai','gemini','claude'));
      END IF;
    END $$;
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_api_keys (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL CHECK (provider IN ('openai','gemini','claude')),
      encrypted_key BYTEA NOT NULL,
      iv BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, provider)
    );
  `);
}


