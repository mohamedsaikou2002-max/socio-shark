
create table public.vibes (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  prompt_style text not null,
  caption_tone text not null,
  music_mood text default 'ambient',
  weight real not null default 1.0,
  created_at timestamptz not null default now()
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  vibe_id uuid references public.vibes(id) on delete set null,
  vibe_name text,
  video_path text not null,
  caption_tiktok text,
  caption_instagram text,
  status text not null default 'draft',
  scheduled_for timestamptz,
  posted_at timestamptz,
  tiktok_post_id text,
  ig_post_id text,
  platforms text[] not null default array['tiktok','instagram'],
  error text,
  notes text
);
create index posts_status_sched_idx on public.posts(status, scheduled_for);

create table public.schedule_slots (
  id uuid primary key default gen_random_uuid(),
  hour int not null check (hour between 0 and 23),
  minute int not null default 0 check (minute between 0 and 59),
  enabled boolean not null default true,
  platforms text[] not null default array['tiktok','instagram'],
  created_at timestamptz not null default now()
);

alter table public.vibes enable row level security;
alter table public.posts enable row level security;
alter table public.schedule_slots enable row level security;

create policy "open all vibes" on public.vibes for all using (true) with check (true);
create policy "open all posts" on public.posts for all using (true) with check (true);
create policy "open all slots" on public.schedule_slots for all using (true) with check (true);

insert into public.vibes (name, prompt_style, caption_tone, music_mood) values
  ('High Energy', 'fast-paced, dynamic motion, bold colors, electric atmosphere, high contrast lighting', 'exciting, hype, energetic', 'upbeat'),
  ('Luxury Sleek', 'cinematic slow motion, minimal aesthetic, soft golden lighting, premium feel, elegant transitions', 'sophisticated, premium, aspirational', 'ambient'),
  ('Cyber Tech', 'neon lights, futuristic setting, glitch effects, dark background, holographic elements', 'innovative, cutting-edge, futuristic', 'electronic'),
  ('Lifestyle Casual', 'natural daylight, real-world setting, authentic feel, warm tones, relatable scenes', 'friendly, relatable, conversational', 'chill'),
  ('Bold Statement', 'graphic design inspired, strong typography motion, high contrast, brand colors dominant', 'bold, direct, punchy', 'dramatic');

insert into public.schedule_slots (hour, minute) values (8,0),(14,0),(20,0);

insert into storage.buckets (id, name, public) values ('videos','videos', true)
  on conflict (id) do nothing;

create policy "public videos read" on storage.objects for select using (bucket_id = 'videos');
create policy "public videos insert" on storage.objects for insert with check (bucket_id = 'videos');
create policy "public videos delete" on storage.objects for delete using (bucket_id = 'videos');
