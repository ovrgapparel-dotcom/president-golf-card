# President Golf — Next.js + Supabase

Mobile-first scorecard for President Golf de Yamoussoukro (single club, 18 holes).
Guests play without an account; rounds are stored server-side and keyed by a secret guest token.

## Run
```bash
npm install
cp .env.example .env.local     # fill the 3 Supabase variables
npm run dev
npm run check                  # typecheck + lint + tests + build
```
Without Supabase variables the app still works in **local-only mode** (scores kept on the device;
the API answers 503 `NOT_CONFIGURED` and the UI falls back automatically).

## Supabase setup
1. Create a project, then run in the SQL editor, in order:
   `supabase/migrations/001_foundation.sql` → `supabase/migrations/002_hardening_guest_rounds.sql`
   (`president_golf_supabase.sql` at the root is the original 001, kept for reference only).
2. `.env.local`: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
   (server only — never prefix with `NEXT_PUBLIC_`).
3. Authentication is **not** needed for guest play. No Supabase Auth setup is required for Phase 1.

## How guest rounds are secured
- Server generates a 256-bit token, returns it **once**; only its SHA-256 hash is stored.
- The browser keeps the token in `localStorage` and sends it as `Authorization: Bearer <token>`
  (never in URLs or bodies, so it is not logged). Treat the device as the "key" to the round.
- All writes go through server-only SQL functions (`create_guest_round`, `upsert_hole_score`, …)
  callable by `service_role` only. Direct client writes to rounds/scores are removed by RLS.
- Wrong token, unknown round and foreign round are all the same `404`. DB errors are never echoed.
- Scores use optimistic concurrency (`version`); stale writes get `409 CONFLICT` with the server value,
  `CONFIRMED`/`LOCKED` scores can never be overwritten (trigger + RPC), every change is in `score_events`.
- Rate limits are in-memory (per instance). Use Upstash/Vercel KV before heavy production traffic.

## API
| Method | Route | Notes |
|---|---|---|
| POST | `/api/rounds` | create round → `{round, guestToken}` (token shown once) |
| GET | `/api/rounds/:id` | resume (Bearer token) |
| POST | `/api/rounds/:id/players` | add player (max 8) |
| PUT | `/api/rounds/:id/scores/:hole` | `{playerId, strokes, putts?, expectedVersion}`; `expectedVersion: 0` = first write |
| POST | `/api/rounds/:id/submit` | closes the round (`SUBMITTED`) |

## Offline / sync
Every score is saved locally first, queued, then pushed one at a time (`src/lib/round-sync.ts`).
States shown in the UI: saved on device · waiting · syncing · synced · conflict · failed.
Conflicts show both values and let the player choose. The queue lives in `localStorage` for now;
IndexedDB + service worker are Phase 4.

## Course data status (important)
Par, stroke index and tee distances are **PROVISIONAL**, transcribed from the scanned card dated 20/03/2021.
Nothing official is computed from them: `v_course_official_ready` is false until the club verifies
holes/distances, supplies Course & Slope Rating, and open flags in `course_data_flags` are resolved.
Known card discrepancies (flagged in the DB): Blue Retour printed 2 554 m vs holes sum 2 454 m;
White Aller printed 3 103 m vs 3 100 m; Red Retour printed 2 410 m vs 2 417 m.
Not supplied (kept NULL): Course/Slope Rating, GPS coordinates.

## 3D course explorer (Sketchfab — replaces Matterport)
- Route `/course`; component `src/components/course-3d-viewer.tsx`; config `src/lib/virtual-tour.ts`.
- Model URL is configurable: set `NEXT_PUBLIC_COURSE_3D_URL` (defaults to the club's model). Only https `sketchfab.com`
  URLs are accepted, and the iframe `src` is always rebuilt from the extracted model id.
- The iframe is attached only when the block nears the viewport, shows a loading state, and a "slow" message with a
  direct Sketchfab link after 15 s. Purely visual: independent from GPS, hole positions and scoring.
- The model is **not** assumed to be georeferenced or accurate; the page says so. `holes.matterport_url` is unused (kept NULL).

## Tests
`npm test` runs 50 tests. SQL tests run the real migrations in an in-process Postgres (PGlite) with stubbed
Supabase roles/`auth` schema, then exercise the service layer and the client sync end to end.
PGlite is not Supabase: do a final pass on a real project (RLS with real JWTs, `auth.users` signup trigger).

## Not built yet (by phase)
P1 remaining: course-data admin screen · marker confirmation UI · PWA icons/service worker.
P2: Supabase Auth + roles UI, competitions, leaderboard, validation workflow.
P3: map/GPS (3D explorer already done, kept separate). P4: IndexedDB queue, RLS/API authorization test pass on real Supabase, a11y/device tests.
