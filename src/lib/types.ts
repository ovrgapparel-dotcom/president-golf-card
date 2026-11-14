export type TeeCode = "WHITE" | "YELLOW" | "BLUE" | "RED";
export type RoundStatus = "IN_PROGRESS" | "SUBMITTED" | "VALIDATED";
export type Player = { id: string; name: string };
export type HoleScore = { [playerId: string]: number | null };

/** Key for one player's score on one hole: `${hole}:${playerId}` */
export type ScoreKey = string;
export type PendingScore = { hole: number; playerId: string; strokes: number | null };
export type ScoreConflict = { hole: number; playerId: string; local: number | null; server: { strokes: number | null; version: number } | null };

/** Present only for rounds backed by the server. Absent = local-only (offline fallback). */
export type RemoteState = {
  /** Guest token (secret). Stays on this device; only its hash exists server-side. */
  token: string;
  versions: Record<ScoreKey, number>;
  pending: Record<ScoreKey, PendingScore>;
  conflicts: Record<ScoreKey, ScoreConflict>;
  /** Server refused this device (bad token/unknown round) — stop syncing, keep local data. */
  failed?: boolean;
  /** Server round is closed (submitted/validated): no more edits accepted. */
  closed?: boolean;
};

export type LocalRound = {
  id: string;
  teeCode: TeeCode;
  startHole: number;
  players: Player[];
  scores: Record<number, HoleScore>;
  createdAt: string;
  status: RoundStatus;
  remote?: RemoteState;
};

export type SyncStatus = "LOCAL_ONLY" | "SAVED_LOCALLY" | "SYNCING" | "SYNCED" | "CONFLICT" | "FAILED";
