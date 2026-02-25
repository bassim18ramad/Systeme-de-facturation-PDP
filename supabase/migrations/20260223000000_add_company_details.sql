
-- Add new columns to companies table
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS wallets jsonb DEFAULT '[]'::jsonb;
