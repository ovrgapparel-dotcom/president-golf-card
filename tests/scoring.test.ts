import { describe, it, expect } from "vitest";
import { HOLES, TEE_SETS } from "@/lib/course";
import { formatRelative, playerSplitTotals, playerTotals } from "@/lib/scoring";
import type { LocalRound } from "@/lib/types";

const round = (scores: LocalRound["scores"]): LocalRound => ({
  id: "r", teeCode: "YELLOW", startHole: 1, players: [{ id: "p", name: "P" }], scores, createdAt: "", status: "IN_PROGRESS",
});

describe("course data (verified)", () => {
  it("has 18 holes, par 36/36/72, all verified", () => {
    expect(HOLES).toHaveLength(18);
    expect(HOLES.slice(0, 9).reduce((s, h) => s + h.par, 0)).toBe(36);
    expect(HOLES.slice(9).reduce((s, h) => s + h.par, 0)).toBe(36);
    expect(HOLES.every((h) => h.parVerified)).toBe(true);
  });
  it("stroke indexes are a permutation of 1..18", () => {
    expect(HOLES.map((h) => h.strokeIndex).sort((a, b) => a - b)).toEqual(Array.from({ length: 18 }, (_, i) => i + 1));
  });
  it("tee distance sums match verified club measurements exactly", () => {
    const sum = (tee: "YELLOW" | "BLUE" | "WHITE" | "RED", a: number, b: number) => HOLES.slice(a, b).reduce((s, h) => s + h.distances[tee], 0);
    // White
    expect(sum("WHITE", 0, 9)).toBe(3103);
    expect(sum("WHITE", 9, 18)).toBe(2912);
    expect(sum("WHITE", 0, 18)).toBe(6015);
    // Yellow
    expect(sum("YELLOW", 0, 9)).toBe(2944);
    expect(sum("YELLOW", 9, 18)).toBe(2736);
    expect(sum("YELLOW", 0, 18)).toBe(5680);
    // Blue
    expect(sum("BLUE", 0, 9)).toBe(2767);
    expect(sum("BLUE", 9, 18)).toBe(2454);
    expect(sum("BLUE", 0, 18)).toBe(5221);
    // Red
    expect(sum("RED", 0, 9)).toBe(2690);
    expect(sum("RED", 9, 18)).toBe(2417);
    expect(sum("RED", 0, 18)).toBe(5107);
    expect(TEE_SETS).toHaveLength(4);
  });
});

describe("scoring", () => {
  it("sums only holes with a score; relative to par uses played holes only", () => {
    const r = round({ 1: { p: 6 }, 2: { p: 3 }, 3: { p: null } }); // par 5,3,4 -> played 1,2
    expect(playerTotals(r, "p")).toEqual({ holesPlayed: 2, strokes: 9, par: 8, relativeToPar: 1 });
  });
  it("splits Aller / Retour / Total", () => {
    const r = round({ 9: { p: 5 }, 10: { p: 6 }, 18: { p: 4 } }); // pars 4, 5, 4
    const t = playerSplitTotals(r, "p");
    expect(t.front).toMatchObject({ holesPlayed: 1, strokes: 5, par: 4 });
    expect(t.back).toMatchObject({ holesPlayed: 2, strokes: 10, par: 9, relativeToPar: 1 });
    expect(t.total).toMatchObject({ holesPlayed: 3, strokes: 15, par: 13, relativeToPar: 2 });
  });
  it("full card: 85 strokes on par 72 is +13", () => {
    const scores: LocalRound["scores"] = {};
    HOLES.forEach((h, i) => { scores[h.number] = { p: i < 13 ? 5 : 4 }; }); // 13*5 + 5*4 = 85
    const t = playerTotals(round(scores), "p");
    expect(t.strokes).toBe(85); expect(t.par).toBe(72); expect(formatRelative(t.relativeToPar, t.holesPlayed)).toBe("+13");
  });
  it("formats E, negatives, and empty", () => {
    expect(formatRelative(0, 3)).toBe("E"); expect(formatRelative(-2, 3)).toBe("-2"); expect(formatRelative(0, 0)).toBe("—");
  });
});
