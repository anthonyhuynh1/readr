create table if not exists public.alignment_versions (
  id uuid primary key default gen_random_uuid(),
  chapter_id text not null references public.chapters(id) on delete cascade,
  version_name text not null,
  source_type text not null check (source_type in ('seeded', 'automated', 'corrected')),
  notes text not null default '',
  created_at timestamptz not null default now(),
  unique(chapter_id, version_name)
);

alter table public.sentences
  add column if not exists alignment_version_id uuid references public.alignment_versions(id);

alter table public.word_timestamps
  add column if not exists alignment_version_id uuid references public.alignment_versions(id);

alter table public.bookmarks enable row level security;
alter table public.ai_threads enable row level security;
alter table public.ai_messages enable row level security;

drop policy if exists bookmarks_user_select on public.bookmarks;
create policy bookmarks_user_select on public.bookmarks
  for select using (auth.uid() = user_id);

drop policy if exists bookmarks_user_insert on public.bookmarks;
create policy bookmarks_user_insert on public.bookmarks
  for insert with check (auth.uid() = user_id);

drop policy if exists bookmarks_user_update on public.bookmarks;
create policy bookmarks_user_update on public.bookmarks
  for update using (auth.uid() = user_id);

drop policy if exists bookmarks_user_delete on public.bookmarks;
create policy bookmarks_user_delete on public.bookmarks
  for delete using (auth.uid() = user_id);

drop policy if exists ai_threads_user_all on public.ai_threads;
create policy ai_threads_user_all on public.ai_threads
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists ai_messages_user_all on public.ai_messages;
create policy ai_messages_user_all on public.ai_messages
  for all using (
    exists (
      select 1
      from public.ai_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  ) with check (
    exists (
      select 1
      from public.ai_threads t
      where t.id = thread_id and t.user_id = auth.uid()
    )
  );
