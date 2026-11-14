"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { playerSplitTotals, formatRelative } from "@/lib/scoring";
import { COURSE_DATA_NOTICE, HOLES, TEE_SETS } from "@/lib/course";
import { submitRemoteRound, syncStatus } from "@/lib/round-sync";
import { getRound } from "@/lib/round-storage";
import { PageHeroBanner } from "@/components/page-hero-banner";
import type { LocalRound } from "@/lib/types";

export default function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const [roundId, setRoundId] = useState("");
  const [round, setRound] = useState<LocalRound | null>(null);
  const [submitMsg, setSubmitMsg] = useState("");
  const [markerName, setMarkerName] = useState("");
  const [signed, setSigned] = useState(false);

  async function submit() {
    setSubmitMsg("Enregistrement et clôture de la carte…");
    const ok = await submitRemoteRound(roundId);
    setRound(getRound(roundId));
    setSubmitMsg(ok ? "Partie clôturée avec succès." : "Impossible de clôturer : scores en attente de synchronisation ou conflit à résoudre.");
  }

  useEffect(() => {
    params.then(({ id }) => {
      setRoundId(id);
      const r = getRound(id);
      setRound(r);
      if (r?.players && r.players.length > 1) {
        setMarkerName(r.players[1].name);
      }
    });
  }, [params]);

  if (!round) {
    return (
      <main>
        <PageHeroBanner
          eyebrow="Résultats"
          title="Résumé de Partie"
          description="Consultez les scores et l'attestation de votre parcours au President Golf de Yamoussoukro."
          bgImage="/images/hotel-president.jpg"
        />
        <div className="container" style={{ marginTop: -20, position: "relative", zIndex: 10 }}>
          <div className="panel luxury-panel" style={{ textAlign: "center", padding: "40px 20px" }}>
            <h2>Carte introuvable ou en cours de chargement</h2>
            <Link href="/round" className="btn btn-primary" style={{ marginTop: 12 }}>Mes parties enregistrées</Link>
          </div>
        </div>
      </main>
    );
  }

  const tee = TEE_SETS.find((t) => t.code === round.teeCode);

  return (
    <main>
      <PageHeroBanner
        eyebrow="Certification &amp; Clôture"
        title="Attestation Officielle"
        titleHighlight="des Résultats"
        description="Récapitulatif officiel des scores Aller (1–9) et Retour (10–18). Validation par le joueur et contre-signature du marqueur."
        bgImage="/images/hotel-president.jpg"
        badge="SCORECARD CERTIFIÉ"
      >
        <Link className="btn btn-gold" href={`/round/${roundId}`}>
          ← Retour à la saisie
        </Link>
        <button type="button" className="btn btn-outline-white" onClick={() => window.print()}>
          🖨️ Imprimer la carte
        </button>
      </PageHeroBanner>

      <div className="container" style={{ maxWidth: 920, marginTop: -24, position: "relative", zIndex: 10 }}>
        {/* Certificate Card Header */}
        <div className="summary-card luxury-panel">
          <div className="summary-header">
            <Image
              src="/logo.png"
              alt="Logo President Golf Yamoussoukro"
              width={76}
              height={76}
              priority
              className="summary-logo"
            />
            <div className="summary-title-wrap">
              <div className="eyebrow" style={{ color: "var(--gold)" }}>Carte de score certifiée</div>
              <h2 style={{ fontSize: 28, margin: "4px 0 0", color: "white" }}>President Golf de Yamoussoukro</h2>
              <p style={{ margin: "4px 0 0", color: "#d2ded6", fontSize: 13 }}>
                Départs : <strong>{tee?.label} ({tee?.distance})</strong> · Date : {new Date(round.createdAt).toLocaleDateString("fr-FR")}
              </p>
            </div>
            <div className="badge-verified" style={{ background: "rgba(255,255,255,0.15)", color: "#fff", borderColor: "rgba(255,255,255,0.3)" }}>
              {round.status === "VALIDATED" || round.status === "SUBMITTED" ? "Carte clôturée" : "Partie en cours"}
            </div>
          </div>

          {/* Player Total Summaries */}
          <div className="stack" style={{ marginTop: 24 }}>
            {round.players.map((player) => {
              const { front, back, total } = playerSplitTotals(round, player.id);
              return (
                <div className="panel" key={player.id} style={{ background: "#ffffff", border: "1px solid var(--line)" }}>
                  <div className="row">
                    <div>
                      <h3 style={{ fontSize: 22, margin: 0 }}>{player.name}</h3>
                      <span className="muted small">Trous joués : {total.holesPlayed} / 18</span>
                    </div>
                    <div className="score-badge-large">
                      <span className="small muted">Score relatif au PAR</span>
                      <strong className={total.relativeToPar <= 0 && total.holesPlayed > 0 ? "under-par-text" : ""}>
                        {formatRelative(total.relativeToPar, total.holesPlayed)}
                      </strong>
                    </div>
                  </div>

                  <div className="stat-grid" style={{ marginTop: 16 }}>
                    <div className="stat">
                      <span className="muted small">Aller (Trous 1–9)</span>
                      <strong>{front.holesPlayed ? front.strokes : "—"}</strong>
                      <span className="small muted">PAR {front.par} ({formatRelative(front.relativeToPar, front.holesPlayed)})</span>
                    </div>
                    <div className="stat">
                      <span className="muted small">Retour (Trous 10–18)</span>
                      <strong>{back.holesPlayed ? back.strokes : "—"}</strong>
                      <span className="small muted">PAR {back.par} ({formatRelative(back.relativeToPar, back.holesPlayed)})</span>
                    </div>
                    <div className="stat">
                      <span className="muted small">Total Coups (Brut)</span>
                      <strong>{total.holesPlayed ? total.strokes : "—"}</strong>
                      <span className="small muted">PAR total {total.par}</span>
                    </div>
                  </div>

                  {/* Hole-by-Hole Mini Strip */}
                  <div className="mini-hole-strip" style={{ marginTop: 14 }}>
                    {HOLES.map((h) => {
                      const score = round.scores[h.number]?.[player.id];
                      const rel = score != null ? score - h.par : null;
                      return (
                        <div
                          key={h.number}
                          className={`mini-hole-cell ${rel != null && rel <= 0 ? "cell-under-par" : rel != null && rel > 0 ? "cell-over-par" : ""}`}
                          title={`Trou ${h.number} (PAR ${h.par}) : ${score ?? "—"}`}
                        >
                          <span className="mini-hole-num">{h.number}</span>
                          <strong className="mini-hole-val">{score ?? "—"}</strong>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Official Signatures Section */}
          <div className="panel" style={{ marginTop: 22, background: "#fbfcfb", border: "1px solid var(--line)" }}>
            <div className="eyebrow" style={{ color: "var(--green-2)" }}>Attestation &amp; Certification</div>
            <h3 style={{ margin: "6px 0 14px", fontSize: 16 }}>Signatures de la carte de score</h3>
            <div className="grid-2">
              <div className="signature-box">
                <span className="signature-title">Signature du Joueur</span>
                <p className="signature-name">{round.players[0]?.name ?? "Joueur 1"}</p>
                <div className="signature-line" />
                <span className="muted small">Certifié exact par le joueur</span>
              </div>
              <div className="signature-box">
                <span className="signature-title">Signature du Marqueur</span>
                <p className="signature-name">{markerName || "Marqueur désigné"}</p>
                <div className="signature-line" />
                <span className="muted small">Conforme aux règles locales et du R&amp;A</span>
              </div>
            </div>
            {!signed && (
              <button
                type="button"
                className="btn btn-outline small"
                style={{ marginTop: 14, width: "100%" }}
                onClick={() => setSigned(true)}
              >
                Apposer la confirmation du marqueur ✓
              </button>
            )}
            {signed && (
              <p className="notice" style={{ marginTop: 12, background: "#edf6ee", borderColor: "#a9dfb2", color: "#196627" }}>
                ✓ Carte contresignée et validée par le marqueur officiel.
              </p>
            )}
          </div>

          {/* Validation Notice */}
          <p className="notice" style={{ marginTop: 18 }}>
            {COURSE_DATA_NOTICE} Carte de score officielle du President Golf de Yamoussoukro, Côte d’Ivoire.
          </p>

          {/* Closing & Actions */}
          {round.remote && syncStatus(round) !== "FAILED" && (
            <div className="panel" style={{ marginTop: 16, background: "#ffffff", border: "1px solid var(--line)" }}>
              <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
                <strong>Statut de synchronisation : {round.status === "IN_PROGRESS" ? "en cours" : round.status === "SUBMITTED" ? "soumise" : "validée"}</strong>
                {round.status === "IN_PROGRESS" && (
                  <button type="button" className="btn btn-primary" onClick={submit}>
                    Clôturer officiellement la partie
                  </button>
                )}
              </div>
              {submitMsg && <p role="status" className="muted small" style={{ marginTop: 8 }}>{submitMsg}</p>}
            </div>
          )}

          <div className="actions" style={{ marginTop: 22 }}>
            <Link className="btn btn-primary" href={`/round/${roundId}`}>Retour à la saisie</Link>
            <button type="button" className="btn btn-outline" onClick={() => window.print()}>Imprimer / Exporter la carte</button>
            <Link className="btn btn-outline" href="/round/new">Nouvelle partie</Link>
          </div>
        </div>
      </div>
    </main>
  );
}
