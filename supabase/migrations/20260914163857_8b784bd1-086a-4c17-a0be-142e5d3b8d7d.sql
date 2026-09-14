CREATE TABLE public.activations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  license_token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '365 days'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX activations_license_token_idx ON public.activations (license_token);

GRANT ALL ON public.activations TO service_role;

ALTER TABLE public.activations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No client access to activations"
  ON public.activations
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

CREATE TRIGGER update_activations_updated_at
  BEFORE UPDATE ON public.activations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();