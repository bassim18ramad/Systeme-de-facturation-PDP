-- Setup script to mock Supabase environment in a standard PostgreSQL database

-- Create roles (Simulation of Supabase roles)
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN;
  END IF;
END
$$;

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;

-- Create schemas
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Mock auth.users table
CREATE TABLE IF NOT EXISTS auth.users (
    id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
    email text UNIQUE,
    encrypted_password text,
    raw_user_meta_data jsonb,
    raw_app_meta_data jsonb,
    aud text,
    role text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Mock auth.uid() function for RLS policies
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
  -- In a real Supabase env, this comes from JWT. 
  -- In this local mock, we might need to set it via SET LOCAL or just return null if not using RLS strictly
  SELECT NULL::uuid; 
$$ LANGUAGE sql STABLE;

-- Storage tables (Simplified)
CREATE TABLE IF NOT EXISTS storage.buckets (
    id text PRIMARY KEY,
    name text NOT NULL,
    public boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS storage.objects (
    id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
    bucket_id text REFERENCES storage.buckets(id),
    name text,
    owner uuid REFERENCES auth.users(id),
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    last_accessed_at timestamptz DEFAULT now(),
    metadata jsonb
);

-- Insert default buckets if needed
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true) ON CONFLICT DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT DO NOTHING;
