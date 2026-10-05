-- $300 one-time Stripe payment grants permanent app access only after the
-- signed Stripe webhook marks the account active.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS stripe_checkout_session_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS amount_paid_cents integer,
  ADD COLUMN IF NOT EXISTS currency text;

CREATE TABLE IF NOT EXISTS public.stripe_webhook_events (
  event_id text PRIMARY KEY,
  event_type text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.stripe_webhook_events FROM anon, authenticated;
GRANT ALL ON public.stripe_webhook_events TO service_role;
ALTER TABLE public.stripe_webhook_events ENABLE ROW LEVEL SECURITY;

-- Each paying account has its own rows. Legacy rows without an owner remain
-- inaccessible to customers until an administrator deliberately assigns them.
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.saved_prompts ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();
ALTER TABLE public.schedule_slots ADD COLUMN IF NOT EXISTS owner_user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid();

CREATE INDEX IF NOT EXISTS posts_owner_status_idx ON public.posts(owner_user_id, status, scheduled_for);
CREATE INDEX IF NOT EXISTS products_owner_created_idx ON public.products(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS saved_prompts_owner_created_idx ON public.saved_prompts(owner_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS schedule_slots_owner_enabled_idx ON public.schedule_slots(owner_user_id, enabled);

-- Preserve the existing shared library for its sole existing account where
-- ownership is unambiguous; never expose legacy shared rows to multiple users.
DO $$
DECLARE
  account_count integer;
  only_account uuid;
BEGIN
  SELECT count(*) INTO account_count FROM public.profiles;
  IF account_count = 1 THEN
    SELECT id INTO only_account FROM public.profiles LIMIT 1;
    UPDATE public.posts SET owner_user_id = only_account WHERE owner_user_id IS NULL;
    UPDATE public.products SET owner_user_id = only_account WHERE owner_user_id IS NULL;
    UPDATE public.saved_prompts SET owner_user_id = only_account WHERE owner_user_id IS NULL;
    UPDATE public.schedule_slots SET owner_user_id = only_account WHERE owner_user_id IS NULL;
  END IF;
END $$;

-- Give existing and future accounts their own default publishing schedule.
INSERT INTO public.schedule_slots (owner_user_id, hour, minute)
SELECT p.id, slot.hour, slot.minute
FROM public.profiles p
CROSS JOIN (VALUES (8, 0), (14, 0), (20, 0)) AS slot(hour, minute)
WHERE NOT EXISTS (
  SELECT 1 FROM public.schedule_slots existing WHERE existing.owner_user_id = p.id
);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.subscriptions (user_id, status)
  VALUES (NEW.id, 'inactive')
  ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.schedule_slots (owner_user_id, hour, minute)
  VALUES (NEW.id, 8, 0), (NEW.id, 14, 0), (NEW.id, 20, 0);
  RETURN NEW;
END;
$$;

-- Remove the previous signed-in-user-wide policies and require both paid access
-- and ownership for all customer content. Vibes are shared read-only templates.
DROP POLICY IF EXISTS "authenticated access posts" ON public.posts;
DROP POLICY IF EXISTS "authenticated access products" ON public.products;
DROP POLICY IF EXISTS "authenticated access saved_prompts" ON public.saved_prompts;
DROP POLICY IF EXISTS "authenticated access schedule_slots" ON public.schedule_slots;
DROP POLICY IF EXISTS "authenticated access vibes" ON public.vibes;

CREATE POLICY "paid owners manage posts" ON public.posts FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners manage products" ON public.products FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners manage saved prompts" ON public.saved_prompts FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners manage schedule slots" ON public.schedule_slots FOR ALL TO authenticated
  USING (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()))
  WITH CHECK (owner_user_id = auth.uid() AND public.is_member_active(auth.uid()));
CREATE POLICY "paid members read vibes" ON public.vibes FOR SELECT TO authenticated
  USING (public.is_member_active(auth.uid()));

DROP POLICY IF EXISTS "authenticated videos insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated videos delete" ON storage.objects;
DROP POLICY IF EXISTS "authenticated product images insert" ON storage.objects;
DROP POLICY IF EXISTS "authenticated product images delete" ON storage.objects;
DROP POLICY IF EXISTS "public videos read" ON storage.objects;
DROP POLICY IF EXISTS "public product images read" ON storage.objects;

-- Keep media private at rest. Signed URLs are issued for the short period
-- needed by the UI and by Meta/TikTok's media fetchers.
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('videos', 'videos', false, NULL), ('product-images', 'product-images', false, NULL)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = NULL;

CREATE POLICY "paid owners read videos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners read product images" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners upload videos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners delete videos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'videos' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners upload product images" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_member_active(auth.uid()));
CREATE POLICY "paid owners delete product images" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'product-images' AND (storage.foldername(name))[1] = auth.uid()::text AND public.is_member_active(auth.uid()));
