-- Public share links for conversations. The browser uploads a sanitized JSON
-- snapshot (no tool output) under its own uid folder; anyone with the unguessable
-- link reads it through the public bucket endpoint. No SELECT policy is needed
-- for public reads, and there is no UPDATE policy: a share is immutable, only
-- its owner can delete (revoke) it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('shares', 'shares', true, 2097152, array['application/json'])
on conflict (id) do nothing;

drop policy if exists "shares_insert_own_folder" on storage.objects;
create policy "shares_insert_own_folder" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'shares' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "shares_delete_own_folder" on storage.objects;
create policy "shares_delete_own_folder" on storage.objects
  for delete to authenticated
  using (bucket_id = 'shares' and (storage.foldername(name))[1] = auth.uid()::text);
