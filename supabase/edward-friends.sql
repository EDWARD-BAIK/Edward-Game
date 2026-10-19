create table if not exists public.edw_profiles (
    id uuid primary key references auth.users(id) on delete cascade,
    gid text not null unique,
    name text not null default 'Pemain',
    updated_at timestamptz not null default now()
);

create table if not exists public.edw_friendships (
    id bigint generated always as identity primary key,
    requester uuid not null references auth.users(id) on delete cascade,
    addressee uuid not null references auth.users(id) on delete cascade,
    status text not null default 'pending' check (status in ('pending', 'accepted')),
    created_at timestamptz not null default now(),
    unique (requester, addressee),
    check (requester <> addressee)
);

create table if not exists public.edw_invites (
    id bigint generated always as identity primary key,
    from_id uuid not null references auth.users(id) on delete cascade,
    to_id uuid not null references auth.users(id) on delete cascade,
    room_code text not null,
    created_at timestamptz not null default now()
);

create table if not exists public.edw_notices (
    id bigint generated always as identity primary key,
    from_id uuid not null references auth.users(id) on delete cascade,
    to_id uuid not null references auth.users(id) on delete cascade,
    kind text not null default 'unfriend',
    created_at timestamptz not null default now()
);

alter table public.edw_notices enable row level security;
alter table public.edw_profiles enable row level security;
alter table public.edw_friendships enable row level security;
alter table public.edw_invites enable row level security;

create or replace function public.edw_sync_profile(p_name text)
returns text language plpgsql security definer set search_path = public as $$
declare
    v uuid := auth.uid();
    g text;
begin
    if v is null then return null; end if;
    g := 'G-' || upper(substr(replace(v::text, '-', ''), 1, 8));
    insert into public.edw_profiles (id, gid, name, updated_at)
    values (v, g, left(coalesce(nullif(trim(p_name), ''), 'Pemain'), 12), now())
    on conflict (id) do update set name = excluded.name, updated_at = now();
    return g;
end $$;

create or replace function public.edw_find_user(p_gid text)
returns table (uid uuid, user_gid text, user_name text, relation text, req_id bigint)
language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
    t public.edw_profiles;
    f public.edw_friendships;
begin
    if me is null then return; end if;
    select * into t from public.edw_profiles p where p.gid = upper(trim(p_gid));
    if not found then return; end if;
    if t.id = me then
        return query select t.id, t.gid, t.name, 'self'::text, null::bigint;
        return;
    end if;
    select * into f from public.edw_friendships x
    where (x.requester = me and x.addressee = t.id) or (x.requester = t.id and x.addressee = me)
    limit 1;
    if not found then
        return query select t.id, t.gid, t.name, 'none'::text, null::bigint;
    elsif f.status = 'accepted' then
        return query select t.id, t.gid, t.name, 'friend'::text, f.id;
    elsif f.requester = me then
        return query select t.id, t.gid, t.name, 'sent'::text, f.id;
    else
        return query select t.id, t.gid, t.name, 'received'::text, f.id;
    end if;
end $$;

create or replace function public.edw_send_request(p_to uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
    f public.edw_friendships;
begin
    if me is null or p_to is null or p_to = me then return 'invalid'; end if;
    if not exists (select 1 from public.edw_profiles p where p.id = p_to) then return 'invalid'; end if;
    select * into f from public.edw_friendships x
    where (x.requester = me and x.addressee = p_to) or (x.requester = p_to and x.addressee = me)
    limit 1;
    if found then
        if f.status = 'accepted' or f.requester = me then return 'exists'; end if;
        update public.edw_friendships set status = 'accepted' where id = f.id;
        return 'accepted';
    end if;
    insert into public.edw_friendships (requester, addressee, status) values (me, p_to, 'pending');
    return 'sent';
end $$;

create or replace function public.edw_respond_request(p_id bigint, p_accept boolean)
returns text language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'invalid'; end if;
    if p_accept then
        update public.edw_friendships set status = 'accepted'
        where id = p_id and addressee = me and status = 'pending';
    else
        delete from public.edw_friendships
        where id = p_id and addressee = me and status = 'pending';
    end if;
    return 'ok';
end $$;

create or replace function public.edw_friends()
returns table (uid uuid, user_gid text, user_name text)
language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return; end if;
    return query
    select p.id, p.gid, p.name
    from public.edw_friendships f
    join public.edw_profiles p on p.id = case when f.requester = me then f.addressee else f.requester end
    where f.status = 'accepted' and (f.requester = me or f.addressee = me)
    order by p.name;
end $$;

create or replace function public.edw_remove_friend(p_other uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
    n int;
begin
    if me is null then return 'invalid'; end if;
    delete from public.edw_friendships
    where status = 'accepted'
    and ((requester = me and addressee = p_other) or (requester = p_other and addressee = me));
    get diagnostics n = row_count;
    delete from public.edw_invites
    where (from_id = me and to_id = p_other) or (from_id = p_other and to_id = me);
    if n > 0 then
        delete from public.edw_notices where from_id = me and to_id = p_other and kind = 'unfriend';
        insert into public.edw_notices (from_id, to_id, kind) values (me, p_other, 'unfriend');
    end if;
    return 'ok';
end $$;

create or replace function public.edw_inbox()
returns table (kind text, ref_id bigint, from_uid uuid, from_gid text, from_name text, room_code text, created_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return; end if;
    delete from public.edw_invites i where i.created_at < now() - interval '15 minutes';
    delete from public.edw_notices x where x.created_at < now() - interval '7 days';
    return query
    select 'request'::text, f.id, p.id, p.gid, p.name, null::text, f.created_at
    from public.edw_friendships f
    join public.edw_profiles p on p.id = f.requester
    where f.addressee = me and f.status = 'pending'
    union all
    select 'invite'::text, i.id, p.id, p.gid, p.name, i.room_code, i.created_at
    from public.edw_invites i
    join public.edw_profiles p on p.id = i.from_id
    where i.to_id = me
    union all
    select 'unfriend'::text, x.id, p.id, p.gid, p.name, null::text, x.created_at
    from public.edw_notices x
    join public.edw_profiles p on p.id = x.from_id
    where x.to_id = me
    order by 7 desc;
end $$;

create or replace function public.edw_dismiss_notice(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'invalid'; end if;
    delete from public.edw_notices where id = p_id and to_id = me;
    return 'ok';
end $$;

create or replace function public.edw_send_invite(p_to uuid, p_room text)
returns text language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
begin
    if me is null or p_to is null then return 'invalid'; end if;
    if p_room is null or p_room !~ '^[A-Z0-9]{4,8}$' then return 'invalid'; end if;
    if not exists (
        select 1 from public.edw_friendships f
        where f.status = 'accepted'
        and ((f.requester = me and f.addressee = p_to) or (f.requester = p_to and f.addressee = me))
    ) then return 'not_friend'; end if;
    delete from public.edw_invites where from_id = me and to_id = p_to;
    insert into public.edw_invites (from_id, to_id, room_code) values (me, p_to, p_room);
    return 'ok';
end $$;

create or replace function public.edw_dismiss_invite(p_id bigint)
returns text language plpgsql security definer set search_path = public as $$
declare
    me uuid := auth.uid();
begin
    if me is null then return 'invalid'; end if;
    delete from public.edw_invites where id = p_id and to_id = me;
    return 'ok';
end $$;

revoke all on function public.edw_sync_profile(text) from public, anon;
revoke all on function public.edw_find_user(text) from public, anon;
revoke all on function public.edw_send_request(uuid) from public, anon;
revoke all on function public.edw_respond_request(bigint, boolean) from public, anon;
revoke all on function public.edw_friends() from public, anon;
revoke all on function public.edw_remove_friend(uuid) from public, anon;
revoke all on function public.edw_inbox() from public, anon;
revoke all on function public.edw_send_invite(uuid, text) from public, anon;
revoke all on function public.edw_dismiss_invite(bigint) from public, anon;

grant execute on function public.edw_sync_profile(text) to authenticated;
grant execute on function public.edw_find_user(text) to authenticated;
grant execute on function public.edw_send_request(uuid) to authenticated;
grant execute on function public.edw_respond_request(bigint, boolean) to authenticated;
grant execute on function public.edw_friends() to authenticated;
grant execute on function public.edw_remove_friend(uuid) to authenticated;
grant execute on function public.edw_inbox() to authenticated;
grant execute on function public.edw_send_invite(uuid, text) to authenticated;
grant execute on function public.edw_dismiss_invite(bigint) to authenticated;
revoke all on function public.edw_dismiss_notice(bigint) from public, anon;
grant execute on function public.edw_dismiss_notice(bigint) to authenticated;
