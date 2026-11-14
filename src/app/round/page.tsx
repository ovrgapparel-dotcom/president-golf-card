"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getRounds } from "@/lib/round-storage";
import { PageHeroBanner } from "@/components/page-hero-banner";
import type { LocalRound } from "@/lib/types";

export default function RoundsPage() {
  const [rounds, setRounds] = useState<LocalRound[]>([]);

  useEffect(() => {
    setRounds(getRounds());
  }, []);

  return (
    <main>
      <PageHeroBanner
        eyebrow="Historique des Parties"
        title="Mes Cartes"
        titleHighlight="Enregistrées"
        description="Retrouvez vos cartes de score en cours ou terminées sur cet appareil. Vos données restent accessibles même sans connexion internet."
        bgImage="/images/clubhouse-aerial.jpg"
        badge={`${rounds.length} PARTIE(S)`}
      >
        <Link className="btn btn-gold" href="/round/new">
          + Nouvelle partie
        </Link>
      </PageHeroBanner>

      <div className="container" style={{ maxWidth: 820, marginTop: -24, position: "relative", zIndex: 10 }}>
        {rounds.length === 0 ? (
          <div className="panel luxury-panel" style={{ textAlign: "center", padding: "44px 20px" }}>
            <div style={{ fontSize: 40 }}>📋</div>
            <h3 style={{ marginTop: 12, fontSize: 20 }}>Aucune partie enregistrée sur cet appareil</h3>
            <p className="muted" style={{ maxWidth: 460, margin: "8px auto 20px" }}>
              Créez une première carte de score individuelle ou collective pour débuter votre parcours au President Golf.
            </p>
            <Link className="btn btn-primary" href="/round/new">
              Créer ma première carte
            </Link>
          </div>
        ) : (
          <div className="stack">
            {rounds.map((round) => (
              <div className="panel luxury-panel row" key={round.id} style={{ alignItems: "center" }}>
                <div>
                  <div className="eyebrow" style={{ color: "var(--gold)" }}>
                    Départ {round.teeCode} · {round.status === "VALIDATED" || round.status === "SUBMITTED" ? "Carte clôturée" : "En cours"}
                  </div>
                  <strong style={{ fontSize: 18, display: "block", marginTop: 4 }}>
                    {round.players.map((p) => p.name).join(", ")}
                  </strong>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Créée le {new Date(round.createdAt).toLocaleString("fr-FR")} · {Object.keys(round.scores).length}/18 trous saisis
                  </div>
                </div>
                <div className="actions" style={{ margin: 0 }}>
                  <Link className="btn btn-outline small" href={`/round/${round.id}/summary`}>
                    Résumé
                  </Link>
                  <Link className="btn btn-primary small" href={`/round/${round.id}`}>
                    Ouvrir la carte →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
