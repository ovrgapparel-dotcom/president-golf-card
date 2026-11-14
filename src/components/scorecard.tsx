"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { HOLES, TEE_SETS } from "@/lib/course";
import { formatRelative, playerTotals } from "@/lib/scoring";
import { getRound } from "@/lib/round-storage";
import { flushRound, recordScore, resolveConflict, syncStatus } from "@/lib/round-sync";
import type { LocalRound, SyncStatus } from "@/lib/types";

const STATUS_LABEL: Record<SyncStatus, string> = {
  LOCAL_ONLY: "Sauvegardé sur cet appareil",
  SAVED_LOCALLY: "Enregistré localement — en attente",
  SYNCING: "Synchronisation…",
  SYNCED: "Synchronisé avec le serveur",
  CONFLICT: "Conflit à résoudre",
  FAILED: "Synchronisation impossible",
};

export function Scorecard({ roundId }: { roundId: string }) {
  const [round, setRound] = useState<LocalRound | null>(null);
  const [hole, setHole] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function sync() {
    setSyncing(true);
    await flushRound(roundId);
    setRound(getRound(roundId));
    setSyncing(false);
  }

  useEffect(() => {
    const found = getRound(roundId);
    setRound(found);
    if (found) setHole(found.startHole);
    setLoaded(true);
    if (found?.remote) {
      void sync();
      const retry = () => void sync();
      window.addEventListener("online", retry);
      const timer = window.setInterval(retry, 15000);
      return () => { window.removeEventListener("online", retry); window.clearInterval(timer); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roundId]);

  const tee = useMemo(() => TEE_SETS.find((item) => item.code === round?.teeCode), [round?.teeCode]);

  function updateScore(playerId: string, value: string) {
    if (!round) return;
    const parsed = value === "" ? null : Number(value);
    if (parsed !== null && (!Number.isInteger(parsed) || parsed < 1 || parsed > 25)) return;
    setRound(recordScore(round, hole, playerId, parsed));
    if (round.remote) void sync();
  }

  function adjustScore(playerId: string, delta: number) {
    if (!round) return;
    const currentScore = round.scores[hole]?.[playerId] ?? null;
    let next: number;
    if (currentScore === null) {
      next = HOLES[hole - 1].par; // start at par when blank
    } else {
      next = Math.max(1, Math.min(25, currentScore + delta));
    }
    setRound(recordScore(round, hole, playerId, next));
    if (round.remote) void sync();
  }

  function resolve(key: string, keep: "server" | "local") {
    setRound(resolveConflict(roundId, key, keep));
    void sync();
  }

  if (!loaded) return <p className="muted">Chargement de la carte…</p>;
  if (!round) {
    return (
      <div className="panel">
        <h2>Partie introuvable</h2>
        <p className="muted">Cette carte n’existe pas sur cet appareil.</p>
        <Link href="/round/new" className="btn btn-primary" style={{ marginTop: 12 }}>Créer une partie</Link>
      </div>
    );
  }

  const currentHole = HOLES[hole - 1];
  const status = syncStatus(round, syncing);
  const conflicts = Object.entries(round.remote?.conflicts ?? {});
  const frontNine = hole <= 9;
  const currentDistance = currentHole.distances[round.teeCode];

  return (
    <div>
      <div className="score-header">
        <div>
          <div className="eyebrow">
            Carte de score officielle · Départs {tee?.label}
          </div>
          <h1 style={{ fontSize: 34, margin: "6px 0" }}>
            Trou {hole} <span style={{ fontSize: 20, fontWeight: 400, color: "var(--muted)" }}>/ 18</span>
          </h1>
          <p className="muted small" style={{ margin: 0 }}>
            {round.players.length} joueur(s) · <span role="status" data-sync-status={status}>{STATUS_LABEL[status]}</span>
          </p>
        </div>
        <div className="actions" style={{ margin: 0 }}>
          <Link href="/course" className="btn btn-outline small">
            Vue 3D
          </Link>
          <Link href={`/round/${roundId}/summary`} className="btn btn-primary small">
            Résumé de partie
          </Link>
        </div>
      </div>

      <div className="panel stack">
        {/* Hole Card Details */}
        <div className="hole-info-card">
          <div className="hole-info-left">
            <span className="hole-info-section">{frontNine ? "Aller (1–9)" : "Retour (10–18)"}</span>
            <div className="hole-metrics">
              <span className="metric-pill">PAR <strong>{currentHole.par}</strong></span>
              <span className="metric-pill">Index (HCP) <strong>{currentHole.strokeIndex}</strong></span>
              <span className="metric-pill">Distance <strong>{currentDistance} m</strong></span>
            </div>
          </div>
          {currentHole.isSignatureHole && (
            <div className="signature-hole-banner">
              ⭐ <strong>Trou Signature : Green en Île</strong>
              <div className="small">Règle locale 4 : Dropping zone obligatoire si balle dans l&apos;eau</div>
            </div>
          )}
        </div>

        {/* 18-Hole Switcher */}
        <div className="hole-nav">
          {HOLES.map((item) => {
            const hasAllScores = round.players.every((p) => round.scores[item.number]?.[p.id] != null);
            return (
              <button
                key={item.number}
                className={`hole-chip ${hole === item.number ? "active" : ""} ${hasAllScores ? "completed" : ""}`}
                onClick={() => setHole(item.number)}
                title={`Trou ${item.number} (PAR ${item.par})`}
              >
                {item.number}
              </button>
            );
          })}
        </div>

        {/* Prev / Next controls */}
        <div className="row">
          <button
            className="btn btn-outline"
            disabled={hole === 1}
            onClick={() => setHole((n) => Math.max(1, n - 1))}
          >
            ← Trou {Math.max(1, hole - 1)}
          </button>
          <span className="muted small">Trou {hole} sur 18</span>
          <button
            className="btn btn-primary"
            disabled={hole === 18}
            onClick={() => setHole((n) => Math.min(18, n + 1))}
          >
            Trou {Math.min(18, hole + 1)} →
          </button>
        </div>

        {/* Conflicts alert */}
        {conflicts.map(([key, c]) => {
          const name = round.players.find((p) => p.id === c.playerId)?.name ?? "Joueur";
          return (
            <div key={key} className="notice" role="alert">
              <strong>Conflit — {name}, trou {c.hole}.</strong> Ce score a été modifié ailleurs : serveur {c.server?.strokes ?? "—"}, vous {c.local ?? "—"}.
              <div className="actions" style={{ marginTop: 8 }}>
                <button className="btn btn-outline" onClick={() => resolve(key, "server")}>Garder {c.server?.strokes ?? "—"}</button>
                <button className="btn btn-primary" onClick={() => resolve(key, "local")}>Garder {c.local ?? "—"}</button>
              </div>
            </div>
          );
        })}

        {round.remote?.closed && (
          <p className="notice">Partie clôturée : les scores sont verrouillés.</p>
        )}

        {/* Player score inputs */}
        <div style={{ overflowX: "auto" }}>
          <table className="score-table">
            <thead>
              <tr>
                <th style={{ minWidth: 140 }}>Joueur</th>
                <th style={{ textAlign: "center", minWidth: 150 }}>Coups (Trou {hole})</th>
                <th style={{ textAlign: "center" }}>Écart PAR Cumulé</th>
              </tr>
            </thead>
            <tbody>
              {round.players.map((player) => {
                const holeScore = round.scores[hole]?.[player.id];
                const totals = playerTotals(round, player.id);
                const scoreRelHole = holeScore != null ? holeScore - currentHole.par : null;
                const holeScoreLabel = scoreRelHole !== null ? (
                  scoreRelHole === 0 ? "Par" :
                  scoreRelHole === -1 ? "Birdie" :
                  scoreRelHole <= -2 ? "Eagle" :
                  scoreRelHole === 1 ? "Bogey" :
                  scoreRelHole === 2 ? "Dbl Bogey" : `+${scoreRelHole}`
                ) : null;

                return (
                  <tr key={player.id}>
                    <td>
                      <strong>{player.name}</strong>
                      <div className="muted small">{totals.holesPlayed}/18 trous complétés</div>
                    </td>
                    <td>
                      <div className="stepper-wrap">
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={round.remote?.closed}
                          onClick={() => adjustScore(player.id, -1)}
                          aria-label="Diminuer d'un coup"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={25}
                          className="score-input"
                          aria-label={`Score de ${player.name} au trou ${hole}`}
                          disabled={round.remote?.closed}
                          value={holeScore ?? ""}
                          onChange={(e) => updateScore(player.id, e.target.value)}
                        />
                        <button
                          type="button"
                          className="stepper-btn"
                          disabled={round.remote?.closed}
                          onClick={() => adjustScore(player.id, 1)}
                          aria-label="Augmenter d'un coup"
                        >
                          +
                        </button>
                        {holeScoreLabel && (
                          <span className={`hole-score-tag ${scoreRelHole! <= 0 ? "under-par" : "over-par"}`}>
                            {holeScoreLabel}
                          </span>
                        )}
                      </div>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span className={`score-badge ${totals.relativeToPar <= 0 && totals.holesPlayed > 0 ? "under-par" : ""}`}>
                        {formatRelative(totals.relativeToPar, totals.holesPlayed)}
                      </span>
                      <div className="muted small" style={{ marginTop: 2 }}>
                        {totals.holesPlayed > 0 ? `${totals.strokes} coups` : "—"}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
