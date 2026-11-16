insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'book-covers',
  'book-covers',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Public can view book covers" on storage.objects;
create policy "Public can view book covers"
  on storage.objects
  for select
  to anon, authenticated
  using (bucket_id = 'book-covers');

drop policy if exists "Admins can upload book covers" on storage.objects;
create policy "Admins can upload book covers"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'book-covers'
    and (select public.is_starbooks_admin())
  );

drop policy if exists "Admins can update book covers" on storage.objects;
create policy "Admins can update book covers"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'book-covers'
    and (select public.is_starbooks_admin())
  )
  with check (
    bucket_id = 'book-covers'
    and (select public.is_starbooks_admin())
  );

drop policy if exists "Admins can delete book covers" on storage.objects;
create policy "Admins can delete book covers"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'book-covers'
    and (select public.is_starbooks_admin())
  );