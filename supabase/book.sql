-- English Papers: storage for the textbook PDF uploaded from the admin page.
-- Paste into Supabase > SQL Editor > New query, then press Run. Safe to run again.
--
-- One public bucket that holds Book A and Book B, each a PDF of up to 50 MB (the Supabase free plan's limit per file).
-- Like the notes bucket, it accepts uploads and deletes from the website, limited to PDFs in this bucket only.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('book', 'book', true, 52428800, array['application/pdf'])
on conflict (id) do update
  set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Book list"   on storage.objects;
drop policy if exists "Book upload" on storage.objects;
drop policy if exists "Book delete" on storage.objects;
create policy "Book list"   on storage.objects for select to anon, authenticated using (bucket_id = 'book');
create policy "Book upload" on storage.objects for insert to anon, authenticated with check (bucket_id = 'book');
create policy "Book delete" on storage.objects for delete to anon, authenticated using (bucket_id = 'book');
