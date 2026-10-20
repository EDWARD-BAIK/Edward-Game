alter table public.player_gifts add column if not exists rank_points int not null default 0;

alter table public.player_gifts drop constraint if exists player_gifts_rank_points_check;
alter table public.player_gifts add constraint player_gifts_rank_points_check
  check (rank_points >= 0 and rank_points <= 1000000);

alter table public.player_gifts drop constraint if exists player_gifts_coins_check;
alter table public.player_gifts drop constraint if exists player_gifts_coins_or_rank;
alter table public.player_gifts add constraint player_gifts_coins_or_rank
  check (coins >= 0 and coins <= 1000000 and (coins > 0 or rank_points > 0));

create or replace function public.kirim_rank(p_gid text, p_points int default 13000, p_title text default 'Hadiah Rank')
returns text language plpgsql set search_path = public as $$
declare uid uuid;
begin
  select id into uid from public.edw_profiles where upper(gid) = upper(p_gid) limit 1;
  if uid is null then return 'ID tidak ditemukan'; end if;
  insert into public.player_gifts (user_id, coins, rank_points, title) values (uid, 0, p_points, p_title);
  return 'terkirim ke ' || p_gid;
end $$;

revoke execute on function public.kirim_rank(text, int, text) from public, anon, authenticated;
grant execute on function public.kirim_rank(text, int, text) to service_role;
