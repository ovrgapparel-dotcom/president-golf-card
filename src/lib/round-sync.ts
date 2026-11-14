import { getRound, saveRound } from "@/lib/round-storage";
import type { LocalRound, PendingScore, ScoreKey, SyncStatus, TeeCode } from "@/lib/types";

type FetchLike = typeof fetch;
export const scoreKey = (hole: number, playerId: string): ScoreKey => `${hole}:${playerId}`;

const flushing = new Set<string>();

/** Try to create the round on the server. Returns null if unavailable (not configured / offline): caller falls back to local. */
export async function createRemoteRound(
  input: { teeCode: TeeCode; startHole: number; names: string[] },
  fetchImpl: FetchLike = fetch,
): Promise<LocalRound | null> {
  try {
    const res = await fetchImpl("/api/rounds", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ teeCode: input.teeCode, startHole: input.startHole, players: input.names.map((name) => ({ name })) }),
    });
    if (res.status !== 201) return null;
    const { round, guestToken } = (await res.json()) as {
      round: { id: string; teeCode: TeeCode; startHole: number; createdAt: string; players: { id: string; name: string }[] };
      guestToken: string;
    };
    return {
      id: round.id, teeCode: round.teeCode, startHole: round.startHole, createdAt: round.createdAt,
      players: round.players.map((p) => ({ id: p.id, name: p.name })),
      scores: {}, status: "IN_PROGRESS",
      remote: { token: guestToken, versions: {}, pending: {}, conflicts: {} },
    };
  } catch {
    return null;
  }
}

/** Record a score locally and queue it for sync. Local save always happens first. */
export function recordScore(round: LocalRound, hole: number, playerId: string, strokes: number | null): LocalRound {
  const next: LocalRound = {
    ...round,
    scores: { ...round.scores, [hole]: { ...(round.scores[hole] ?? {}), [playerId]: strokes } },
  };
  if (round.remote && !round.remote.closed && !round.remote.failed) {
    const key = scoreKey(hole, playerId);
    const conflicts = { ...round.remote.conflicts };
    delete conflicts[key]; // user typed a new value: that supersedes an unresolved conflict
    next.remote = { ...round.remote, conflicts, pending: { ...round.remote.pending, [key]: { hole, playerId, strokes } } };
  }
  saveRound(next);
  return next;
}

/** Push pending scores one at a time, always re-reading storage so concurrent edits are never lost. */
export async function flushRound(roundId: string, fetchImpl: FetchLike = fetch): Promise<void> {
  if (flushing.has(roundId)) return;
  flushing.add(roundId);
  try {
    for (let guard = 0; guard < 500; guard++) {
      const round = getRound(roundId);
      const remote = round?.remote;
      if (!round || !remote || remote.failed || remote.closed) return;
      const key = Object.keys(remote.pending).find((k) => !remote.conflicts[k]);
      if (!key) return;
      const snap: PendingScore = remote.pending[key];

      let res: Response;
      try {
        res = await fetchImpl(`/api/rounds/${roundId}/scores/${snap.hole}`, {
          method: "PUT",
          headers: { "content-type": "application/json", authorization: `Bearer ${remote.token}` },
          body: JSON.stringify({ playerId: snap.playerId, strokes: snap.strokes, expectedVersion: remote.versions[key] ?? 0 }),
        });
      } catch {
        return; // offline: stay queued, retried on reconnect
      }

      const fresh = getRound(roundId);
      if (!fresh?.remote) return;
      const r = { ...fresh.remote, versions: { ...fresh.remote.versions }, pending: { ...fresh.remote.pending }, conflicts: { ...fresh.remote.conflicts } };
      let scores = fresh.scores;
      const body = (await res.json().catch(() => ({}))) as {
        score?: { version: number }; error?: string; server?: { strokes: number | null; version: number } | null;
      };

      if (res.status === 200 && body.score) {
        r.versions[key] = body.score.version;
        if (r.pending[key]?.strokes === snap.strokes) delete r.pending[key]; // else: edited meanwhile, resend with new version
      } else if (res.status === 409 && body.error === "CONFLICT") {
        r.conflicts[key] = { hole: snap.hole, playerId: snap.playerId, local: snap.strokes, server: body.server ?? null };
        delete r.pending[key];
      } else if (res.status === 409 && body.error === "LOCKED") {
        // Confirmed/locked on the server: the server value wins, never overwritten.
        if (body.server) {
          r.versions[key] = body.server.version;
          scores = { ...scores, [snap.hole]: { ...(scores[snap.hole] ?? {}), [snap.playerId]: body.server.strokes } };
        }
        delete r.pending[key];
      } else if (res.status === 409 && body.error === "ROUND_CLOSED") {
        r.closed = true; r.pending = {};
      } else if (res.status === 404 || res.status === 400) {
        r.failed = true; // token/round rejected: stop retrying, keep the local card intact
      } else {
        return; // 429/5xx/503: retry later
      }
      saveRound({ ...fresh, scores, remote: r });
    }
  } finally {
    flushing.delete(roundId);
  }
}

/** Resolve a conflict by keeping the server value or re-sending the local one on top of the server version. */
export function resolveConflict(roundId: string, key: ScoreKey, keep: "server" | "local"): LocalRound | null {
  const round = getRound(roundId);
  const c = round?.remote?.conflicts[key];
  if (!round || !round.remote || !c) return round;
  const remote = { ...round.remote, versions: { ...round.remote.versions }, pending: { ...round.remote.pending }, conflicts: { ...round.remote.conflicts } };
  delete remote.conflicts[key];
  remote.versions[key] = c.server?.version ?? 0;
  let scores = round.scores;
  if (keep === "server") {
    scores = { ...scores, [c.hole]: { ...(scores[c.hole] ?? {}), [c.playerId]: c.server?.strokes ?? null } };
  } else {
    remote.pending[key] = { hole: c.hole, playerId: c.playerId, strokes: c.local };
  }
  const next = { ...round, scores, remote };
  saveRound(next);
  return next;
}

export function syncStatus(round: LocalRound, syncing = false): SyncStatus {
  const r = round.remote;
  if (!r) return "LOCAL_ONLY";
  if (r.failed) return "FAILED";
  if (Object.keys(r.conflicts).length) return "CONFLICT";
  if (Object.keys(r.pending).length) return syncing ? "SYNCING" : "SAVED_LOCALLY";
  return "SYNCED";
}

/** Flush, then close the round on the server. Returns false if anything is still pending/conflicting. */
export async function submitRemoteRound(roundId: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  await flushRound(roundId, fetchImpl);
  const round = getRound(roundId);
  const r = round?.remote;
  if (!round || !r || r.failed || Object.keys(r.pending).length || Object.keys(r.conflicts).length) return false;
  try {
    const res = await fetchImpl(`/api/rounds/${roundId}/submit`, { method: "POST", headers: { authorization: `Bearer ${r.token}` } });
    if (res.status !== 200) return false;
    saveRound({ ...round, status: "SUBMITTED", remote: { ...r, closed: true } });
    return true;
  } catch {
    return false;
  }
}
