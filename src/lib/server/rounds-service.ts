import { z } from "zod";
import { generateGuestToken, hashGuestToken } from "@/lib/server/guest-token";

/** Minimal RPC surface (satisfied by supabase-js `.rpc` and by the test harness). */
export type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
export type ServiceResult = { status: number; body: unknown };

const uuid = z.string().uuid();
export const createRoundSchema = z.object({
  teeCode: z.enum(["WHITE", "YELLOW", "BLUE", "RED"]),
  startHole: z.number().int().min(1).max(18),
  players: z.array(z.object({ name: z.string().trim().min(1).max(60) })).min(1).max(8),
});
export const addPlayerSchema = z.object({ name: z.string().trim().min(1).max(60) });
export const scoreSchema = z.object({
  playerId: uuid,
  strokes: z.number().int().min(1).max(25).nullable(),
  putts: z.number().int().min(0).max(10).nullable().optional(),
  expectedVersion: z.number().int().min(0),
});

const bad = (details?: unknown): ServiceResult => ({ status: 400, body: { error: "Données invalides", details } });
const notFound: ServiceResult = { status: 404, body: { error: "Partie introuvable" } };

/** Maps database exception codes to HTTP results. Unknown/wrong-token/foreign session all look like 404. */
function mapError(message: string): ServiceResult {
  if (message.includes("FORBIDDEN")) return notFound;
  if (message.includes("BAD_REQUEST")) return bad();
  if (message.includes("ROUND_CLOSED")) return { status: 409, body: { error: "ROUND_CLOSED", message: "La partie est clôturée." } };
  return { status: 500, body: { error: "Erreur serveur" } }; // never echo raw DB errors
}

export async function createRound(rpc: Rpc, input: unknown): Promise<ServiceResult> {
  const parsed = createRoundSchema.safeParse(input);
  if (!parsed.success) return bad(parsed.error.flatten());
  const token = generateGuestToken();
  const { data, error } = await rpc("create_guest_round", {
    p_token_hash: hashGuestToken(token),
    p_tee_code: parsed.data.teeCode,
    p_start_hole: parsed.data.startHole,
    p_players: parsed.data.players.map((p) => p.name),
  });
  if (error) return mapError(error.message);
  return { status: 201, body: { round: data, guestToken: token } }; // token is returned exactly once
}

export async function getRound(rpc: Rpc, id: string, token: string | null): Promise<ServiceResult> {
  if (!uuid.safeParse(id).success || !token) return notFound;
  const { data, error } = await rpc("get_guest_round", { p_session_id: id, p_hash: hashGuestToken(token) });
  return error ? mapError(error.message) : { status: 200, body: { round: data } };
}

export async function addPlayer(rpc: Rpc, id: string, token: string | null, input: unknown): Promise<ServiceResult> {
  if (!uuid.safeParse(id).success || !token) return notFound;
  const parsed = addPlayerSchema.safeParse(input);
  if (!parsed.success) return bad(parsed.error.flatten());
  const { data, error } = await rpc("add_guest_player", { p_session_id: id, p_hash: hashGuestToken(token), p_name: parsed.data.name });
  return error ? mapError(error.message) : { status: 201, body: { round: data } };
}

export async function putScore(rpc: Rpc, id: string, holeParam: string, token: string | null, input: unknown): Promise<ServiceResult> {
  if (!uuid.safeParse(id).success || !token) return notFound;
  const hole = Number(holeParam);
  if (!Number.isInteger(hole) || hole < 1 || hole > 18) return bad({ hole: "Trou invalide" });
  const parsed = scoreSchema.safeParse(input);
  if (!parsed.success) return bad(parsed.error.flatten());
  const { data, error } = await rpc("upsert_hole_score", {
    p_session_id: id, p_hash: hashGuestToken(token), p_session_player_id: parsed.data.playerId, p_hole: hole,
    p_strokes: parsed.data.strokes, p_putts: parsed.data.putts ?? null, p_expected_version: parsed.data.expectedVersion,
  });
  if (error) return mapError(error.message);
  const r = data as { ok: boolean; error?: string; score?: unknown; server?: unknown };
  if (r.ok) return { status: 200, body: { score: r.score } };
  return { status: 409, body: { error: r.error, server: r.server } };
}

export async function submitRound(rpc: Rpc, id: string, token: string | null): Promise<ServiceResult> {
  if (!uuid.safeParse(id).success || !token) return notFound;
  const { data, error } = await rpc("submit_guest_round", { p_session_id: id, p_hash: hashGuestToken(token) });
  return error ? mapError(error.message) : { status: 200, body: { round: data } };
}
