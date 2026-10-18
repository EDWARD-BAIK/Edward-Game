-- Edward Game: SQL lengkap (tabel, rate limit, blacklist, submit aman, kunci akses).
-- Jalankan sekali di Supabase SQL Editor. Aman dijalankan ulang.

-- 1) TABEL PENDUKUNG
create table if not exists public.rate_log (key text not null, ts timestamptz not null default now());
create index if not exists rate_log_key_ts on public.rate_log (key, ts);
create table if not exists public.used_nonces (nonce text primary key, used_at timestamptz not null default now());
create table if not exists public.score_bans (k text primary key, banned_until timestamptz not null, reason text, created_at timestamptz not null default now());
alter table public.rate_log enable row level security;
alter table public.used_nonces enable row level security;
alter table public.score_bans enable row level security;

-- 2) RATE LIMIT
create or replace function public.rl_hit(p_key text, p_max int, p_window int)
returns boolean language plpgsql security definer set search_path = public as $$
declare n int;
begin
  perform pg_advisory_xact_lock(hashtext(p_key));
  delete from rate_log where key = p_key and ts < now() - make_interval(secs => p_window);
  select count(*) into n from rate_log where key = p_key;
  if n >= p_max then return false; end if;
  insert into rate_log(key) values (p_key);
  if random() < 0.01 then
    delete from rate_log where ts < now() - interval '1 hour';
    delete from used_nonces where used_at < now() - interval '1 day';
  end if;
  return true;
end $$;

-- 3) SUBMIT SKOR AMAN (submit_score lama bertipe void, jadi pakai perform)
create or replace function public.submit_score_secure(p_id text, p_name text, p_dist int, p_mode text, p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare ins int;
begin
  if p_dist is null or p_dist <= 0 or p_dist > 150000 then return 'dist'; end if;
  if p_name is null or p_name !~ '^[[:alnum:]_ .-]{2,12}$' then return 'name_invalid'; end if;
  if p_mode not in ('normal','hard') then return 'mode'; end if;

  insert into used_nonces(nonce) values (p_nonce) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return 'replay'; end if;

  begin
    perform public.submit_score(p_id, p_name, p_dist, p_mode);
  exception when others then
    delete from used_nonces where nonce = p_nonce;
    return 'name';
  end;
  return 'ok';
end $$;

-- 4) KUNCI AKSES: hanya server (service_role) yang boleh memanggil
do $$
declare r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('submit_score','claim_name','release_name','submit_score_secure','rl_hit')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
    execute format('grant execute on function %s to service_role', r.sig);
  end loop;
end $$;

-- 5) CEK HASIL: semua anon_boleh harus false
select p.proname, has_function_privilege('anon', p.oid, 'execute') as anon_boleh
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('submit_score','claim_name','release_name','submit_score_secure','rl_hit');

-- Blacklist: lihat yang kena ban / cabut ban
-- select * from public.score_bans where banned_until > now() order by created_at desc;
-- delete from public.score_bans where k = 'id:EDW-XXXXXX';
