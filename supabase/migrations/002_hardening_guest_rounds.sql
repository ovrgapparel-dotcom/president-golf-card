-- PRESIDENT GOLF — migration 002
-- Hardening of 001 + provisional course data + server-only guest-round RPCs.
-- Safe to re-run (idempotent where practical).

-- ===================================================================
-- 1. DATA STATUS (provisional vs verified) — never silently official
-- ===================================================================
alter table public.holes
  add column if not exists data_status text not null default 'PROVISIONAL'
    check (data_status in ('PROVISIONAL','VERIFIED')),
  add column if not exists data_source text;
alter table public.holes alter column par drop not null;

alter table public.hole_tee_distances
  add column if not exists data_status text not null default 'PROVISIONAL'
    check (data_status in ('PROVISIONAL','VERIFIED'));

alter table public.tee_sets
  add column if not exists ratings_status text not null default 'MISSING'
    check (ratings_status in ('MISSING','PROVISIONAL','VERIFIED'));

-- Known discrepancies awaiting a club decision. Unresolved flags block "official" status.
create table if not exists public.course_data_flags (
  id uuid primary key default gen_random_uuid(),
  scope text not null,
  message text not null,
  resolved boolean not null default false,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
alter table public.course_data_flags enable row level security;
drop policy if exists "club admins manage course flags" on public.course_data_flags;
create policy "club admins manage course flags" on public.course_data_flags
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());

-- ===================================================================
-- 2. SECURITY FIXES
-- ===================================================================
-- 2.1 Users must not be able to change their own role.
drop policy if exists "users update own profile" on public.profiles;
create policy "users update own profile" on public.profiles
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and role = public.current_user_role());

-- 2.2 Auto-create a PLAYER profile at signup (never anything higher).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (user_id, display_name, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email,'@',1)), 'PLAYER')
  on conflict (user_id) do nothing;
  return new;
end $$;
-- (auth.users trigger is created in Supabase only; see bottom of file.)

-- 2.3 Round data is written ONLY by trusted server code (service role / RPC).
--     Remove direct client write policies; keep read policies.
drop policy if exists "authorized create game sessions" on public.game_sessions;
drop policy if exists "authorized update game sessions" on public.game_sessions;
drop policy if exists "authorized manage session players" on public.session_players;
drop policy if exists "authorized manage scores" on public.hole_scores;

-- ===================================================================
-- 3. SCORE INTEGRITY TRIGGERS (version, lock, audit trail)
-- ===================================================================
alter table public.score_events
  add column if not exists actor_session_player_id uuid;

create or replace function public.hole_scores_guard()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' then
    if old.status = 'LOCKED' then
      raise exception 'SCORE_LOCKED' using errcode = 'P0001';
    end if;
    if old.status = 'CONFIRMED'
       and coalesce(current_setting('app.reopen', true), '') <> 'on'
       and (new.strokes is distinct from old.strokes or new.putts is distinct from old.putts) then
      raise exception 'SCORE_CONFIRMED' using errcode = 'P0001';
    end if;
    new.version := old.version + 1;
  end if;
  return new;
end $$;

create or replace function public.hole_scores_audit()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.score_events (hole_score_id, actor_user_id, actor_session_player_id, event_type, previous_value, new_value)
  values (
    new.id,
    auth.uid(),
    nullif(current_setting('app.actor_sp', true), '')::uuid,
    case when tg_op = 'INSERT' then 'CREATED' else 'UPDATED' end,
    case when tg_op = 'UPDATE' then jsonb_build_object('strokes', old.strokes, 'putts', old.putts, 'status', old.status, 'version', old.version) end,
    jsonb_build_object('strokes', new.strokes, 'putts', new.putts, 'status', new.status, 'version', new.version)
  );
  return new;
end $$;

drop trigger if exists hole_scores_guard_trg on public.hole_scores;
create trigger hole_scores_guard_trg before update on public.hole_scores
  for each row execute function public.hole_scores_guard();

drop trigger if exists hole_scores_audit_trg on public.hole_scores;
create trigger hole_scores_audit_trg after insert or update on public.hole_scores
  for each row execute function public.hole_scores_audit();

-- ===================================================================
-- 4. SERVER-ONLY GUEST ROUND RPCs
--    Called by Next.js route handlers with the service-role key.
--    The raw token never reaches the database; only its SHA-256 hash.
-- ===================================================================
create or replace function public._guest_session(p_session_id uuid, p_hash text)
returns public.game_sessions language plpgsql security definer set search_path = public as $$
declare s public.game_sessions;
begin
  select * into s from public.game_sessions where id = p_session_id;
  if not found or s.guest_token_hash is null or p_hash is null or s.guest_token_hash <> p_hash then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  return s;
end $$;

create or replace function public._round_json(p_session_id uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', s.id,
    'status', s.status,
    'teeCode', t.code,
    'startHole', s.start_hole,
    'gameFormat', s.game_format,
    'createdAt', s.created_at,
    'players', coalesce((
      select jsonb_agg(jsonb_build_object('id', sp.id, 'name', p.display_name, 'order', sp.playing_order) order by sp.playing_order)
      from public.session_players sp join public.players p on p.id = sp.player_id
      where sp.session_id = s.id), '[]'::jsonb),
    'scores', coalesce((
      select jsonb_agg(jsonb_build_object(
        'playerId', hs.session_player_id, 'hole', hs.hole_number, 'strokes', hs.strokes,
        'putts', hs.putts, 'status', hs.status, 'version', hs.version))
      from public.hole_scores hs join public.session_players sp on sp.id = hs.session_player_id
      where sp.session_id = s.id), '[]'::jsonb)
  )
  from public.game_sessions s join public.tee_sets t on t.id = s.tee_set_id
  where s.id = p_session_id
$$;

create or replace function public.create_guest_round(
  p_token_hash text, p_tee_code text, p_start_hole int, p_players text[]
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_tee uuid; v_session uuid; v_player uuid; v_name text; v_i int := 0;
begin
  if p_token_hash is null or length(p_token_hash) < 32 then raise exception 'BAD_REQUEST' using errcode = 'P0001'; end if;
  if coalesce(array_length(p_players, 1), 0) not between 1 and 8 then raise exception 'BAD_REQUEST' using errcode = 'P0001'; end if;
  select id into v_tee from public.tee_sets where code = p_tee_code;
  if v_tee is null then raise exception 'BAD_REQUEST' using errcode = 'P0001'; end if;

  insert into public.game_sessions (guest_token_hash, tee_set_id, start_hole)
  values (p_token_hash, v_tee, p_start_hole) returning id into v_session;

  foreach v_name in array p_players loop
    v_name := btrim(v_name);
    if length(v_name) not between 1 and 60 then raise exception 'BAD_REQUEST' using errcode = 'P0001'; end if;
    v_i := v_i + 1;
    insert into public.players (display_name, is_guest) values (v_name, true) returning id into v_player;
    insert into public.session_players (session_id, player_id, playing_order) values (v_session, v_player, v_i);
  end loop;
  return public._round_json(v_session);
end $$;

create or replace function public.get_guest_round(p_session_id uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  perform public._guest_session(p_session_id, p_hash);
  return public._round_json(p_session_id);
end $$;

create or replace function public.add_guest_player(p_session_id uuid, p_hash text, p_name text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.game_sessions; v_player uuid; v_count int; v_name text := btrim(p_name);
begin
  s := public._guest_session(p_session_id, p_hash);
  if s.status <> 'IN_PROGRESS' then raise exception 'ROUND_CLOSED' using errcode = 'P0001'; end if;
  if length(v_name) not between 1 and 60 then raise exception 'BAD_REQUEST' using errcode = 'P0001'; end if;
  select count(*) into v_count from public.session_players where session_id = s.id;
  if v_count >= 8 then raise exception 'BAD_REQUEST' using errcode = 'P0001'; end if;
  insert into public.players (display_name, is_guest) values (v_name, true) returning id into v_player;
  insert into public.session_players (session_id, player_id, playing_order) values (s.id, v_player, v_count + 1);
  return public._round_json(s.id);
end $$;

-- Optimistic-concurrency upsert. expected_version 0 = "I believe no score exists yet".
create or replace function public.upsert_hole_score(
  p_session_id uuid, p_hash text, p_session_player_id uuid, p_hole int,
  p_strokes int, p_putts int, p_expected_version int
) returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.game_sessions; cur public.hole_scores; res public.hole_scores;
begin
  s := public._guest_session(p_session_id, p_hash);
  if s.status <> 'IN_PROGRESS' then raise exception 'ROUND_CLOSED' using errcode = 'P0001'; end if;
  if p_hole not between 1 and 18 or (p_strokes is not null and p_strokes not between 1 and 25)
     or (p_putts is not null and p_putts not between 0 and 10) then
    raise exception 'BAD_REQUEST' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.session_players where id = p_session_player_id and session_id = s.id) then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  perform set_config('app.actor_sp', p_session_player_id::text, true);

  select * into cur from public.hole_scores
   where session_player_id = p_session_player_id and hole_number = p_hole for update;

  if not found then
    if p_expected_version <> 0 then
      return jsonb_build_object('ok', false, 'error', 'CONFLICT', 'server', null);
    end if;
    insert into public.hole_scores (session_player_id, hole_number, strokes, putts, status)
    values (p_session_player_id, p_hole, p_strokes, p_putts, case when p_strokes is null then 'PENDING' else 'ENTERED' end)
    returning * into res;
  else
    if cur.status in ('CONFIRMED','LOCKED') then
      return jsonb_build_object('ok', false, 'error', 'LOCKED', 'server',
        jsonb_build_object('strokes', cur.strokes, 'putts', cur.putts, 'status', cur.status, 'version', cur.version));
    end if;
    if cur.version <> p_expected_version then
      return jsonb_build_object('ok', false, 'error', 'CONFLICT', 'server',
        jsonb_build_object('strokes', cur.strokes, 'putts', cur.putts, 'status', cur.status, 'version', cur.version));
    end if;
    update public.hole_scores
       set strokes = p_strokes, putts = p_putts,
           status = case when p_strokes is null then 'PENDING' else 'ENTERED' end
     where id = cur.id returning * into res;
  end if;

  return jsonb_build_object('ok', true, 'score', jsonb_build_object(
    'playerId', res.session_player_id, 'hole', res.hole_number, 'strokes', res.strokes,
    'putts', res.putts, 'status', res.status, 'version', res.version));
end $$;

create or replace function public.submit_guest_round(p_session_id uuid, p_hash text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare s public.game_sessions;
begin
  s := public._guest_session(p_session_id, p_hash);
  if s.status = 'IN_PROGRESS' then
    update public.game_sessions set status = 'SUBMITTED', completed_at = now() where id = s.id;
  end if;
  return public._round_json(s.id);
end $$;

-- Only the service role may call these. Never anon/authenticated.
do $$
declare f text;
begin
  foreach f in array array[
    '_guest_session(uuid,text)', '_round_json(uuid)',
    'create_guest_round(text,text,int,text[])', 'get_guest_round(uuid,text)',
    'add_guest_player(uuid,text,text)',
    'upsert_hole_score(uuid,text,uuid,int,int,int,int)', 'submit_guest_round(uuid,text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon, authenticated', f);
    execute format('grant execute on function public.%s to service_role', f);
  end loop;
end $$;

-- ===================================================================
-- 5. PROVISIONAL COURSE DATA — transcribed from the scanned card (dated 20/03/2021)
--    NOT verified. data_status stays PROVISIONAL until a club admin confirms.
-- ===================================================================
update public.holes h set
  par = v.par, handicap_index = v.si, data_status = 'PROVISIONAL', data_source = 'SCANNED_CARD_UNVERIFIED'
from (values
  (1,5,6),(2,3,16),(3,4,1),(4,4,12),(5,5,9),(6,3,17),(7,4,5),(8,4,7),(9,4,4),
  (10,5,10),(11,4,11),(12,3,13),(13,4,14),(14,5,8),(15,4,18),(16,4,3),(17,3,15),(18,4,2)
) as v(n,par,si)
where h.hole_number = v.n and h.data_status = 'PROVISIONAL';

update public.holes set notes = 'Règle locale n°4 (scan, non vérifiée) : balle dans l''eau / sur l''île — dropping zone en arrière du green, à droite et à gauche.'
where hole_number = 12 and notes is null;

update public.hole_tee_distances d set distance_m = v.dist, data_status = 'PROVISIONAL'
from public.tee_sets t,
(values
  (1,504,485,476,418),(2,131,119,107,107),(3,409,394,371,371),(4,340,320,295,295),(5,478,452,417,407),
  (6,162,149,137,137),(7,386,368,356,347),(8,298,282,272,272),(9,392,375,336,336),
  (10,502,470,456,439),(11,306,294,281,281),(12,184,136,120,106),(13,318,310,246,246),(14,461,446,376,376),
  (15,287,271,259,253),(16,333,317,297,297),(17,125,108,93,93),(18,396,384,326,326)
) as x(n,w,y,b,r),
lateral (values ('WHITE',x.w),('YELLOW',x.y),('BLUE',x.b),('RED',x.r)) as v(code,dist)
where d.hole_number = x.n and d.tee_set_id = t.id and t.code = v.code
  and d.data_status = 'PROVISIONAL' and d.distance_m is null;

insert into public.course_data_flags (scope, message)
select * from (values
  ('BLUE / Retour', 'Total imprimé 2 554 m, somme des trous 2 454 m (le total général 5 221 m correspond à 2 454). Probable coquille d''impression.'),
  ('WHITE / Aller', 'Total imprimé 3 103 m, somme des trous 3 100 m (écart 3 m).'),
  ('RED / Retour', 'Total imprimé 2 410 m, somme des trous 2 417 m (écart 7 m) — transcription à revérifier sur l''original.'),
  ('ALL', 'Course Rating, Slope Rating, coordonnées GPS et URL Matterport non fournis.')
) as v(scope, message)
where not exists (select 1 from public.course_data_flags);

-- ===================================================================
-- 6. READINESS CHECKLIST — official features stay blocked until all true
-- ===================================================================
create or replace view public.v_course_readiness as
select
  (select count(*) from public.holes where par is not null and data_status = 'VERIFIED') = 18 as par_verified,
  (select count(*) from public.holes where handicap_index is not null and data_status = 'VERIFIED') = 18 as stroke_index_verified,
  (select count(*) from public.hole_tee_distances where distance_m is not null and data_status = 'VERIFIED') = 72 as distances_verified,
  (select count(*) from public.tee_sets where course_rating is not null and slope_rating is not null and ratings_status = 'VERIFIED') = 4 as ratings_verified,
  (select count(*) from public.holes where latitude is not null and green_latitude is not null) = 18 as gps_complete,
  (select count(*) from public.holes where matterport_url is not null) = 18 as matterport_complete,
  not exists (select 1 from public.course_data_flags where not resolved) as no_open_flags;

create or replace view public.v_course_official_ready as
select (par_verified and stroke_index_verified and distances_verified and ratings_verified and no_open_flags) as official_ready
from public.v_course_readiness;

revoke all on public.v_course_readiness, public.v_course_official_ready from public, anon;
grant select on public.v_course_readiness, public.v_course_official_ready to authenticated, service_role;

-- ===================================================================
-- 7. SUPABASE-ONLY: signup trigger (auth.users is owned by Supabase)
-- ===================================================================
do $$
begin
  if exists (select 1 from information_schema.tables where table_schema = 'auth' and table_name = 'users') then
    drop trigger if exists on_auth_user_created on auth.users;
    create trigger on_auth_user_created after insert on auth.users
      for each row execute function public.handle_new_user();
  end if;
end $$;
