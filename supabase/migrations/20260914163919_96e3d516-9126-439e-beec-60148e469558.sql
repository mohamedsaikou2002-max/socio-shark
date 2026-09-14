CREATE POLICY "No client access to app_secrets"
  ON public.app_secrets
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);