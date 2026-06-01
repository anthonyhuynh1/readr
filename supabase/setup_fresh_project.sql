-- Readr: run once in Supabase Dashboard → SQL Editor → New query → Run
-- Project: https://supabase.com/dashboard/project/regeyynbpyebcbtbwzsf/sql/new
--
-- Skips deprecated 001_init.sql (no-op) and 002_content_alignment.sql (legacy schema).
-- Safe to re-run: uses IF NOT EXISTS / IF NOT EXISTS columns / ON CONFLICT.

-- ========== 001_init_v2.sql ==========
create extension if not exists "pgcrypto";

create table if not exists public.books (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  author text not null,
  cover_url text,
  description text not null default '',
  standard_ebooks_url text not null default '',
  librivox_url text not null default '',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  book_slug text not null references public.books(slug) on delete cascade,
  chapter_index int not null,
  title text not null,
  page_number int not null default 1,
  audio_path text not null,
  sync_metadata_path text not null,
  audio_offset_ms int not null default 0 check (audio_offset_ms >= 0),
  sync_hash text not null,
  sync_version int not null default 1,
  duration_ms int not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  unique (book_slug, chapter_index)
);

create table if not exists public.sentences (
  id text primary key,
  chapter_slug text not null references public.chapters(slug) on delete cascade,
  sentence_index int not null,
  text_content text not null,
  start_time_ms int not null check (start_time_ms >= 0),
  end_time_ms int not null check (end_time_ms > start_time_ms),
  page_number int not null default 1,
  created_at timestamptz not null default timezone('utc', now()),
  unique (chapter_slug, sentence_index)
);

create table if not exists public.user_highlights (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  chapter_slug text not null references public.chapters(slug) on delete cascade,
  sentence_id text not null references public.sentences(id) on delete cascade,
  book_slug text not null,
  book_title text not null,
  chapter_title text not null,
  page_hint int,
  text_preview text not null,
  timestamp_start_ms int not null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_threads (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  book_slug text not null,
  chapter_slug text not null references public.chapters(slug) on delete cascade,
  sentence_id text not null references public.sentences(id) on delete cascade,
  title text not null default 'Ask Readr',
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.ai_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_chapters_book_slug on public.chapters(book_slug, chapter_index);
create index if not exists idx_sentences_chapter on public.sentences(chapter_slug, sentence_index);
create index if not exists idx_highlights_user on public.user_highlights(user_id, created_at desc);
create index if not exists idx_threads_user on public.ai_threads(user_id, created_at desc);

alter table public.user_highlights enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists highlights_user_all on public.user_highlights;
create policy highlights_user_all on public.user_highlights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_threads_user_all on public.ai_threads;
create policy ai_threads_user_all on public.ai_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_messages_user_all on public.ai_messages;
create policy ai_messages_user_all on public.ai_messages
  for all using (
    exists (
      select 1 from public.ai_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1 from public.ai_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );

alter table public.books enable row level security;
alter table public.chapters enable row level security;
alter table public.sentences enable row level security;

drop policy if exists books_public_read on public.books;
create policy books_public_read on public.books for select using (true);

drop policy if exists chapters_public_read on public.chapters;
create policy chapters_public_read on public.chapters for select using (true);

drop policy if exists sentences_public_read on public.sentences;
create policy sentences_public_read on public.sentences for select using (true);

-- ========== 002_user_highlights_line_index.sql ==========
alter table public.user_highlights
  add column if not exists line_index int not null default 0;

-- ========== 003_storage.sql ==========
insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('audio', 'audio', true),
  ('sync', 'sync', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists covers_public_read on storage.objects;
create policy covers_public_read on storage.objects
  for select using (bucket_id = 'covers');

drop policy if exists audio_public_read on storage.objects;
create policy audio_public_read on storage.objects
  for select using (bucket_id = 'audio');

drop policy if exists sync_public_read on storage.objects;
create policy sync_public_read on storage.objects
  for select using (bucket_id = 'sync');

-- ========== 004_text_storage.sql ==========
insert into storage.buckets (id, name, public)
values ('text', 'text', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists text_public_read on storage.objects;
create policy text_public_read on storage.objects
  for select using (bucket_id = 'text');

alter table public.chapters
  add column if not exists text_metadata_path text not null default '',
  add column if not exists text_hash text not null default '',
  add column if not exists text_version int not null default 1;
