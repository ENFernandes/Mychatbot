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
      reset_token TEXT,
      reset_token_expires TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now()
    );
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
      created_at TIMESTAMPTZ DEFAULT now()
    );
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


