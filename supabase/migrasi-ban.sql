-- Jalankan di Supabase SQL Editor (aman dijalankan ulang). Tabel blacklist skor global.
create table if not exists public.score_bans (
  k text primary key,                 -- 'id:EDW-XXXXXX' atau 'ip:<hash>'
  banned_until timestamptz not null,
  reason text,
  created_at timestamptz not null default now()
);
alter table public.score_bans enable row level security;  -- tanpa policy = hanya server (service_role) yang bisa akses

-- Lihat siapa yang sedang kena ban:
-- select * from public.score_bans where banned_until > now() order by created_at desc;
-- Cabut ban manual:
-- delete from public.score_bans where k = 'id:EDW-XXXXXX';
