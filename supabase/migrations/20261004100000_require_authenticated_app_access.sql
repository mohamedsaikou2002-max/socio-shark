-- The dashboard uses shared app data, but all browser users must be signed in.
-- The service role remains available to trusted server functions only.
DO $$
DECLARE
  table_name text;
  policy_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['vibes', 'posts', 'schedule_slots', 'products', 'saved_prompts'] LOOP
    policy_name := 'open all ' || table_name;
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', policy_name, table_name);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      'authenticated access ' || table_name,
      table_name
    );
  END LOOP;
END $$;

-- Media URLs stay public because Meta and TikTok fetch generated videos from
-- Supabase Storage. Only signed-in users may upload or delete these assets.
DROP POLICY IF EXISTS "public videos insert" ON storage.objects;
CREATE POLICY "authenticated videos insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'videos');

DROP POLICY IF EXISTS "public videos delete" ON storage.objects;
CREATE POLICY "authenticated videos delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'videos');

DROP POLICY IF EXISTS "product images insert" ON storage.objects;
CREATE POLICY "authenticated product images insert" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'product-images');

DROP POLICY IF EXISTS "product images delete" ON storage.objects;
CREATE POLICY "authenticated product images delete" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'product-images');
