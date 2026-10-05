-- Per-user business profile, onboarding workflow and saved marketing strategy.
CREATE TABLE IF NOT EXISTS public.business_profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  industry text NOT NULL CHECK (length(trim(industry)) > 0 AND length(industry) <= 120),
  business_name text, target_audience text, primary_offer text, brand_voice text,
  approval_steps text, posting_cadence text, preferred_cta text,
  platforms text[] NOT NULL DEFAULT '{}', workflow_notes text,
  strategy text, strategy_updated_at timestamptz, onboarding_completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.business_profiles TO authenticated;
GRANT ALL ON public.business_profiles TO service_role;
ALTER TABLE public.business_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners read own business profile" ON public.business_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Owners insert own business profile" ON public.business_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owners update own business profile" ON public.business_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
