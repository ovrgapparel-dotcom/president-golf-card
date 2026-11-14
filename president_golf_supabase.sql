-- PRESIDENT GOLF DE YAMOUSSOUKRO
-- Supabase / PostgreSQL foundation
-- Version: MVP foundation
-- IMPORTANT: unverified hole-level distances, GPS coordinates, ratings and Matterport URLs
-- are intentionally NULL and must be completed from validated club data.

create extension if not exists pgcrypto;

-- -------------------------------------------------------------------
-- 1. CLUB CONFIGURATION (single-club deployment; no multi-golf logic)
-- -------------------------------------------------------------------
create table if not exists public.club_settings (
  id uuid primary key default gen_random_uuid(),
  club_name text not null default 'President Golf de Yamoussoukro',
  country_code char(2) not null default 'CI',
  currency_code char(3) not null default 'XOF',
  timezone text not null default 'Africa/Abidjan',
  hole_count smallint not null default 18 check (hole_count = 18),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tee colors are fixed for this installation.
create table if not exists public.tee_sets (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('WHITE','YELLOW','BLUE','RED')),
  label text not null,
  display_order smallint not null unique,
  total_distance_m integer,
  course_rating numeric(4,1),
  slope_rating smallint,
  created_at timestamptz not null default now(),
  check (total_distance_m is null or total_distance_m > 0),
  check (course_rating is null or course_rating between 50 and 90),
  check (slope_rating is null or slope_rating between 55 and 155)
);

create table if not exists public.holes (
  hole_number smallint primary key check (hole_number between 1 and 18),
  par smallint not null check (par between 3 and 6),
  handicap_index smallint check (handicap_index between 1 and 18),
  hole_name text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  green_latitude numeric(10,7),
  green_longitude numeric(10,7),
  matterport_url text,
  notes text,
  updated_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null)),
  check ((green_latitude is null) = (green_longitude is null))
);

create table if not exists public.hole_tee_distances (
  hole_number smallint not null references public.holes(hole_number) on delete cascade,
  tee_set_id uuid not null references public.tee_sets(id) on delete restrict,
  distance_m integer check (distance_m is null or distance_m > 0),
  primary key (hole_number, tee_set_id)
);

create table if not exists public.hole_features (
  id uuid primary key default gen_random_uuid(),
  hole_number smallint not null references public.holes(hole_number) on delete cascade,
  feature_type text not null check (feature_type in
    ('FAIRWAY','GREEN','BUNKER','WATER','OB','TEE_BOX','LANDMARK','OTHER')),
  label text,
  latitude numeric(10,7),
  longitude numeric(10,7),
  description text,
  created_at timestamptz not null default now(),
  check ((latitude is null) = (longitude is null))
);

-- -------------------------------------------------------------------
-- 2. USER ROLES / PLAYER IDENTITY
-- -------------------------------------------------------------------
create table if not exists public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  role text not null default 'PLAYER' check (role in ('PLAYER','SCORER','TOURNAMENT_ADMIN','CLUB_ADMIN')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  linked_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  phone text,
  handicap_index numeric(4,1),
  is_guest boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (handicap_index is null or handicap_index between -10 and 54)
);

create index if not exists players_name_idx on public.players (lower(display_name));
create index if not exists players_linked_user_idx on public.players(linked_user_id);

-- -------------------------------------------------------------------
-- 3. GAME SESSIONS / SCORECARDS
-- -------------------------------------------------------------------
create table if not exists public.game_sessions (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references auth.users(id) on delete set null,
  guest_token_hash text,
  session_type text not null default 'CASUAL' check (session_type in ('CASUAL','TOURNAMENT')),
  game_format text not null default 'STROKE_PLAY' check (game_format in
    ('STROKE_PLAY','STROKE_PLAY_NET','STABLEFORD','MATCH_PLAY',
     'FOURBALL','FOURSOMES','SCRAMBLE')),
  tee_set_id uuid not null references public.tee_sets(id),
  start_hole smallint not null default 1 check (start_hole between 1 and 18),
  status text not null default 'IN_PROGRESS' check (status in
    ('DRAFT','IN_PROGRESS','SUBMITTED','VALIDATED','CANCELLED')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  is_live boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (created_by is not null or guest_token_hash is not null)
);

create index if not exists game_sessions_status_idx on public.game_sessions(status, started_at desc);

create table if not exists public.session_players (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  playing_handicap integer,
  playing_order smallint not null default 1,
  team_label text,
  is_marker boolean not null default false,
  joined_at timestamptz not null default now(),
  unique (session_id, player_id),
  check (playing_handicap is null or playing_handicap between -20 and 99)
);

create table if not exists public.hole_scores (
  id uuid primary key default gen_random_uuid(),
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  hole_number smallint not null references public.holes(hole_number),
  strokes smallint check (strokes is null or strokes between 1 and 25),
  putts smallint check (putts is null or putts between 0 and 10),
  fairway_hit boolean,
  green_in_regulation boolean,
  penalty_strokes smallint not null default 0 check (penalty_strokes between 0 and 10),
  status text not null default 'PENDING' check (status in ('PENDING','ENTERED','CONFIRMED','LOCKED')),
  entered_by uuid references auth.users(id) on delete set null,
  confirmed_by uuid references auth.users(id) on delete set null,
  confirmed_at timestamptz,
  version integer not null default 1,
  updated_at timestamptz not null default now(),
  unique (session_player_id, hole_number),
  check (putts is null or strokes is null or putts <= strokes)
);

create index if not exists hole_scores_player_idx on public.hole_scores(session_player_id, hole_number);

create table if not exists public.score_events (
  id uuid primary key default gen_random_uuid(),
  hole_score_id uuid not null references public.hole_scores(id) on delete cascade,
  actor_user_id uuid references auth.users(id) on delete set null,
  event_type text not null check (event_type in ('CREATED','UPDATED','CONFIRMED','LOCKED','REOPENED')),
  previous_value jsonb,
  new_value jsonb,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- 4. TOURNAMENTS
-- -------------------------------------------------------------------
create table if not exists public.competitions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  competition_format text not null check (competition_format in
    ('STROKE_PLAY','STROKE_PLAY_NET','STABLEFORD','MATCH_PLAY','FOURBALL','FOURSOMES','SCRAMBLE')),
  status text not null default 'DRAFT' check (status in
    ('DRAFT','REGISTRATION','IN_PROGRESS','COMPLETED','CANCELLED')),
  start_date date not null,
  end_date date not null,
  tee_set_id uuid not null references public.tee_sets(id),
  max_players integer check (max_players is null or max_players > 0),
  created_by uuid references auth.users(id) on delete set null,
  rules jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (end_date >= start_date)
);

create table if not exists public.competition_entries (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete restrict,
  entry_status text not null default 'REGISTERED' check (entry_status in
    ('REGISTERED','CONFIRMED','WITHDRAWN','DISQUALIFIED')),
  playing_handicap integer,
  category text,
  created_at timestamptz not null default now(),
  unique (competition_id, player_id)
);

create table if not exists public.flights (
  id uuid primary key default gen_random_uuid(),
  competition_id uuid not null references public.competitions(id) on delete cascade,
  flight_name text not null,
  start_hole smallint not null default 1 check (start_hole between 1 and 18),
  tee_time timestamptz,
  start_mode text not null default 'TEE_TIME' check (start_mode in ('TEE_TIME','SHOTGUN')),
  created_at timestamptz not null default now(),
  unique (competition_id, flight_name)
);

create table if not exists public.flight_players (
  flight_id uuid not null references public.flights(id) on delete cascade,
  competition_entry_id uuid not null references public.competition_entries(id) on delete cascade,
  playing_order smallint not null default 1,
  primary key (flight_id, competition_entry_id),
  unique (competition_entry_id)
);

create table if not exists public.score_validations (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.game_sessions(id) on delete cascade,
  validated_by uuid references auth.users(id) on delete set null,
  validation_status text not null check (validation_status in ('SUBMITTED','APPROVED','REJECTED')),
  comments text,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- 5. GPS TRACKS / PRIVACY
-- -------------------------------------------------------------------
create table if not exists public.player_location_preferences (
  player_id uuid primary key references public.players(id) on delete cascade,
  tracking_enabled boolean not null default false,
  share_with_group boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.gps_tracks (
  id bigint generated always as identity primary key,
  session_player_id uuid not null references public.session_players(id) on delete cascade,
  latitude numeric(10,7) not null,
  longitude numeric(10,7) not null,
  accuracy_m numeric(8,2),
  recorded_at timestamptz not null default now(),
  check (latitude between -90 and 90),
  check (longitude between -180 and 180),
  check (accuracy_m is null or accuracy_m >= 0)
);

create index if not exists gps_tracks_player_time_idx on public.gps_tracks(session_player_id, recorded_at desc);

-- -------------------------------------------------------------------
-- 6. AUDIT LOG
-- -------------------------------------------------------------------
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  action text not null,
  table_name text not null,
  record_id text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- -------------------------------------------------------------------
-- 7. UPDATED_AT TRIGGER
-- -------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['club_settings','profiles','players','game_sessions','hole_scores','competitions'] loop
    execute format('drop trigger if exists set_updated_at on public.%I', t);
    execute format('create trigger set_updated_at before update on public.%I for each row execute function public.set_updated_at()', t);
  end loop;
end $$;

-- -------------------------------------------------------------------
-- 8. ROLE HELPERS
-- -------------------------------------------------------------------
create or replace function public.current_user_role()
returns text language sql stable security definer
set search_path = public
as $$
  select role from public.profiles where user_id = auth.uid()
$$;

create or replace function public.is_club_admin()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() = 'CLUB_ADMIN', false)
$$;

create or replace function public.can_manage_scores()
returns boolean language sql stable security definer
set search_path = public
as $$
  select coalesce(public.current_user_role() in ('SCORER','TOURNAMENT_ADMIN','CLUB_ADMIN'), false)
$$;

-- -------------------------------------------------------------------
-- 9. ROW LEVEL SECURITY
-- MVP SECURITY POSTURE:
-- - Public read for static course data.
-- - Authenticated users read/update their own profile.
-- - Club admins manage master data and competitions.
-- - Game-session writes are server-mediated (Edge Functions / Next.js server
--   using service role) to protect guest tokens and score integrity.
-- - GPS is never publicly readable.
-- -------------------------------------------------------------------
alter table public.club_settings enable row level security;
alter table public.tee_sets enable row level security;
alter table public.holes enable row level security;
alter table public.hole_tee_distances enable row level security;
alter table public.hole_features enable row level security;
alter table public.profiles enable row level security;
alter table public.players enable row level security;
alter table public.game_sessions enable row level security;
alter table public.session_players enable row level security;
alter table public.hole_scores enable row level security;
alter table public.score_events enable row level security;
alter table public.competitions enable row level security;
alter table public.competition_entries enable row level security;
alter table public.flights enable row level security;
alter table public.flight_players enable row level security;
alter table public.score_validations enable row level security;
alter table public.player_location_preferences enable row level security;
alter table public.gps_tracks enable row level security;
alter table public.audit_logs enable row level security;

-- Public course configuration
create policy "public read club settings" on public.club_settings for select using (true);
create policy "public read tee sets" on public.tee_sets for select using (true);
create policy "public read holes" on public.holes for select using (true);
create policy "public read hole tee distances" on public.hole_tee_distances for select using (true);
create policy "public read hole features" on public.hole_features for select using (true);

-- Admin-only master-data writes
create policy "club admins manage settings" on public.club_settings
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());
create policy "club admins manage tees" on public.tee_sets
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());
create policy "club admins manage holes" on public.holes
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());
create policy "club admins manage distances" on public.hole_tee_distances
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());
create policy "club admins manage features" on public.hole_features
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());

-- Profiles
create policy "users read own profile" on public.profiles
  for select to authenticated using (user_id = auth.uid() or public.is_club_admin());
create policy "users update own profile" on public.profiles
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "club admins manage profiles" on public.profiles
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());

-- Players: public read is intentionally not enabled; server endpoints control guest access.
create policy "players read self or admins" on public.players
  for select to authenticated using (linked_user_id = auth.uid() or public.can_manage_scores());
create policy "club admins manage players" on public.players
  for all to authenticated using (public.is_club_admin()) with check (public.is_club_admin());

-- Operational data: authenticated management roles only; guest operations go through server endpoints.
create policy "authorized read game sessions" on public.game_sessions
  for select to authenticated using (
    created_by = auth.uid() or public.can_manage_scores()
  );
create policy "authorized create game sessions" on public.game_sessions
  for insert to authenticated with check (created_by = auth.uid() or public.can_manage_scores());
create policy "authorized update game sessions" on public.game_sessions
  for update to authenticated using (created_by = auth.uid() or public.can_manage_scores())
  with check (created_by = auth.uid() or public.can_manage_scores());

create policy "authorized read session players" on public.session_players
  for select to authenticated using (
    exists (select 1 from public.game_sessions s where s.id = session_id
      and (s.created_by = auth.uid() or public.can_manage_scores()))
  );
create policy "authorized manage session players" on public.session_players
  for all to authenticated using (
    exists (select 1 from public.game_sessions s where s.id = session_id
      and (s.created_by = auth.uid() or public.can_manage_scores()))
  ) with check (
    exists (select 1 from public.game_sessions s where s.id = session_id
      and (s.created_by = auth.uid() or public.can_manage_scores()))
  );

create policy "authorized read scores" on public.hole_scores
  for select to authenticated using (
    exists (select 1 from public.session_players sp join public.game_sessions s on s.id = sp.session_id
      where sp.id = session_player_id and (s.created_by = auth.uid() or public.can_manage_scores()))
  );
create policy "authorized manage scores" on public.hole_scores
  for all to authenticated using (
    exists (select 1 from public.session_players sp join public.game_sessions s on s.id = sp.session_id
      where sp.id = session_player_id and (s.created_by = auth.uid() or public.can_manage_scores()))
  ) with check (
    exists (select 1 from public.session_players sp join public.game_sessions s on s.id = sp.session_id
      where sp.id = session_player_id and (s.created_by = auth.uid() or public.can_manage_scores()))
  );

create policy "authorized read score events" on public.score_events
  for select to authenticated using (public.can_manage_scores());
create policy "authorized read competitions" on public.competitions
  for select using (status <> 'DRAFT' or public.can_manage_scores());
create policy "admins manage competitions" on public.competitions
  for all to authenticated using (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'))
  with check (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'));

create policy "authorized read competition entries" on public.competition_entries
  for select to authenticated using (public.can_manage_scores());
create policy "admins manage competition entries" on public.competition_entries
  for all to authenticated using (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'))
  with check (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'));

create policy "authorized read flights" on public.flights
  for select to authenticated using (public.can_manage_scores());
create policy "admins manage flights" on public.flights
  for all to authenticated using (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'))
  with check (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'));

create policy "authorized read flight players" on public.flight_players
  for select to authenticated using (public.can_manage_scores());
create policy "admins manage flight players" on public.flight_players
  for all to authenticated using (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'))
  with check (public.current_user_role() in ('TOURNAMENT_ADMIN','CLUB_ADMIN'));

create policy "authorized read validations" on public.score_validations
  for select to authenticated using (public.can_manage_scores());
create policy "authorized create validations" on public.score_validations
  for insert to authenticated with check (public.can_manage_scores());

-- Location data is private by default. No client-side public read policy.
create policy "player manages own location preferences" on public.player_location_preferences
  for all to authenticated using (
    exists (select 1 from public.players p where p.id = player_id and p.linked_user_id = auth.uid())
    or public.is_club_admin()
  ) with check (
    exists (select 1 from public.players p where p.id = player_id and p.linked_user_id = auth.uid())
    or public.is_club_admin()
  );

create policy "gps readable by admins only" on public.gps_tracks
  for select to authenticated using (public.is_club_admin());
create policy "gps insert by server only" on public.gps_tracks
  for insert to authenticated with check (false);

create policy "audit readable by admins" on public.audit_logs
  for select to authenticated using (public.is_club_admin());

-- -------------------------------------------------------------------
-- 10. INITIAL SEED DATA
-- PAR and tee totals based on preliminary scorecard review.
-- Hole-by-hole PAR / yardages must be checked against the signed-off scorecard.
-- If the club confirms a different PAR distribution, update holes before launch.
-- -------------------------------------------------------------------
insert into public.club_settings (club_name)
select 'President Golf de Yamoussoukro'
where not exists (select 1 from public.club_settings);

insert into public.tee_sets (code, label, display_order, total_distance_m)
values
  ('WHITE','Blancs',1,6015),
  ('YELLOW','Jaunes',2,5680),
  ('BLUE','Bleus',3,5221),
  ('RED','Rouges',4,5100)
on conflict (code) do update set
  label = excluded.label,
  display_order = excluded.display_order,
  total_distance_m = excluded.total_distance_m;

-- Placeholder: all 18 holes created with PAR 4 as a temporary value.
-- Replace each PAR with the official scorecard value before production.
insert into public.holes (hole_number, par)
select n, 4 from generate_series(1,18) as n
on conflict (hole_number) do nothing;

insert into public.hole_tee_distances (hole_number, tee_set_id, distance_m)
select h.hole_number, t.id, null
from public.holes h cross join public.tee_sets t
on conflict (hole_number, tee_set_id) do nothing;

-- -------------------------------------------------------------------
-- 11. SERVER/API IMPLEMENTATION NOTES
-- -------------------------------------------------------------------
-- Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
-- Guest session creation, guest-token verification, score submission,
-- score confirmation, and GPS writes must go through trusted server routes
-- or Supabase Edge Functions. Store only a hash of guest access tokens.
-- Validate session membership and token on every guest request.
-- Add optimistic concurrency: update hole_scores only when version = client_version,
-- then increment version; reject stale updates and return the latest server row.
-- For score changes, insert a score_events record in the same transaction.
-- Apply stricter production policies after integration tests; this script is
-- a secure starting posture, not a substitute for endpoint-level authorization.
