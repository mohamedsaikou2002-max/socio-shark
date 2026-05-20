CREATE TABLE IF NOT EXISTS public.app_secrets (
  key text PRIMARY KEY,
  value text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.app_secrets ENABLE ROW LEVEL SECURITY;

-- No client access whatsoever — only the service role (used by server functions) may read/write.
-- We intentionally create NO policies so the publishable/anon key cannot reach this table.

CREATE TRIGGER trg_app_secrets_updated_at
BEFORE UPDATE ON public.app_secrets
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();