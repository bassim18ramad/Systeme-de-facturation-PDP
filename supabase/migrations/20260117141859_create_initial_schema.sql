/*
  # Plateforme de Gestion de Devis, Commandes et Factures

  ## Description
  Système de gestion multi-entreprises permettant de gérer le cycle complet:
  Devis → Commande de livraison → Facture

  ## Nouvelles Tables

  1. **user_profiles**
     - `id` (uuid, primary key, references auth.users)
     - `email` (text)
     - `full_name` (text)
     - `role` (text) - 'employee' ou 'employer'
     - `company_id` (uuid, nullable for employers)
     - `created_at` (timestamptz)

  2. **companies**
     - `id` (uuid, primary key)
     - `name` (text)
     - `logo_url` (text, nullable)
     - `signature_url` (text, nullable)
     - `employer_id` (uuid, references user_profiles)
     - `created_at` (timestamptz)

  3. **quotes**
     - `id` (uuid, primary key)
     - `quote_number` (text, unique)
     - `company_id` (uuid, references companies)
     - `client_name` (text)
     - `client_email` (text)
     - `client_phone` (text, nullable)
     - `client_address` (text, nullable)
     - `status` (text) - 'draft', 'sent', 'ordered', 'cancelled'
     - `total_amount` (numeric)
     - `notes` (text, nullable)
     - `created_by` (uuid, references user_profiles)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  4. **quote_items**
     - `id` (uuid, primary key)
     - `quote_id` (uuid, references quotes)
     - `description` (text)
     - `quantity` (numeric)
     - `unit_price` (numeric)
     - `total_price` (numeric)
     - `created_at` (timestamptz)

  5. **delivery_orders**
     - `id` (uuid, primary key)
     - `order_number` (text, unique)
     - `quote_id` (uuid, references quotes)
     - `company_id` (uuid, references companies)
     - `status` (text) - 'pending', 'delivered', 'cancelled'
     - `delivery_date` (date, nullable)
     - `created_by` (uuid, references user_profiles)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  6. **invoices**
     - `id` (uuid, primary key)
     - `invoice_number` (text, unique)
     - `delivery_order_id` (uuid, references delivery_orders)
     - `company_id` (uuid, references companies)
     - `status` (text) - 'unpaid', 'paid', 'cancelled'
     - `payment_date` (date, nullable)
     - `created_by` (uuid, references user_profiles)
     - `created_at` (timestamptz)
     - `updated_at` (timestamptz)

  7. **download_logs**
     - `id` (uuid, primary key)
     - `document_type` (text) - 'quote', 'delivery_order', 'invoice'
     - `document_id` (uuid)
     - `downloaded_by` (uuid, references user_profiles)
     - `downloaded_at` (timestamptz)

  ## Sécurité
  - RLS activé sur toutes les tables
  - Les employés peuvent voir/créer les documents de leur entreprise
  - Les employeurs peuvent tout gérer pour leurs entreprises
*/

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL CHECK (role IN ('employee', 'employer')),
  company_id uuid,
  created_at timestamptz DEFAULT now()
);

-- Create companies table
CREATE TABLE IF NOT EXISTS companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  logo_url text,
  signature_url text,
  employer_id uuid REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now()
);

-- Add foreign key for company_id in user_profiles
ALTER TABLE user_profiles 
  DROP CONSTRAINT IF EXISTS user_profiles_company_id_fkey;

ALTER TABLE user_profiles 
  ADD CONSTRAINT user_profiles_company_id_fkey 
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE SET NULL;

-- Create quotes table
CREATE TABLE IF NOT EXISTS quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number text UNIQUE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  client_name text NOT NULL,
  client_email text NOT NULL,
  client_phone text,
  client_address text,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'ordered', 'cancelled')),
  total_amount numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create quote_items table
CREATE TABLE IF NOT EXISTS quote_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  description text NOT NULL,
  quantity numeric NOT NULL,
  unit_price numeric NOT NULL,
  total_price numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create delivery_orders table
CREATE TABLE IF NOT EXISTS delivery_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text UNIQUE NOT NULL,
  quote_id uuid REFERENCES quotes(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'delivered', 'cancelled')),
  delivery_date date,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create invoices table
CREATE TABLE IF NOT EXISTS invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text UNIQUE NOT NULL,
  delivery_order_id uuid REFERENCES delivery_orders(id) ON DELETE CASCADE NOT NULL,
  company_id uuid REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
  status text NOT NULL DEFAULT 'unpaid' CHECK (status IN ('unpaid', 'paid', 'cancelled')),
  payment_date date,
  created_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create download_logs table
CREATE TABLE IF NOT EXISTS download_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_type text NOT NULL CHECK (document_type IN ('quote', 'delivery_order', 'invoice')),
  document_id uuid NOT NULL,
  downloaded_by uuid REFERENCES user_profiles(id) ON DELETE SET NULL,
  downloaded_at timestamptz DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE download_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_profiles
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Employers can view employees in their companies"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.employer_id = auth.uid()
      AND c.id = user_profiles.company_id
    )
  );

-- RLS Policies for companies
CREATE POLICY "Employers can view their companies"
  ON companies FOR SELECT
  TO authenticated
  USING (employer_id = auth.uid());

CREATE POLICY "Employers can insert companies"
  ON companies FOR INSERT
  TO authenticated
  WITH CHECK (employer_id = auth.uid());

CREATE POLICY "Employers can update their companies"
  ON companies FOR UPDATE
  TO authenticated
  USING (employer_id = auth.uid())
  WITH CHECK (employer_id = auth.uid());

CREATE POLICY "Employees can view their company"
  ON companies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.company_id = companies.id
    )
  );

-- RLS Policies for quotes
CREATE POLICY "Users can view quotes from their company"
  ON quotes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = quotes.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = quotes.company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can insert quotes for their company"
  ON quotes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can update quotes from their company"
  ON quotes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = quotes.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = quotes.company_id AND companies.employer_id = auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = company_id AND companies.employer_id = auth.uid()))
    )
  );

-- RLS Policies for quote_items
CREATE POLICY "Users can view quote items from their company"
  ON quote_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE q.id = quote_items.quote_id
      AND (up.company_id = q.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = q.company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can insert quote items for their company"
  ON quote_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE q.id = quote_id
      AND (up.company_id = q.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = q.company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can delete quote items from their company"
  ON quote_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM quotes q
      JOIN user_profiles up ON up.id = auth.uid()
      WHERE q.id = quote_items.quote_id
      AND (up.company_id = q.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = q.company_id AND companies.employer_id = auth.uid()))
    )
  );

-- RLS Policies for delivery_orders
CREATE POLICY "Users can view delivery orders from their company"
  ON delivery_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = delivery_orders.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = delivery_orders.company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can insert delivery orders for their company"
  ON delivery_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can update delivery orders from their company"
  ON delivery_orders FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = delivery_orders.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = delivery_orders.company_id AND companies.employer_id = auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = company_id AND companies.employer_id = auth.uid()))
    )
  );

-- RLS Policies for invoices
CREATE POLICY "Users can view invoices from their company"
  ON invoices FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = invoices.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = invoices.company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can insert invoices for their company"
  ON invoices FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = company_id AND companies.employer_id = auth.uid()))
    )
  );

CREATE POLICY "Users can update invoices from their company"
  ON invoices FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = invoices.company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = invoices.company_id AND companies.employer_id = auth.uid()))
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND (user_profiles.company_id = company_id OR 
           EXISTS (SELECT 1 FROM companies WHERE companies.id = company_id AND companies.employer_id = auth.uid()))
    )
  );

-- RLS Policies for download_logs
CREATE POLICY "Users can view their download logs"
  ON download_logs FOR SELECT
  TO authenticated
  USING (downloaded_by = auth.uid());

CREATE POLICY "Users can insert download logs"
  ON download_logs FOR INSERT
  TO authenticated
  WITH CHECK (downloaded_by = auth.uid());

CREATE POLICY "Employers can view all download logs for their companies"
  ON download_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM companies c
      WHERE c.employer_id = auth.uid()
    )
  );

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_company_id ON user_profiles(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_company_id ON quotes(company_id);
CREATE INDEX IF NOT EXISTS idx_quotes_created_by ON quotes(created_by);
CREATE INDEX IF NOT EXISTS idx_quote_items_quote_id ON quote_items(quote_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_quote_id ON delivery_orders(quote_id);
CREATE INDEX IF NOT EXISTS idx_delivery_orders_company_id ON delivery_orders(company_id);
CREATE INDEX IF NOT EXISTS idx_invoices_delivery_order_id ON invoices(delivery_order_id);
CREATE INDEX IF NOT EXISTS idx_invoices_company_id ON invoices(company_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_document_id ON download_logs(document_id);
CREATE INDEX IF NOT EXISTS idx_download_logs_downloaded_by ON download_logs(downloaded_by);