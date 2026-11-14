# President Golf — Claude Code build brief

## Mission

Build a production-minded MVP for the **President Golf de Yamoussoukro, Côte d’Ivoire**. This is a single-club application, not a multi-course marketplace or SaaS product.

The product digitizes the club’s 18-hole scorecard and provides group play, scoring, tournament administration, GPS course guidance, and a future Matterport virtual-tour integration.

## Fixed decisions

- One club only: President Golf de Yamoussoukro.
- Exactly 18 holes.
- Tee colors: White, Yellow, Blue, Red.
- Casual play must work without mandatory account creation.
- A player can create a scorecard for themselves or a group.
- Tournament and club administration require authenticated roles.
- Mobile-first responsive web app, installable as a PWA.
- Stack: Next.js App Router, React, TypeScript, Tailwind CSS, Supabase (PostgreSQL, Auth, Realtime, Storage as needed), Vercel.
- Map layer: MapLibre or Mapbox; use browser Geolocation API with explicit permission.
- Matterport is a separate embedded experience. The URL has not yet been supplied.
- Offline score entry is required; sync when connectivity returns.
- GPS sharing is off by default and must require explicit consent.

## Data integrity rules

Do not fabricate official golf data.

The following are preliminary scorecard observations and must be verified against the club-approved source before production:
- Total PAR appears to be 72.
- Preliminary tee totals: White 6,015 m; Yellow 5,680 m; Blue 5,221 m; Red 5,100 m.
- Hole-by-hole PAR and distances are not yet verified in machine-readable form.
- Course Rating and Slope Rating are not supplied.
- GPS coordinates for tees, greens, fairways and hazards are not supplied.
- Matterport URL is not supplied.

Use NULL or clearly marked draft placeholders for missing data. Never use placeholder values in official score calculations or tournament leaderboards. Add an admin readiness checklist that blocks publishing official competitions until required course data is validated.

## Product modules

### 1. Player experience
- Start a casual round as a guest.
- Select tee color and starting hole.
- Add one or more players to the same scorecard.
- Create player display names without requiring accounts.
- Enter strokes hole by hole, navigate 1–18, and view front nine, back nine and total.
- Display PAR, strokes, score relative to PAR, putts and optional fairway/GIR/penalty stats.
- Allow a marker to confirm scores.
- Show a clear round status: in progress, submitted, validated.
- Resume a guest round securely using a high-entropy guest token; store only its hash server-side.

### 2. Scoring engine
Implement the engine as tested domain logic, separate from UI and database access.
Support data structures and rules for:
- Stroke Play
- Stroke Play Net
- Stableford
- Match Play
- Fourball
- Foursomes
- Scramble

Do not assume that all formats can be fully automated in the first UI release. Implement Stroke Play first, then Net Stroke Play and Stableford. Keep other formats represented in the domain model and release them only after rule tests and product review.

Handicap calculations must be based on validated handicap/course data. Do not claim WHS-compliant Playing Handicap until the club supplies official Course Rating, Slope Rating, par and applicable handicap allowance.

### 3. Course map and GPS
- Display the President Golf course map with hole selection and the player’s current location.
- Ask for geolocation permission only after the user activates GPS.
- Show accuracy radius and timestamp; communicate that phone GPS is indicative, not an official distance-measuring device.
- Do not automatically decide the hole solely from GPS. Suggest a hole and ask the player to confirm.
- Tracking runs only while the round is active and the user has consented.
- Sharing location with playing partners is opt-in, revocable, and off by default.
- Do not promise background tracking reliability on mobile browsers.
- Provide a graceful fallback when location permission is denied or GPS is unavailable.
- Load validated coordinates from the course tables; do not invent map geometry.

### 4. Matterport
- Create a dedicated virtual-tour screen and optional per-hole Matterport URL field.
- Until the club supplies the URL, show a neutral “Visite virtuelle bientôt disponible” state.
- Do not infer that Matterport coordinates are geographically aligned with the GPS map.
- Keep Matterport integration isolated so it can be enabled by configuration later.

### 5. Tournament administration
- Authenticated admin roles: Club Admin, Tournament Admin, Scorer.
- Create competitions, dates, formats, tee set, categories, entries, flights, tee times or shotgun starts.
- Live leaderboard must identify provisional vs validated results.
- Provide score submission, marker confirmation, official validation and audit history.
- Never silently overwrite a locked/validated score.
- Keep a clear path to export results as CSV/PDF in a later iteration.

### 6. Offline-first scoring
- Cache course configuration and the active scorecard.
- Store pending score changes locally in IndexedDB.
- Queue writes while offline and sync on reconnect.
- Use version numbers / optimistic concurrency.
- On conflict, show the server and local values and ask for resolution; never silently overwrite a validated score.
- Show sync state clearly: saved locally, syncing, synced, conflict, failed.

## Required screens

1. Landing / Start a round
2. New round setup (tee, starting hole, player list)
3. Live scorecard
4. Hole detail / score entry
5. Round summary and leaderboard
6. GPS course map
7. Virtual tour (Matterport placeholder until URL is provided)
8. Tournament list and detail
9. Tournament registration / player entries
10. Admin dashboard
11. Course data administration
12. User / role administration
13. Offline and sync status

## Suggested server API boundaries

Use Next.js route handlers or Supabase Edge Functions. Every guest route must verify the raw guest token against its server-side hash and confirm that the requested session belongs to that token.

- `POST /api/rounds` — create guest or authenticated round
- `GET /api/rounds/:id` — retrieve authorized round and players
- `POST /api/rounds/:id/players` — add player
- `PUT /api/rounds/:id/scores/:hole` — upsert a player’s hole score with expected version
- `POST /api/rounds/:id/submit` — submit round
- `POST /api/rounds/:id/validate` — marker/admin validation
- `GET /api/competitions` — public published competitions
- `POST /api/admin/competitions` — create competition (admin)
- `POST /api/admin/competitions/:id/flights` — create flights
- `GET /api/competitions/:id/leaderboard` — provisional/validated leaderboard
- `POST /api/location/track` — consent-checked GPS point write
- `GET /api/course/map` — validated course geometry and features
- `GET /api/course/virtual-tour` — Matterport configuration

Never expose the Supabase service-role key in client code. Apply authorization at both the route/function layer and database layer. Validate all inputs with Zod or an equivalent schema validator. Rate-limit guest endpoints and avoid exposing guest tokens in logs or analytics.

## Database

Use `president_golf_supabase.sql` as the initial schema reference. Review and test it before applying to production. In particular:
- Replace temporary PAR placeholders with the approved 18-hole PAR distribution.
- Keep hole-level tee distances NULL until confirmed.
- Add official Course Rating and Slope Rating only when received from the club.
- Add verified GPS coordinates and course features only from club-approved mapping data.
- Do not enable official handicap calculations or official tournament status until required data is approved.
- Guest writes must be performed by trusted server endpoints; do not weaken RLS to make anonymous client writes work.

## Build sequence

### Phase 1 — Reliable scorecard
- Project setup, Supabase connection, schema and seed data.
- Course data admin screen.
- Guest round creation and group player management.
- Score entry, front/back nine totals and round summary.
- Unit tests for totals and score validation.

### Phase 2 — Accounts and competition
- Supabase Auth and role management.
- Tournament CRUD, entries, flights and tee times.
- Provisional leaderboard and validation workflow.
- Audit trail.

### Phase 3 — Map and virtual tour
- Map UI, validated course coordinates and GPS permission flow.
- Accuracy display, hole confirmation and privacy controls.
- Matterport embed behind a configuration flag.

### Phase 4 — Offline and hardening
- IndexedDB persistence and sync queue.
- Conflict handling and locked-score protection.
- RLS tests, API authorization tests, rate limiting, accessibility and device testing.

## Definition of done

- A guest can start a round without an account and add multiple players.
- Each player can enter scores for all 18 holes.
- Totals and relative-to-par values are correct for known PAR data.
- The app clearly distinguishes draft/unverified course data from approved data.
- A user can resume a guest round without exposing the guest token.
- A scorer/admin can validate a submitted scorecard.
- Tournament leaderboards distinguish provisional and validated results.
- GPS never activates without explicit user action and permission.
- GPS sharing is off by default.
- Offline score entries survive reload and sync safely.
- No official handicap or tournament claim is made from missing rating data.
- The app is usable on common Android and iOS mobile browsers.

## Claude Code execution instructions

Work in small, verifiable milestones. First inspect the repository and report its current structure before changing files. Then propose the implementation plan and identify missing environment variables. Do not overwrite existing working code without explaining why.

For each milestone:
1. State files to be created or changed.
2. Implement the smallest complete vertical slice.
3. Run type checks, lint and relevant tests.
4. Fix failures before moving on.
5. Summarize what works, what remains, and any assumptions.

Start by building Phase 1 only. Do not implement fabricated hole data, official handicap calculations, Matterport embedding with a guessed URL, or background GPS tracking.
