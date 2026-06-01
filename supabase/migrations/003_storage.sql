-- Storage buckets for catalog assets (public read).

insert into storage.buckets (id, name, public)
values
  ('covers', 'covers', true),
  ('audio', 'audio', true),
  ('sync', 'sync', true)
on conflict (id) do update set public = excluded.public;

-- Public read for catalog buckets.
drop policy if exists covers_public_read on storage.objects;
create policy covers_public_read on storage.objects
  for select using (bucket_id = 'covers');

drop policy if exists audio_public_read on storage.objects;
create policy audio_public_read on storage.objects
  for select using (bucket_id = 'audio');

drop policy if exists sync_public_read on storage.objects;
create policy sync_public_read on storage.objects
  for select using (bucket_id = 'sync');
