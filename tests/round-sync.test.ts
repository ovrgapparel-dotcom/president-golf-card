import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./db-helper";
import * as svc from "@/lib/server/rounds-service";
import { tokenFromRequest } from "@/lib/server/guest-token";
import { createRemoteRound, flushRound, recordScore, resolveConflict, scoreKey, submitRemoteRound, syncStatus } from "@/lib/round-sync";
import { getRound, saveRound } from "@/lib/round-storage";

// Browser stand-ins
const store = new Map<string, string>();
const installBrowserStubs = () => {
(globalThis as any).window = {};
(globalThis as any).localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) };
};

let db: PGlite;
let online = true;
let calls: string[] = [];

/** fetch that routes to the real service layer + real SQL, like the Next route handlers do. */
const fakeFetch = (async (url: string, init?: RequestInit) => {
  if (!online) throw new TypeError("offline");
  const rpc: svc.Rpc = async (fn, args) => {
    const keys = Object.keys(args);
    try {
      const r = await db.query<{ r: unknown }>(`select ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`, keys.map((k) => args[k]));
      return { data: r.rows[0].r, error: null };
    } catch (e) { return { data: null, error: { message: (e as Error).message } }; }
  };
  const req = new Request(`http://x${url}`, init);
  const token = tokenFromRequest(req);
  const body = init?.body ? JSON.parse(init.body as string) : null;
  calls.push(`${init?.method} ${url}`);
  let out: svc.ServiceResult;
  const m = /^\/api\/rounds(?:\/([^/]+))?(?:\/(scores|submit)(?:\/(\d+))?)?$/.exec(url)!;
  if (!m[1]) out = await svc.createRound(rpc, body);
  else if (m[2] === "scores") out = await svc.putScore(rpc, m[1], m[3], token, body);
  else if (m[2] === "submit") out = await svc.submitRound(rpc, m[1], token);
  else out = await svc.getRound(rpc, m[1], token);
  return new Response(JSON.stringify(out.body), { status: out.status });
}) as typeof fetch;

beforeAll(async () => { db = await freshDb(); installBrowserStubs(); }); // stubs after PGlite boots (it sniffs `window`)
beforeEach(() => { online = true; calls = []; });

async function newRound() {
  const r = await createRemoteRound({ teeCode: "YELLOW", startHole: 1, names: ["Francis", "Josué"] }, fakeFetch);
  expect(r).not.toBeNull(); saveRound(r!); return r!;
}

describe("client sync ⇄ API ⇄ SQL", () => {
  it("falls back (null) when the API is unavailable", async () => {
    const down = (async () => new Response("{}", { status: 503 })) as typeof fetch;
    expect(await createRemoteRound({ teeCode: "RED", startHole: 1, names: ["A"] }, down)).toBeNull();
    const dead = (async () => { throw new TypeError("network"); }) as typeof fetch;
    expect(await createRemoteRound({ teeCode: "RED", startHole: 1, names: ["A"] }, dead)).toBeNull();
  });

  it("saves locally first, then syncs and records versions", async () => {
    let r = await newRound(); const p = r.players[0].id;
    r = recordScore(r, 1, p, 5);
    expect(r.scores[1][p]).toBe(5); expect(syncStatus(r)).toBe("SAVED_LOCALLY");
    await flushRound(r.id, fakeFetch);
    const after = getRound(r.id)!;
    expect(syncStatus(after)).toBe("SYNCED"); expect(after.remote!.versions[scoreKey(1, p)]).toBe(1);
    const row = await db.query<{ strokes: number }>(`select strokes from hole_scores where session_player_id=$1 and hole_number=1`, [p]);
    expect(row.rows[0].strokes).toBe(5);
  });

  it("offline edits survive and sync after reconnect, in order", async () => {
    let r = await newRound(); const p = r.players[0].id;
    online = false; calls = [];
    r = recordScore(r, 2, p, 3); r = recordScore(r, 2, p, 4); r = recordScore(r, 3, p, 6);
    await flushRound(r.id, fakeFetch);
    expect(syncStatus(getRound(r.id)!)).toBe("SAVED_LOCALLY"); expect(calls).toHaveLength(0);
    online = true;
    await flushRound(r.id, fakeFetch);
    const done = getRound(r.id)!;
    expect(syncStatus(done)).toBe("SYNCED");
    const rows = await db.query<{ hole_number: number; strokes: number }>(`select hole_number, strokes from hole_scores where session_player_id=$1 order by hole_number`, [p]);
    expect(rows.rows).toEqual([{ hole_number: 2, strokes: 4 }, { hole_number: 3, strokes: 6 }]); // coalesced: only latest value sent for hole 2
  });

  it("detects a conflict from another device; local and server values are both kept until resolved", async () => {
    let r = await newRound(); const p = r.players[0].id;
    r = recordScore(r, 4, p, 5); await flushRound(r.id, fakeFetch); // server v1 = 5
    // another device edits the same score (v2 = 7)
    await db.query(`update hole_scores set strokes=7 where session_player_id=$1 and hole_number=4`, [p]);
    r = recordScore(getRound(r.id)!, 4, p, 6); await flushRound(r.id, fakeFetch);
    const c = getRound(r.id)!;
    expect(syncStatus(c)).toBe("CONFLICT");
    expect(c.remote!.conflicts[scoreKey(4, p)]).toMatchObject({ local: 6, server: { strokes: 7, version: 2 } });
    // server value untouched
    expect((await db.query<{ strokes: number }>(`select strokes from hole_scores where session_player_id=$1 and hole_number=4`, [p])).rows[0].strokes).toBe(7);
    // keep mine -> re-sent on top of server version
    resolveConflict(r.id, scoreKey(4, p), "local"); await flushRound(r.id, fakeFetch);
    expect((await db.query<{ strokes: number }>(`select strokes from hole_scores where session_player_id=$1 and hole_number=4`, [p])).rows[0].strokes).toBe(6);
    expect(syncStatus(getRound(r.id)!)).toBe("SYNCED");
  });

  it("conflict resolved with 'server' adopts the server value locally", async () => {
    let r = await newRound(); const p = r.players[1].id;
    r = recordScore(r, 5, p, 4); await flushRound(r.id, fakeFetch);
    await db.query(`update hole_scores set strokes=8 where session_player_id=$1 and hole_number=5`, [p]);
    r = recordScore(getRound(r.id)!, 5, p, 3); await flushRound(r.id, fakeFetch);
    const next = resolveConflict(r.id, scoreKey(5, p), "server")!;
    expect(next.scores[5][p]).toBe(8); expect(syncStatus(next)).toBe("SYNCED");
  });

  it("a confirmed/locked server score is never overwritten; the server value wins locally", async () => {
    let r = await newRound(); const p = r.players[0].id;
    r = recordScore(r, 6, p, 5); await flushRound(r.id, fakeFetch);
    await db.query(`update hole_scores set status='CONFIRMED' where session_player_id=$1 and hole_number=6`, [p]);
    r = recordScore(getRound(r.id)!, 6, p, 2); await flushRound(r.id, fakeFetch);
    const after = getRound(r.id)!;
    expect(after.scores[6][p]).toBe(5); expect(syncStatus(after)).toBe("SYNCED");
    expect((await db.query<{ strokes: number }>(`select strokes from hole_scores where session_player_id=$1 and hole_number=6`, [p])).rows[0].strokes).toBe(5);
  });

  it("submit flushes first, closes the round, and later edits stay local-only", async () => {
    let r = await newRound(); const p = r.players[0].id;
    r = recordScore(r, 7, p, 4);
    expect(await submitRemoteRound(r.id, fakeFetch)).toBe(true);
    const s = getRound(r.id)!;
    expect(s.status).toBe("SUBMITTED");
    expect((await db.query<{ status: string }>(`select status from game_sessions where id=$1`, [r.id])).rows[0].status).toBe("SUBMITTED");
    const again = recordScore(s, 8, p, 4);
    expect(Object.keys(again.remote!.pending)).toHaveLength(0);
  });

  it("refuses to submit while a score is pending offline", async () => {
    let r = await newRound(); const p = r.players[0].id;
    online = false; r = recordScore(r, 9, p, 4);
    expect(await submitRemoteRound(r.id, fakeFetch)).toBe(false);
  });

  it("a rejected token marks the round failed and keeps local data", async () => {
    let r = await newRound(); const p = r.players[0].id;
    saveRound({ ...r, remote: { ...r.remote!, token: "x".repeat(43) } });
    r = recordScore(getRound(r.id)!, 1, p, 4); await flushRound(r.id, fakeFetch);
    const f = getRound(r.id)!;
    expect(syncStatus(f)).toBe("FAILED"); expect(f.scores[1][p]).toBe(4);
  });

  it("local-only rounds (no remote) never call the API", async () => {
    calls = [];
    const local = { id: "loc", teeCode: "RED" as const, startHole: 1, players: [{ id: "a", name: "A" }], scores: {}, createdAt: "", status: "IN_PROGRESS" as const };
    saveRound(local);
    const r = recordScore(local, 1, "a", 4); await flushRound("loc", fakeFetch);
    expect(syncStatus(r)).toBe("LOCAL_ONLY"); expect(calls).toHaveLength(0);
  });
});
