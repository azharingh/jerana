-- JerAna — run once in Supabase SQL Editor (Dashboard → SQL → New query)

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.waste_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text not null default '',
  rate_gems numeric(10, 2) not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.regions (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  fertility numeric(5, 2) not null default 0 check (fertility >= 0 and fertility <= 100)
);

create table if not exists public.locations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  address text not null default '',
  city text not null default '',
  lat double precision not null,
  lng double precision not null
);

create table if not exists public.app_settings (
  key text primary key,
  value text not null
);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  waste_type_id uuid not null references public.waste_types (id),
  kg numeric(10, 2) not null check (kg > 0),
  submission_date date not null,
  photo_path text,
  reward_gems numeric(12, 2) not null default 0,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected')),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists submissions_user_id_idx on public.submissions (user_id);
create index if not exists submissions_status_idx on public.submissions (status);

-- ---------------------------------------------------------------------------
-- Stats view (approved submissions only)
-- ---------------------------------------------------------------------------

create or replace view public.my_stats
with (security_invoker = true) as
select
  s.user_id,
  coalesce(sum(s.kg) filter (where s.status = 'approved'), 0)::numeric(12, 2) as total_kg,
  coalesce(sum(s.reward_gems) filter (where s.status = 'approved'), 0)::numeric(12, 2) as total_gems,
  count(*) filter (where s.status = 'approved')::int as approved_count,
  least(
    100,
    coalesce(
      100 * sum(s.kg) filter (where s.status = 'approved')
        / nullif(
          (select value::numeric from public.app_settings where key = 'fertility_target_kg'),
          0
        ),
      0
    )
  )::numeric(5, 2) as fertility_score
from public.submissions s
where s.user_id = auth.uid()
group by s.user_id;

-- ---------------------------------------------------------------------------
-- Auth: profile on sign-up
-- ---------------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do update
  set full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Submissions: user_id + reward from server (never trust client)
-- ---------------------------------------------------------------------------

create or replace function public.compute_submission_reward()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  rate numeric;
begin
  if new.user_id is null then
    new.user_id := auth.uid();
  end if;

  if new.user_id is distinct from auth.uid() then
    raise exception 'not allowed';
  end if;

  select wt.rate_gems into rate
  from public.waste_types wt
  where wt.id = new.waste_type_id and wt.is_active = true;

  if rate is null then
    raise exception 'invalid waste type';
  end if;

  new.reward_gems := round(rate * new.kg, 2);
  new.status := coalesce(new.status, 'pending');
  return new;
end;
$$;

drop trigger if exists submissions_compute_reward on public.submissions;
create trigger submissions_compute_reward
  before insert on public.submissions
  for each row execute function public.compute_submission_reward();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

-- Admin checks must not query profiles inside profiles RLS (infinite recursion).
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

alter table public.profiles enable row level security;
alter table public.waste_types enable row level security;
alter table public.regions enable row level security;
alter table public.locations enable row level security;
alter table public.app_settings enable row level security;
alter table public.submissions enable row level security;

-- profiles
drop policy if exists "profiles read own" on public.profiles;
create policy "profiles read own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles read admin" on public.profiles;
create policy "profiles read admin"
  on public.profiles for select
  using (public.is_admin());

drop policy if exists "profiles insert own" on public.profiles;
create policy "profiles insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles update own" on public.profiles;
create policy "profiles update own"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- public reference data
drop policy if exists "waste_types public read" on public.waste_types;
create policy "waste_types public read"
  on public.waste_types for select
  using (true);

drop policy if exists "regions public read" on public.regions;
create policy "regions public read"
  on public.regions for select
  using (true);

drop policy if exists "locations public read" on public.locations;
create policy "locations public read"
  on public.locations for select
  using (true);

drop policy if exists "app_settings public read" on public.app_settings;
create policy "app_settings public read"
  on public.app_settings for select
  using (true);

-- submissions
drop policy if exists "submissions insert own" on public.submissions;
create policy "submissions insert own"
  on public.submissions for insert
  with check (auth.uid() = user_id);

drop policy if exists "submissions read own" on public.submissions;
create policy "submissions read own"
  on public.submissions for select
  using (auth.uid() = user_id);

drop policy if exists "submissions admin read" on public.submissions;
create policy "submissions admin read"
  on public.submissions for select
  using (public.is_admin());

drop policy if exists "submissions admin update" on public.submissions;
create policy "submissions admin update"
  on public.submissions for update
  using (public.is_admin());

-- my_stats (view uses submissions RLS under the hood when queried as user)
grant select on public.my_stats to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: private waste photos (path: {user_id}/filename)
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('waste-photos', 'waste-photos', false)
on conflict (id) do update set public = false;

drop policy if exists "waste photos upload own" on storage.objects;
create policy "waste photos upload own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'waste-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "waste photos read own" on storage.objects;
create policy "waste photos read own"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'waste-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "waste photos admin read" on storage.objects;
create policy "waste photos admin read"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'waste-photos'
    and public.is_admin()
  );

-- ---------------------------------------------------------------------------
-- Seed data
-- ---------------------------------------------------------------------------

insert into public.app_settings (key, value)
values ('fertility_target_kg', '150')
on conflict (key) do nothing;

-- More types: supabase/seed_waste_types.sql
insert into public.waste_types (name, description, rate_gems, is_active) values
  ('Овощные очистки', 'Кожура картофеля, моркови, лука и других овощей', 8, true),
  ('Фруктовые очистки', 'Кожура яблок, бананов, цитрусовых', 10, true),
  ('Садовые отходы', 'Скошенная трава, листья, мелкие ветки', 6, true),
  ('Кофейная гуща', 'Использованный молотый кофе', 12, true),
  ('Яичная скорлупа', 'Промытая и измельчённая скорлупа', 9, true)
on conflict (name) do nothing;

insert into public.regions (name, fertility) values
  ('Алматы', 42),
  ('Астана', 38),
  ('Шымкент', 45),
  ('Караганда', 35),
  ('Актobe', 33),
  ('Павлодар', 40)
on conflict (name) do nothing;

insert into public.locations (name, address, city, lat, lng) values
  ('EcoPoint Almaty', 'ул. Абая 150', 'Алматы', 43.238949, 76.945465),
  ('Green Hub Astana', 'пр. Кабанбай батыра 62', 'Астана', 51.128422, 71.430564)
on conflict do nothing;
