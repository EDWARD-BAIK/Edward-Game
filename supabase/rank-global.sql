create table if not exists public.monthly_rank (
  user_id uuid not null,
  month text not null,
  points int not null default 0 check (points >= 0),
  updated_at timestamptz not null default now(),
  primary key (user_id, month)
);

create index if not exists monthly_rank_month_points on public.monthly_rank (month, points desc);

alter table public.monthly_rank enable row level security;
revoke all on public.monthly_rank from anon, authenticated, public;
grant all on public.monthly_rank to service_role;

create or replace function public.rank_month()
returns text language sql stable as $$
  select to_char(now() at time zone 'Asia/Jakarta', 'YYYY-MM')
$$;

create or replace function public.rank_add(p_user uuid, p_points int)
returns int language plpgsql security definer set search_path = public as $$
declare total int;
begin
  if p_user is null or p_points is null or p_points < 0 or p_points > 100000 then
    raise exception 'invalid';
  end if;
  insert into public.monthly_rank (user_id, month, points)
  values (p_user, public.rank_month(), p_points)
  on conflict (user_id, month)
  do update set points = public.monthly_rank.points + excluded.points, updated_at = now()
  returning points into total;
  return total;
end $$;

create or replace function public.rank_me(p_user uuid)
returns int language sql stable security definer set search_path = public as $$
  select coalesce((select points from public.monthly_rank where user_id = p_user and month = public.rank_month()), 0)
$$;

create or replace function public.rank_top()
returns table (name text, points int)
language sql stable security definer set search_path = public as $$
  select pn.name::text, r.points
  from public.monthly_rank r
  join public.player_names pn on pn.id::text = r.user_id::text
  where r.month = public.rank_month() and r.points > 0
  order by r.points desc, r.updated_at asc
  limit 50
$$;

create or replace function public.rank_lookup(p_names text[])
returns table (name text, points int)
language sql stable security definer set search_path = public as $$
  select pn.name::text, r.points
  from public.player_names pn
  join public.monthly_rank r on r.user_id::text = pn.id::text
  where r.month = public.rank_month()
    and pn.name::text = any (p_names[1:50])
$$;

revoke execute on function public.rank_add(uuid, int) from public, anon, authenticated;
revoke execute on function public.rank_me(uuid) from public, anon, authenticated;
grant execute on function public.rank_add(uuid, int) to service_role;
grant execute on function public.rank_me(uuid) to service_role;

revoke execute on function public.rank_top() from public;
revoke execute on function public.rank_lookup(text[]) from public;
grant execute on function public.rank_top() to anon, authenticated, service_role;
grant execute on function public.rank_lookup(text[]) to anon, authenticated, service_role;

select p.proname,
       has_function_privilege('anon', p.oid, 'execute') as anon_boleh
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('rank_add', 'rank_me', 'rank_top', 'rank_lookup');

select has_table_privilege('anon', 'public.monthly_rank', 'select') as anon_baca_tabel,
       has_table_privilege('authenticated', 'public.monthly_rank', 'update') as user_ubah_tabel;
