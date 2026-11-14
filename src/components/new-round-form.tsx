"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TEE_SETS } from "@/lib/course";
import { saveRound } from "@/lib/round-storage";
import { createRemoteRound } from "@/lib/round-sync";
import type { LocalRound, TeeCode } from "@/lib/types";

export function NewRoundForm() {
  const router = useRouter();
  const [teeCode, setTeeCode] = useState<TeeCode>("YELLOW");
  const [startHole, setStartHole] = useState(1);
  const [names, setNames] = useState([""]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function updateName(index: number, value: string) {
    setNames((current) => current.map((name, i) => i === index ? value : name));
  }

  async function createRound() {
    const playerNames = names.map((name) => name.trim()).filter(Boolean);
    if (!playerNames.length) {
      setError("Ajoutez au moins un joueur pour continuer.");
      return;
    }
    setBusy(true);
    setError("");
    // Server-backed round when Supabase is configured and reachable; otherwise the same card works locally.
    let round: LocalRound | null = await createRemoteRound({ teeCode, startHole, names: playerNames });
    if (!round) {
      round = {
        id: crypto.randomUUID(), teeCode, startHole,
        players: playerNames.map((name) => ({ id: crypto.randomUUID(), name })),
        scores: {}, createdAt: new Date().toISOString(), status: "IN_PROGRESS",
      };
    }
    saveRound(round);
    router.push(`/round/${round.id}`);
  }

  return <div className="panel stack">
    <div>
      <div className="row"><strong>Départ</strong><span className="muted small">Choix du tee</span></div>
      <div className="tee-options" style={{ marginTop: 12 }}>
        {TEE_SETS.map((tee) => <button key={tee.code} className="tee-option" aria-pressed={teeCode === tee.code} onClick={() => setTeeCode(tee.code)}>
          {tee.label}<div className="small muted" style={{ marginTop: 5 }}>{tee.distance}</div>
        </button>)}
      </div>
    </div>
    <div className="field">
      <label htmlFor="start-hole">Trou de départ</label>
      <select id="start-hole" value={startHole} onChange={(e) => setStartHole(Number(e.target.value))} className="field input" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, background: "white" }}>
        {Array.from({ length: 18 }, (_, i) => <option key={i + 1} value={i + 1}>Trou {i + 1}</option>)}
      </select>
    </div>
    <div className="stack">
      <div className="row"><strong>Joueurs</strong><span className="muted small">{names.length} ligne(s)</span></div>
      {names.map((name, index) => <div className="player-row" key={index}>
        <input aria-label={`Nom du joueur ${index + 1}`} placeholder={`Joueur ${index + 1}`} value={name} onChange={(e) => updateName(index, e.target.value)} />
        {names.length > 1 && <button className="icon-btn" aria-label="Supprimer le joueur" onClick={() => setNames((current) => current.filter((_, i) => i !== index))}>×</button>}
      </div>)}
      <button className="btn btn-outline" onClick={() => setNames((current) => [...current, ""])}>+ Ajouter un joueur</button>
    </div>
    {error && <p role="alert" className="small" style={{ color: "#a33" }}>{error}</p>}
    <button className="btn btn-primary" disabled={busy} onClick={createRound}>{busy ? "Création…" : "Créer ma carte de score"}</button>
    <p className="muted small">Votre partie est sauvegardée sur cet appareil et synchronisée avec le serveur dès que la connexion le permet. Sans connexion, la carte reste utilisable.</p>
  </div>;
}
