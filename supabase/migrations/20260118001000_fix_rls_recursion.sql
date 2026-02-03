-- Fix RLS recursion between user_profiles and companies

-- Helper: get current user's company_id without RLS recursion
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

-- Helper: check if current user is employer of a company without RLS recursion
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

-- Replace policies to use helpers (avoid recursive RLS)
DROP POLICY IF EXISTS "Employers can view employees in their companies" ON public.user_profiles;
CREATE POLICY "Employers can view employees in their companies"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (public.is_employer_of_company(company_id));

DROP POLICY IF EXISTS "Employees can view their company" ON public.companies;
CREATE POLICY "Employees can view their company"
  ON public.companies FOR SELECT
  TO authenticated
  USING (id = public.user_company_id());
