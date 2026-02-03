-- Fix user_profiles policy to avoid recursion

-- Remove helper that queries user_profiles directly
DROP POLICY IF EXISTS "Users can view profiles" ON public.user_profiles;
DROP FUNCTION IF EXISTS public.can_view_user_profile(uuid);

-- Recreate select policy using non-recursive helper
CREATE POLICY "Users can view profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_employer_of_company(company_id)
  );
