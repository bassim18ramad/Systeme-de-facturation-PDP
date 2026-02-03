
-- Update handle_new_user to include status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, company_id, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'full_name', ''), 'Utilisateur'),
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'role', ''), 'employee'),
    NULLIF(NEW.raw_user_meta_data->>'company_id', '')::uuid,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'status', ''), 'active')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- Add RLS policy for employers to update/approve employees
CREATE POLICY "Employers can update employees in their company"
  ON public.user_profiles FOR UPDATE
  TO authenticated
  USING (public.is_employer_of_company(company_id))
  WITH CHECK (public.is_employer_of_company(company_id));
