import type { LocalRound } from "@/lib/types";

const STORAGE_KEY = "president-golf-round-v1";

export function saveRound(round: LocalRound) {
  if (typeof window === "undefined") return;
  const existing = getRounds().filter((item) => item.id !== round.id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify([round, ...existing]));
}

export function getRounds(): LocalRound[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]");
    return Array.isArray(parsed) ? (parsed as LocalRound[]) : [];
  } catch {
    return [];
  }
}

export function getRound(id: string) {
  return getRounds().find((round) => round.id === id) ?? null;
}
