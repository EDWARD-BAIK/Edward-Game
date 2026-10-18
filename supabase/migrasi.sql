-- Jalankan di Supabase > SQL Editor. Aman dijalankan ulang.

-- 1) Tabel pendukung (tertutup dari publik)
create table if not exists public.rate_log (key text not null, ts timestamptz not null default now());
create index if not exists rate_log_key_ts on public.rate_log (key, ts);
create table if not exists public.used_nonces (nonce text primary key, used_at timestamptz not null default now());
alter table public.rate_log enable row level security;
alter table public.used_nonces enable row level security;

-- 2) Rate limit atomik: true = boleh, false = kena limit
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

-- 3) Pembungkus submit skor: anti-replay + validasi lapis kedua, lalu panggil submit_score yang sudah ada
create or replace function public.submit_score_secure(p_id text, p_name text, p_dist int, p_mode text, p_nonce text)
returns text language plpgsql security definer set search_path = public as $$
declare ins int; v boolean;
begin
  if p_dist is null or p_dist <= 0 or p_dist > 150000 then return 'dist'; end if;
  if p_name is null or p_name !~ '^[[:alnum:] _.-]{2,12}$' then return 'name_invalid'; end if;
  if p_mode not in ('normal','hard') then return 'mode'; end if;

  insert into used_nonces(nonce) values (p_nonce) on conflict do nothing;
  get diagnostics ins = row_count;
  if ins = 0 then return 'replay'; end if;

  select public.submit_score(p_id, p_name, p_dist, p_mode) into v;
  if v is false then
    delete from used_nonces where nonce = p_nonce;  -- nama belum diklaim: token boleh dipakai ulang setelah klaim
    return 'name';
  end if;
  return 'ok';
end $$;

-- 4) KUNCI: fungsi sensitif hanya boleh dipanggil dari server (service_role), bukan dari browser
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
-- top_scores sengaja tetap bisa dibaca publik (papan skor).

-- 5) CEK MANUAL (jalankan satu per satu, lihat hasilnya):
-- a. Tabel mana yang RLS-nya belum aktif? (rowsecurity harus true untuk tabel skor/nama)
--    select tablename, rowsecurity from pg_tables where schemaname = 'public';
-- b. Hapus skor/nama palsu (ganti <tabel_skor> dan kolomnya sesuai skema-mu):
--    delete from public.<tabel_skor> where dist >= 150000 or name ~ '[<>]' or name ilike '%hack%';
