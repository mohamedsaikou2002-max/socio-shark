-- App secrets table: stores API keys server-side
-- Only readable by service role (supabaseAdmin), never by the browser client
CREATE TABLE public.app_secrets (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- No client access — server only via service role key
-- The browser cannot read or write this table directly
CREATE POLICY "no client access" ON public.app_secrets
  FOR ALL USING (false) WITH CHECK (false);
