
-- Products table: source images for video generation
CREATE TABLE public.products (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  image_path TEXT NOT NULL,
  name TEXT,
  brief TEXT,
  videos_generated INT NOT NULL DEFAULT 0
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "open all products" ON public.products FOR ALL USING (true) WITH CHECK (true);

-- Track source image + generation job on posts
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS source_image_path TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS kling_task_id TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS generation_status TEXT;
ALTER TABLE public.posts ADD COLUMN IF NOT EXISTS generation_prompt TEXT;

-- Bucket for product images
INSERT INTO storage.buckets (id, name, public) VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "product images public read" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
CREATE POLICY "product images insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'product-images');
CREATE POLICY "product images delete" ON storage.objects FOR DELETE USING (bucket_id = 'product-images');
