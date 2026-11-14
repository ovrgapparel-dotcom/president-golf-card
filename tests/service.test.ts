import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { freshDb } from "./db-helper";
import * as svc from "@/lib/server/rounds-service";
import type { Rpc } from "@/lib/server/rounds-service";
import { generateGuestToken, hashGuestToken, tokenFromRequest } from "@/lib/server/guest-token";
import { rateLimit, resetRateLimits } from "@/lib/server/rate-limit";

let db: PGlite;
let rpc: Rpc;

beforeAll(async () => {
  db = await freshDb();
  // Same contract as supabase-js `.rpc(fn, namedArgs)`, executed against the real migrations.
  rpc = async (fn, args) => {
    const keys = Object.keys(args);
    const sql = `select ${fn}(${keys.map((k, i) => `${k} => $${i + 1}`).join(", ")}) as r`;
    try {
      const r = await db.query<{ r: unknown }>(sql, keys.map((k) => args[k]));
      return { data: r.rows[0].r, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  };
});

describe("guest token", () => {
  it("is 43-char base64url, unique, and hash is stable sha256 hex", () => {
    const a = generateGuestToken(), b = generateGuestToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/); expect(a).not.toBe(b);
    expect(hashGuestToken(a)).toMatch(/^[0-9a-f]{64}$/); expect(hashGuestToken(a)).toBe(hashGuestToken(a));
    expect(hashGuestToken(a)).not.toBe(a);
  });
  it("only accepts a well-formed Bearer header", () => {
    const t = generateGuestToken();
    const req = (h?: string) => new Request("http://x", { headers: h ? { authorization: h } : {} });
    expect(tokenFromRequest(req(`Bearer ${t}`))).toBe(t);
    for (const h of [undefined, "", t, `Basic ${t}`, "Bearer short", `Bearer ${t}x`, `Bearer ${t} extra`]) expect(tokenFromRequest(req(h))).toBeNull();
  });
});

describe("rate limiter", () => {
  beforeEach(resetRateLimits);
  it("blocks after the limit and resets after the window", () => {
    expect([1, 2, 3].map(() => rateLimit("k", 2, 1000, 0))).toEqual([true, true, false]);
    expect(rateLimit("k", 2, 1000, 1001)).toBe(true);
    expect(rateLimit("other", 2, 1000, 0)).toBe(true);
  });
});

describe("rounds service (real SQL)", () => {
  let id: string, token: string, p1: string;
  const valid = { teeCode: "YELLOW", startHole: 1, players: [{ name: "Francis" }, { name: "Josué" }] };

  it("rejects invalid payloads with 400", async () => {
    for (const body of [null, {}, { ...valid, teeCode: "PINK" }, { ...valid, startHole: 19 }, { ...valid, players: [] }, { ...valid, players: [{ name: "  " }] }]) {
      expect((await svc.createRound(rpc, body)).status).toBe(400);
    }
  });
  it("creates a round, returns the raw token once, stores only its hash", async () => {
    const r = await svc.createRound(rpc, valid);
    expect(r.status).toBe(201);
    const body = r.body as { round: any; guestToken: string };
    id = body.round.id; token = body.guestToken; p1 = body.round.players[0].id;
    const stored = await db.query<{ guest_token_hash: string }>(`select guest_token_hash from game_sessions where id=$1`, [id]);
    expect(stored.rows[0].guest_token_hash).toBe(hashGuestToken(token));
    expect(JSON.stringify(stored.rows)).not.toContain(token);
    expect(JSON.stringify(body.round)).not.toContain(token);
  });
  it("resumes with the token; wrong/missing token or bad id are indistinguishable 404s", async () => {
    expect((await svc.getRound(rpc, id, token)).status).toBe(200);
    expect((await svc.getRound(rpc, id, generateGuestToken())).status).toBe(404);
    expect((await svc.getRound(rpc, id, null)).status).toBe(404);
    expect((await svc.getRound(rpc, "not-a-uuid", token)).status).toBe(404);
    expect((await svc.getRound(rpc, crypto.randomUUID(), token)).status).toBe(404);
  });
  it("saves scores with versioning and reports conflicts (409 + server value)", async () => {
    const a = await svc.putScore(rpc, id, "3", token, { playerId: p1, strokes: 5, expectedVersion: 0 });
    expect(a.status).toBe(200); expect((a.body as any).score.version).toBe(1);
    const b = await svc.putScore(rpc, id, "3", token, { playerId: p1, strokes: 6, expectedVersion: 1 });
    expect((b.body as any).score.version).toBe(2);
    const stale = await svc.putScore(rpc, id, "3", token, { playerId: p1, strokes: 4, expectedVersion: 1 });
    expect(stale.status).toBe(409);
    expect(stale.body).toMatchObject({ error: "CONFLICT", server: { strokes: 6, version: 2 } });
  });
  it("validates score payload and hole", async () => {
    expect((await svc.putScore(rpc, id, "0", token, { playerId: p1, strokes: 4, expectedVersion: 0 })).status).toBe(400);
    expect((await svc.putScore(rpc, id, "abc", token, { playerId: p1, strokes: 4, expectedVersion: 0 })).status).toBe(400);
    expect((await svc.putScore(rpc, id, "1", token, { playerId: p1, strokes: 0, expectedVersion: 0 })).status).toBe(400);
    expect((await svc.putScore(rpc, id, "1", token, { playerId: "nope", strokes: 3, expectedVersion: 0 })).status).toBe(400);
    expect((await svc.putScore(rpc, id, "1", generateGuestToken(), { playerId: p1, strokes: 3, expectedVersion: 0 })).status).toBe(404);
  });
  it("adds a player, submits, then rejects further edits with 409", async () => {
    expect((await svc.addPlayer(rpc, id, token, { name: "Mara" })).status).toBe(201);
    expect((await svc.submitRound(rpc, id, token)).status).toBe(200);
    expect((await svc.putScore(rpc, id, "4", token, { playerId: p1, strokes: 4, expectedVersion: 0 })).body).toMatchObject({ error: "ROUND_CLOSED" });
    expect((await svc.addPlayer(rpc, id, token, { name: "Late" })).status).toBe(409);
  });
  it("never echoes raw database errors", async () => {
    const broken: Rpc = async () => ({ data: null, error: { message: 'relation "secret_table" does not exist' } });
    const r = await svc.getRound(broken, crypto.randomUUID(), token);
    expect(r.status).toBe(500); expect(JSON.stringify(r.body)).not.toContain("secret_table");
  });
});
