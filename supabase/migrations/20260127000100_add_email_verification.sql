ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS confirmation_token text;
ALTER TABLE auth.users ADD COLUMN IF NOT EXISTS email_confirmed_at timestamptz;
