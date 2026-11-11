-- English Papers: storage for notes uploaded from the admin page.
-- Paste into Supabase > SQL Editor > New query, then press Run. Safe to run again.
--
-- This creates one public file bucket. There are no tables and no user accounts.
-- The admin page's username and password are a simple lock in the site's code, so the bucket itself
-- has to accept uploads and deletes from the website. The limits below keep that contained:
-- only PDFs and images, 25 MB each, and only inside this one bucket.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('notes', 'notes', true, 26214400, array['application/pdf','image/png','image/jpeg','image/webp'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Notes list"   on storage.objects;
drop policy if exists "Notes upload" on storage.objects;
drop policy if exists "Notes delete" on storage.objects;
create policy "Notes list"   on storage.objects for select to anon, authenticated using (bucket_id = 'notes');
create policy "Notes upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'notes');
create policy "Notes delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'notes');
