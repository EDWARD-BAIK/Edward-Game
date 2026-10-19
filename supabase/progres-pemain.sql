create table if not exists public.player_progress (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.player_progress add column if not exists coins int not null default 0;
alter table public.player_progress add column if not exists owned_skins text[] not null default array['default']::text[];
alter table public.player_progress add column if not exists selected_skin text not null default 'default';
alter table public.player_progress add column if not exists high_normal int not null default 0;
alter table public.player_progress add column if not exists high_hard int not null default 0;
alter table public.player_progress add column if not exists achievements text[] not null default '{}'::text[];
alter table public.player_progress add column if not exists stats jsonb not null default '{}'::jsonb;
alter table public.player_progress add column if not exists daily jsonb not null default '{}'::jsonb;
alter table public.player_progress add column if not exists initialized boolean not null default false;
alter table public.player_progress add column if not exists version int not null default 0;

alter table public.player_progress drop constraint if exists player_progress_coins_nonneg;
alter table public.player_progress add constraint player_progress_coins_nonneg check (coins >= 0);

alter table public.player_progress enable row level security;

drop policy if exists "progres_baca" on public.player_progress;
drop policy if exists "progres_tambah" on public.player_progress;
drop policy if exists "progres_ubah" on public.player_progress;
drop policy if exists "progres_hapus" on public.player_progress;

revoke all on public.player_progress from anon, authenticated, public;
grant all on public.player_progress to service_role;

create or replace function public.player_progress_touch()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists player_progress_touch on public.player_progress;
create trigger player_progress_touch before update on public.player_progress
  for each row execute function public.player_progress_touch();

select has_table_privilege('anon', 'public.player_progress', 'select') as anon_baca,
       has_table_privilege('authenticated', 'public.player_progress', 'update') as user_ubah;

create table if not exists public.player_gifts (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'Hadiah dari Admin',
  coins int not null check (coins > 0 and coins <= 1000000),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);

create index if not exists player_gifts_user_open on public.player_gifts (user_id) where claimed_at is null;

alter table public.player_gifts enable row level security;
revoke all on public.player_gifts from anon, authenticated, public;
grant all on public.player_gifts to service_role;

create or replace function public.kirim_koin(p_gid text, p_coins int default 10000, p_title text default 'Hadiah Penggantian Koin')
returns text language plpgsql set search_path = public as $$
declare uid uuid;
begin
  select id into uid from public.edw_profiles where upper(gid) = upper(p_gid) limit 1;
  if uid is null then return 'ID tidak ditemukan'; end if;
  insert into public.player_gifts (user_id, coins, title) values (uid, p_coins, p_title);
  return 'terkirim ke ' || p_gid;
end $$;

revoke execute on function public.kirim_koin(text, int, text) from public, anon, authenticated;
