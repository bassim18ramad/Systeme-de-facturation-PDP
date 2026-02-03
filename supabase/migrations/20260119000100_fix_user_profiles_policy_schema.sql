-- Ensure policy uses schema-qualified helper to avoid search_path issues

DROP POLICY IF EXISTS "Users can view profiles" ON public.user_profiles;

CREATE POLICY "Users can view profiles"
  ON public.user_profiles FOR SELECT
  TO authenticated
  USING (
    auth.uid() = id
    OR public.is_employer_of_company(company_id)
  );
