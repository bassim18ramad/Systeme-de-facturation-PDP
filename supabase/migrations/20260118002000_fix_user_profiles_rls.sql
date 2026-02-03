-- Remove recursive user_profiles policies and replace with helper function

-- Helper: can current user view target profile (self or employer of company)
CREATE OR REPLACE FUNCTION public.can_view_user_profile(target_user_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
SET row_security = off
AS $$
  SELECT (
    target_user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.user_profiles up
      JOIN public.companies c ON c.id = up.company_id
      WHERE up.id = target_user_id
        AND c.employer_id = auth.uid()
    )
  );
$$;

-- Drop existing policies to avoid recursion
DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Employers can view employees in their companies" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- Recreate non-recursive policies
CREATE POLICY "Users can view profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (public.can_view_user_profile(id));

CREATE POLICY "Users can update own profile"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);
