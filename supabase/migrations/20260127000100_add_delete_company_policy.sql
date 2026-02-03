-- Add DELETE policy for companies
CREATE POLICY "Employers can delete their companies"
  ON public.companies FOR DELETE
  TO authenticated
  USING (employer_id = auth.uid());
