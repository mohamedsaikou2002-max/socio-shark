CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE public.saved_prompts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  title TEXT NOT NULL,
  prompt TEXT NOT NULL,
  vibe_id UUID,
  duration INTEGER NOT NULL DEFAULT 5,
  use_count INTEGER NOT NULL DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE public.saved_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all saved_prompts" ON public.saved_prompts FOR ALL USING (true) WITH CHECK (true);

CREATE TRIGGER update_saved_prompts_updated_at
BEFORE UPDATE ON public.saved_prompts
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();