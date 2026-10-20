-- Stockage des photos du site (bucket public en lecture, écriture admin)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('site-media', 'site-media', true, 8388608, array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy site_media_admin_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'site-media' and public.is_admin());
create policy site_media_admin_update on storage.objects for update to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
create policy site_media_admin_delete on storage.objects for delete to authenticated
  using (bucket_id = 'site-media' and public.is_admin());
