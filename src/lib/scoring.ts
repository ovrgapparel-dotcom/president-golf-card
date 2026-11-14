import { HOLES } from "@/lib/course";
import type { LocalRound } from "@/lib/types";

type Totals = { holesPlayed: number; strokes: number; par: number; relativeToPar: number };

function totalsFor(round: LocalRound, playerId: string, from: number, to: number): Totals {
  const completed = HOLES.filter((hole) => {
    if (hole.number < from || hole.number > to) return false;
    const value = round.scores[hole.number]?.[playerId];
    return typeof value === "number" && Number.isFinite(value);
  });
  const strokes = completed.reduce((sum, hole) => sum + (round.scores[hole.number][playerId] ?? 0), 0);
  const par = completed.reduce((sum, hole) => sum + hole.par, 0);
  return { holesPlayed: completed.length, strokes, par, relativeToPar: strokes - par };
}

export function playerTotals(round: LocalRound, playerId: string) {
  return totalsFor(round, playerId, 1, 18);
}

/** Aller (1–9) and Retour (10–18) subtotals, as on the paper card. */
export function playerSplitTotals(round: LocalRound, playerId: string) {
  return { front: totalsFor(round, playerId, 1, 9), back: totalsFor(round, playerId, 10, 18), total: totalsFor(round, playerId, 1, 18) };
}

export function formatRelative(value: number, holesPlayed: number) {
  if (!holesPlayed) return "—";
  if (value === 0) return "E";
  return value > 0 ? `+${value}` : `${value}`;
}
