-- Add line_index for jump-to-sentence bookmark navigation.
alter table public.user_highlights
  add column if not exists line_index int not null default 0;
