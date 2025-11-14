-- Convert TEXT columns to use enums if they're still TEXT
DO $$
BEGIN
  -- Convert user_api_keys.provider to api_provider enum
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_api_keys' 
    AND column_name = 'provider' 
    AND data_type = 'text'
  ) THEN
    -- Drop constraint if exists
    ALTER TABLE user_api_keys DROP CONSTRAINT IF EXISTS user_api_keys_provider_check;
    
    -- Convert to enum
    ALTER TABLE user_api_keys
      ALTER COLUMN provider TYPE api_provider USING LOWER(provider)::api_provider;
  END IF;

  -- Convert messages.role to message_role enum
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'role' 
    AND data_type = 'text'
  ) THEN
    -- Drop constraint if exists
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_role_check;
    
    -- Convert to enum
    ALTER TABLE messages
      ALTER COLUMN role TYPE message_role USING LOWER(role)::message_role;
  END IF;

  -- Convert messages.provider to api_provider enum (nullable)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'messages' 
    AND column_name = 'provider' 
    AND data_type = 'text'
  ) THEN
    -- Drop constraint if exists
    ALTER TABLE messages DROP CONSTRAINT IF EXISTS messages_provider_check;
    
    -- Convert to enum (nullable)
    ALTER TABLE messages
      ALTER COLUMN provider TYPE api_provider USING (
        CASE
          WHEN provider IS NULL THEN NULL
          ELSE LOWER(provider)::api_provider
        END
      );
  END IF;
END $$;





