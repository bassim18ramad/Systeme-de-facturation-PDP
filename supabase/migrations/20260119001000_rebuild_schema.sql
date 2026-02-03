-- Full rebuild of schema and RLS policies (resets data)

-- Extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Drop policies (in case tables still exist)
DROP POLICY IF EXISTS "Users can view profiles" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Employers can view employees in their companies" ON public.user_profiles;

DROP POLICY IF EXISTS "Employers can view their companies" ON public.companies;
DROP POLICY IF EXISTS "Employers can insert companies" ON public.companies;
DROP POLICY IF EXISTS "Employers can update their companies" ON public.companies;
DROP POLICY IF EXISTS "Employees can view their company" ON public.companies;

DROP POLICY IF EXISTS "Users can view quotes from their company" ON public.quotes;
DROP POLICY IF EXISTS "Users can insert quotes for their company" ON public.quotes;
DROP POLICY IF EXISTS "Users can update quotes from their company" ON public.quotes;

DROP POLICY IF EXISTS "Users can view quote items from their company" ON public.quote_items;
DROP POLICY IF EXISTS "Users can insert quote items for their company" ON public.quote_items;
DROP POLICY IF EXISTS "Users can delete quote items from their company" ON public.quote_items;

DROP POLICY IF EXISTS "Users can view delivery orders from their company" ON public.delivery_orders;
DROP POLICY IF EXISTS "Users can insert delivery orders for their company" ON public.delivery_orders;
DROP POLICY IF EXISTS "Users can update delivery orders from their company" ON public.delivery_orders;

DROP POLICY IF EXISTS "Users can view invoices from their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can insert invoices for their company" ON public.invoices;
DROP POLICY IF EXISTS "Users can update invoices from their company" ON public.invoices;

DROP POLICY IF EXISTS "Users can view their download logs" ON public.download_logs;
DROP POLICY IF EXISTS "Users can insert download logs" ON public.download_logs;
DROP POLICY IF EXISTS "Employers can view all download logs for their companies" ON public.download_logs;

-- Drop trigger and functions
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.user_company_id();
DROP FUNCTION IF EXISTS public.is_employer_of_company(uuid);
DROP FUNCTION IF EXISTS public.can_view_user_profile(uuid);

-- Drop tables (order matters)
ALTER TABLE IF EXISTS public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_company_id_fkey;

ALTER TABLE IF EXISTS public.companies
  DROP CONSTRAINT IF EXISTS companies_employer_id_fkey;

DROP TABLE IF EXISTS public.download_logs;
DROP TABLE IF EXISTS public.invoices;
DROP TABLE IF EXISTS public.delivery_orders;
DROP TABLE IF EXISTS public.quote_items;
DROP TABLE IF EXISTS public.quotes;
DROP TABLE IF EXISTS public.companies;
DROP TABLE IF EXISTS public.user_profiles;

-- Recreate tables
CREATE TABLE public.user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('employee', 'employer')),
  company_id uuid,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  signature_url text,
  employer_id uuid REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.user_profiles
  DROP CONSTRAINT IF EXISTS user_profiles_company_id_fkey;

ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_company_id_fkey
  FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE SET NULL;

CREATE TABLE public.quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  client_address text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'ordered', 'cancelled')),
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE public.delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  quote_id uuid REFERENCES public.quotes(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
  delivery_date date,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  delivery_order_id uuid REFERENCES public.delivery_orders(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
  payment_date date,
  created_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE public.download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('quote', 'delivery_order', 'invoice')),
  document_id uuid NOT NULL,
  downloaded_by uuid REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  downloaded_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.download_logs ENABLE ROW LEVEL SECURITY;

-- Helper functions (non-recursive)
CREATE OR REPLACE FUNCTION public.user_company_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT company_id
  FROM public.user_profiles
  WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_employer_of_company(company_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = $1
      AND c.employer_id = auth.uid()
  );
$$;

-- user_profiles policies
CREATE POLICY "Users can view profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id OR public.is_employer_of_company(company_id));

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- companies policies
CREATE POLICY "Employers can view their companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (employer_id = auth.uid());

CREATE POLICY "Employees can view their company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (id = public.user_company_id());

CREATE POLICY "Employers can insert companies"
  ON public.companies FOR INSERT
  TO authenticated
  WITH CHECK (employer_id = auth.uid());

CREATE POLICY "Employers can update their companies"
  ON public.companies FOR UPDATE
  TO authenticated
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());

-- quotes policies
CREATE POLICY "Users can view quotes from their company"
  ON public.quotes FOR SELECT
  TO authenticated
  USING (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

CREATE POLICY "Users can insert quotes for their company"
  ON public.quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

CREATE POLICY "Users can update quotes from their company"
  ON public.quotes FOR UPDATE
  TO authenticated
  USING (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  )
  WITH CHECK (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

-- quote_items policies
CREATE POLICY "Users can view quote items from their company"
  ON public.quote_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = quote_items.quote_id
        AND (public.is_employer_of_company(q.company_id) OR q.company_id = public.user_company_id())
    )
  );

CREATE POLICY "Users can insert quote items for their company"
  ON public.quote_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = quote_id
        AND (public.is_employer_of_company(q.company_id) OR q.company_id = public.user_company_id())
    )
  );

CREATE POLICY "Users can delete quote items from their company"
  ON public.quote_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quotes q
      WHERE q.id = quote_items.quote_id
        AND (public.is_employer_of_company(q.company_id) OR q.company_id = public.user_company_id())
    )
  );

-- delivery_orders policies
CREATE POLICY "Users can view delivery orders from their company"
  ON public.delivery_orders FOR SELECT
  TO authenticated
  USING (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

CREATE POLICY "Users can insert delivery orders for their company"
  ON public.delivery_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

CREATE POLICY "Users can update delivery orders from their company"
  ON public.delivery_orders FOR UPDATE
  TO authenticated
  USING (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  )
  WITH CHECK (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

-- invoices policies
CREATE POLICY "Users can view invoices from their company"
  ON public.invoices FOR SELECT
  TO authenticated
  USING (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

CREATE POLICY "Users can insert invoices for their company"
  ON public.invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

CREATE POLICY "Users can update invoices from their company"
  ON public.invoices FOR UPDATE
  TO authenticated
  USING (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  )
  WITH CHECK (
    public.is_employer_of_company(company_id)
    OR company_id = public.user_company_id()
  );

-- download_logs policies (simple + safe)
CREATE POLICY "Users can view their download logs"
  ON public.download_logs FOR SELECT
  TO authenticated
  USING (downloaded_by = auth.uid());

CREATE POLICY "Users can insert download logs"
  ON public.download_logs FOR INSERT
  TO authenticated
  WITH CHECK (downloaded_by = auth.uid());

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON public.user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON public.quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON public.quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON public.quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_quote_id ON public.delivery_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_company_id ON public.delivery_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_delivery_order_id ON public.invoices(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON public.invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_document_id ON public.download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_by ON public.download_logs(downloaded_by);

-- Profile creation trigger
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, company_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Utilisateur'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'employee'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
