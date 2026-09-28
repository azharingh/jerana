-- Fix: "infinite recursion detected in policy for relation profiles"
-- Run once in Supabase → SQL Editor

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select p.is_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_admin() to anon;

drop policy if exists "profiles read admin" on public.profiles;
create policy "profiles read admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "submissions admin read" on public.submissions;
create policy "submissions admin read"
  on public.submissions for select
  using (public.is_admin());

drop policy if exists "submissions admin update" on public.submissions;
create policy "submissions admin update"
  on public.submissions for update
  using (public.is_admin());

drop policy if exists "waste photos admin read" on storage.objects;
create policy "waste photos admin read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'waste-photos'
    and public.is_admin()
  );
