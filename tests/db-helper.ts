import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import { readFileSync } from "fs";
import { join } from "path";

// Minimal stand-ins for Supabase's roles and auth schema so the real migrations run unchanged.
const SUPABASE_STUBS = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create schema auth;
  create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth, public to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

export async function freshDb() {
  const db = new PGlite({ extensions: { pgcrypto } });
  await db.exec(SUPABASE_STUBS);
  for (const f of ["001_foundation.sql", "002_hardening_guest_rounds.sql"]) {
    await db.exec(readFileSync(join(__dirname, "../supabase/migrations", f), "utf8"));
  }
  await db.exec(`
    grant select, insert, update, delete on all tables in schema public to authenticated, service_role;
    grant select on all tables in schema public to anon;`);
  return db;
}
