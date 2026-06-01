-- Text reading payloads in Storage (one JSON file per chapter; CDN-friendly).

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
