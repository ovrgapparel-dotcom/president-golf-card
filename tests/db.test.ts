import { describe, it, expect, beforeAll } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./db-helper";

let db: PGlite;
const H = "a".repeat(64);
const WRONG = "b".repeat(64);

async function rpc<T = any>(sql: string, params: unknown[] = []): Promise<T> {
  const r = await db.query<{ r: T }>(`select ${sql} as r`, params);
  return r.rows[0].r;
}
async function expectError(sql: string, params: unknown[], code: string) {
  await expect(db.query(`select ${sql}`, params)).rejects.toThrow(code);
}

beforeAll(async () => { db = await freshDb(); });

describe("seed data", () => {
  it("loads 18 provisional holes with scanned par summing to 36 + 36", async () => {
    const r = await db.query<{ front: number; back: number; n: number; v: number }>(
      `select sum(par) filter (where hole_number<=9)::int front, sum(par) filter (where hole_number>9)::int back,
              count(*)::int n, count(*) filter (where data_status='VERIFIED')::int v from holes`);
    expect(r.rows[0]).toEqual({ front: 36, back: 36, n: 18, v: 0 });
  });
  it("stroke indexes are a permutation of 1..18", async () => {
    const r = await db.query<{ ok: boolean }>(`select array_agg(handicap_index::int order by handicap_index) = array(select generate_series(1,18)) ok from holes`);
    expect(r.rows[0].ok).toBe(true);
  });
  it("distances loaded for 4 tees x 18 holes, all provisional", async () => {
    const r = await db.query<{ n: number; nulls: number; v: number }>(
      `select count(*)::int n, count(*) filter (where distance_m is null)::int nulls, count(*) filter (where data_status='VERIFIED')::int v from hole_tee_distances`);
    expect(r.rows[0]).toEqual({ n: 72, nulls: 0, v: 0 });
  });
  it("course is NOT official-ready (unverified data, no ratings, open flags)", async () => {
    const r = await db.query<{ official_ready: boolean }>(`select official_ready from v_course_official_ready`);
    expect(r.rows[0].official_ready).toBe(false);
    const c = await db.query<{ n: number }>(`select count(*)::int n from course_data_flags where not resolved`);
    expect(c.rows[0].n).toBe(4);
  });
  it("ratings are NULL (never invented)", async () => {
    const r = await db.query<{ n: number }>(`select count(*)::int n from tee_sets where course_rating is not null or slope_rating is not null`);
    expect(r.rows[0].n).toBe(0);
  });
});

describe("guest rounds", () => {
  let id: string; let p1: string; let p2: string;

  it("creates a round and returns players; stores only the hash", async () => {
    const round = await rpc(`create_guest_round($1,'YELLOW',1,array['Francis','Josué'])`, [H]);
    id = round.id; p1 = round.players[0].id; p2 = round.players[1].id;
    expect(round.players.map((p: any) => p.name)).toEqual(["Francis", "Josué"]);
    expect(round.teeCode).toBe("YELLOW");
    const s = await db.query<{ guest_token_hash: string }>(`select guest_token_hash from game_sessions where id=$1`, [id]);
    expect(s.rows[0].guest_token_hash).toBe(H);
  });
  it("rejects a wrong token, and an unknown session", async () => {
    await expectError(`get_guest_round($1,$2)`, [id, WRONG], "FORBIDDEN");
    await expectError(`get_guest_round(gen_random_uuid(),$1)`, [H], "FORBIDDEN");
    await expectError(`upsert_hole_score($1,$2,$3,1,4,null,0)`, [id, WRONG, p1], "FORBIDDEN");
  });
  it("rejects invalid input (tee, players, strokes, hole)", async () => {
    await expectError(`create_guest_round($1,'PURPLE',1,array['x'])`, [H], "BAD_REQUEST");
    await expectError(`create_guest_round($1,'RED',1,array[]::text[])`, [H], "BAD_REQUEST");
    await expectError(`create_guest_round($1,'RED',1,array['  '])`, [H], "BAD_REQUEST");
    await expectError(`upsert_hole_score($1,$2,$3,19,4,null,0)`, [id, H, p1], "BAD_REQUEST");
    await expectError(`upsert_hole_score($1,$2,$3,1,26,null,0)`, [id, H, p1], "BAD_REQUEST");
  });
  it("cannot score a player from another session with a valid token", async () => {
    const other = await rpc(`create_guest_round($1,'RED',1,array['Mallory'])`, [WRONG]);
    await expectError(`upsert_hole_score($1,$2,$3,1,4,null,0)`, [id, H, other.players[0].id], "FORBIDDEN");
  });
  it("first score: version 0 -> 1; update with right version -> 2; audit trail written", async () => {
    const a = await rpc(`upsert_hole_score($1,$2,$3,1,6,null,0)`, [id, H, p1]);
    expect(a.ok).toBe(true); expect(a.score.version).toBe(1);
    const b = await rpc(`upsert_hole_score($1,$2,$3,1,7,2,1)`, [id, H, p1]);
    expect(b.ok).toBe(true); expect(b.score.version).toBe(2); expect(b.score.strokes).toBe(7);
    const ev = await db.query<{ event_type: string; actor_session_player_id: string }>(
      `select event_type, actor_session_player_id from score_events order by created_at, id`);
    expect(ev.rows.map((r) => r.event_type)).toEqual(["CREATED", "UPDATED"]);
    expect(ev.rows[0].actor_session_player_id).toBe(p1);
  });
  it("stale version returns CONFLICT with the server value, never overwrites", async () => {
    const r = await rpc(`upsert_hole_score($1,$2,$3,1,3,null,1)`, [id, H, p1]);
    expect(r.ok).toBe(false); expect(r.error).toBe("CONFLICT"); expect(r.server.strokes).toBe(7); expect(r.server.version).toBe(2);
    const dup = await rpc(`upsert_hole_score($1,$2,$3,1,3,null,0)`, [id, H, p1]);
    expect(dup.error).toBe("CONFLICT");
  });
  it("clearing a score sets PENDING with null strokes", async () => {
    const r = await rpc(`upsert_hole_score($1,$2,$3,2,4,null,0)`, [id, H, p2]);
    const c = await rpc(`upsert_hole_score($1,$2,$3,2,null,null,$4)`, [id, H, p2, r.score.version]);
    expect(c.ok).toBe(true); expect(c.score.strokes).toBeNull(); expect(c.score.status).toBe("PENDING");
  });
  it("CONFIRMED / LOCKED scores cannot be overwritten (RPC and trigger)", async () => {
    await db.query(`update hole_scores set status='CONFIRMED' where session_player_id=$1 and hole_number=1`, [p1]);
    const r = await rpc(`upsert_hole_score($1,$2,$3,1,2,null,2)`, [id, H, p1]);
    expect(r.ok).toBe(false); expect(r.error).toBe("LOCKED");
    await expect(db.query(`update hole_scores set strokes=1 where session_player_id=$1 and hole_number=1`, [p1])).rejects.toThrow("SCORE_CONFIRMED");
    await db.query(`update hole_scores set status='LOCKED' where session_player_id=$1 and hole_number=1`, [p1]).catch(() => {});
    const s = await db.query<{ strokes: number }>(`select strokes from hole_scores where session_player_id=$1 and hole_number=1`, [p1]);
    expect(s.rows[0].strokes).toBe(7);
  });
  it("add player works up to 8, then rejects", async () => {
    for (let i = 3; i <= 8; i++) await rpc(`add_guest_player($1,$2,$3)`, [id, H, `P${i}`]);
    await expectError(`add_guest_player($1,$2,'P9')`, [id, H], "BAD_REQUEST");
  });
  it("submit closes the round: no more edits or players", async () => {
    const r = await rpc(`submit_guest_round($1,$2)`, [id, H]);
    expect(r.status).toBe("SUBMITTED");
    await expectError(`upsert_hole_score($1,$2,$3,5,4,null,0)`, [id, H, p2], "ROUND_CLOSED");
    await expectError(`add_guest_player($1,$2,'late')`, [id, H], "ROUND_CLOSED");
  });
  it("get_guest_round returns saved scores for resume", async () => {
    const r = await rpc(`get_guest_round($1,$2)`, [id, H]);
    expect(r.players.length).toBe(8);
    expect(r.scores.find((s: any) => s.playerId === p1 && s.hole === 1).strokes).toBe(7);
  });
});

describe("RLS and privileges", () => {
  it("anon and authenticated cannot execute guest RPCs", async () => {
    for (const role of ["anon", "authenticated"]) {
      await db.exec(`set role ${role}`);
      await expect(db.query(`select get_guest_round(gen_random_uuid(), 'x')`)).rejects.toThrow(/permission denied/i);
      await db.exec(`reset role`);
    }
  });
  it("anon cannot read rounds, scores, players or gps", async () => {
    await db.exec(`set role anon`);
    for (const t of ["game_sessions", "hole_scores", "players", "gps_tracks", "session_players"]) {
      const r = await db.query(`select * from ${t}`).catch(() => ({ rows: [] }));
      expect(r.rows.length, t).toBe(0);
    }
    const holes = await db.query(`select * from holes`);
    expect(holes.rows.length).toBe(18);
    await db.exec(`reset role`);
  });
  it("a normal user cannot escalate their own role", async () => {
    const u = (await db.query<{ id: string }>(`insert into auth.users (email) values ('p@x.ci') returning id`)).rows[0].id;
    const prof = await db.query<{ role: string }>(`select role from profiles where user_id=$1`, [u]);
    expect(prof.rows[0].role).toBe("PLAYER"); // created by signup trigger
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false)`);
    await db.query(`update profiles set role='CLUB_ADMIN' where user_id=$1`, [u]).catch(() => {});
    await db.exec(`reset role`);
    const after = await db.query<{ role: string }>(`select role from profiles where user_id=$1`, [u]);
    expect(after.rows[0].role).toBe("PLAYER");
    await db.exec(`select set_config('request.jwt.claim.sub','',false)`);
  });
  it("authenticated users cannot write rounds or scores directly", async () => {
    const u = (await db.query<{ id: string }>(`select user_id id from profiles limit 1`)).rows[0].id;
    await db.exec(`set role authenticated; select set_config('request.jwt.claim.sub','${u}',false)`);
    await expect(db.query(`insert into game_sessions (created_by, tee_set_id) select '${u}', id from tee_sets limit 1`)).rejects.toThrow();
    await db.exec(`reset role`);
  });
});
