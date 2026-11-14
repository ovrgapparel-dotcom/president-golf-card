"use client";

import { useState } from "react";
import Link from "next/link";
import { Course3DViewer } from "@/components/course-3d-viewer";
import { getCourseModel } from "@/lib/virtual-tour";
import { COURSE_QUICK_FACTS, HOLES, LOCAL_RULES, TEE_SETS, type TeeKey } from "@/lib/course";
import { PageHeroBanner } from "@/components/page-hero-banner";

export default function CoursePage() {
  const [selectedTee, setSelectedTee] = useState<TeeKey>("WHITE");
  const model = getCourseModel();

  const currentTeeInfo = TEE_SETS.find((t) => t.code === selectedTee) ?? TEE_SETS[0];
  const outHoles = HOLES.slice(0, 9);
  const inHoles = HOLES.slice(9, 18);

  const outDist = outHoles.reduce((s, h) => s + h.distances[selectedTee], 0);
  const inDist = inHoles.reduce((s, h) => s + h.distances[selectedTee], 0);
  const totalDist = outDist + inDist;

  return (
    <main>
      {/* Luxury Hero Banner for Course Page */}
      <PageHeroBanner
        eyebrow="Domaine &amp; Caractéristiques Techniques"
        title="Le Parcours"
        titleHighlight="18 Trous"
        description="Fiche technique officielle, modélisation 3D interactive, distances par départ et règles locales du President Golf de Yamoussoukro."
        bgImage="/images/golf-lake-green.jpg"
        badge="PAR 72 · CHAMPIONNAT"
      >
        <Link className="btn btn-gold" href="/round/new">
          Démarrer une partie sur ce parcours
        </Link>
        <a className="btn btn-outline-white" href="#maquette-3d">
          🌐 Voir la maquette 3D
        </a>
      </PageHeroBanner>

      <div className="container" style={{ maxWidth: 1060, marginTop: -24, position: "relative", zIndex: 10 }}>
        {/* Quick Facts Card */}
        <section className="panel luxury-panel">
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Fiche d&apos;identité du club</div>
          <div className="facts-grid" style={{ marginTop: 12 }}>
            <div className="fact-item">
              <span className="fact-label">Emplacement</span>
              <strong className="fact-val">{COURSE_QUICK_FACTS.location}</strong>
            </div>
            <div className="fact-item">
              <span className="fact-label">Configuration</span>
              <strong className="fact-val">{COURSE_QUICK_FACTS.holes} trous · PAR {COURSE_QUICK_FACTS.par}</strong>
            </div>
            <div className="fact-item">
              <span className="fact-label">Statut d&apos;accès</span>
              <span className="badge-private">{COURSE_QUICK_FACTS.access}</span>
            </div>
            <div className="fact-item">
              <span className="fact-label">Année d&apos;inauguration</span>
              <strong className="fact-val">{COURSE_QUICK_FACTS.yearBuilt}</strong>
            </div>
            <div className="fact-item">
              <span className="fact-label">Exploitant</span>
              <strong className="fact-val">{COURSE_QUICK_FACTS.management}</strong>
            </div>
            <div className="fact-item">
              <span className="fact-label">Contact Club House</span>
              <strong className="fact-val">{COURSE_QUICK_FACTS.phone}</strong>
            </div>
          </div>
        </section>

        {/* 3D Model Section */}
        <section id="maquette-3d" style={{ marginTop: 44 }}>
          <div className="row" style={{ marginBottom: 14, flexWrap: "wrap" }}>
            <div>
              <span className="eyebrow-gold">Immersion Virtuelle</span>
              <h2 className="section-title-luxury" style={{ fontSize: 26, margin: "4px 0" }}>
                Maquette Numérique 3D du Domaine
              </h2>
            </div>
            <span className="badge-verified">100% Intégré dans l&apos;application</span>
          </div>
          <Course3DViewer model={model} />
        </section>

        {/* Official Scorecard Table */}
        <section style={{ marginTop: 48 }}>
          <div className="row" style={{ marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
            <div>
              <span className="eyebrow-gold">Tableau des Distances &amp; Difficultés</span>
              <h2 className="section-title-luxury" style={{ fontSize: 26, margin: "4px 0" }}>
                Carte de Parcours Officielle
              </h2>
            </div>
            {/* Tee Selector */}
            <div className="tee-filter-pills" role="tablist">
              {TEE_SETS.map((t) => (
                <button
                  key={t.code}
                  type="button"
                  role="tab"
                  aria-selected={selectedTee === t.code}
                  className={`tee-filter-pill ${selectedTee === t.code ? "active" : ""}`}
                  onClick={() => setSelectedTee(t.code)}
                >
                  <span className={`tee-dot dot-${t.code.toLowerCase()}`} />
                  {t.label} ({t.distance})
                </button>
              ))}
            </div>
          </div>

          <div className="panel luxury-panel" style={{ overflowX: "auto", padding: 0 }}>
            <table className="score-table course-table">
              <thead>
                <tr className="table-head-row">
                  <th>Trou</th>
                  <th>PAR</th>
                  <th>Index (HCP)</th>
                  <th>Distance ({currentTeeInfo.label})</th>
                  <th>Particularité</th>
                </tr>
              </thead>
              <tbody>
                <tr className="section-divider-row">
                  <td colSpan={5}>
                    <strong>ALLER (Trous 1 à 9) — PAR 36 · {outDist} m</strong>
                  </td>
                </tr>
                {outHoles.map((h) => (
                  <tr key={h.number} className={h.isSignatureHole ? "highlight-hole-row" : ""}>
                    <td><strong>Trou {h.number}</strong></td>
                    <td><span className="par-badge">{h.par}</span></td>
                    <td>{h.strokeIndex}</td>
                    <td><strong>{h.distances[selectedTee]} m</strong></td>
                    <td className="muted small">{h.description ?? "—"}</td>
                  </tr>
                ))}
                <tr className="subtotal-row">
                  <td><strong>TOTAL ALLER</strong></td>
                  <td><strong>36</strong></td>
                  <td>—</td>
                  <td><strong>{outDist} m</strong></td>
                  <td>—</td>
                </tr>
                <tr className="section-divider-row">
                  <td colSpan={5}>
                    <strong>RETOUR (Trous 10 à 18) — PAR 36 · {inDist} m</strong>
                  </td>
                </tr>
                {inHoles.map((h) => (
                  <tr key={h.number} className={h.isSignatureHole ? "highlight-hole-row" : ""}>
                    <td>
                      <strong>Trou {h.number}</strong>
                      {h.isSignatureHole && <span className="signature-pill">Trou Signature ⭐</span>}
                    </td>
                    <td><span className="par-badge">{h.par}</span></td>
                    <td>{h.strokeIndex}</td>
                    <td><strong>{h.distances[selectedTee]} m</strong></td>
                    <td className={h.isSignatureHole ? "signature-text" : "muted small"}>
                      {h.description ?? "—"}
                    </td>
                  </tr>
                ))}
                <tr className="subtotal-row">
                  <td><strong>TOTAL RETOUR</strong></td>
                  <td><strong>36</strong></td>
                  <td>—</td>
                  <td><strong>{inDist} m</strong></td>
                  <td>—</td>
                </tr>
                <tr className="grandtotal-row">
                  <td><strong>TOTAL PARCOURS (18 trous)</strong></td>
                  <td><strong>72</strong></td>
                  <td>—</td>
                  <td><strong>{totalDist} m</strong></td>
                  <td>Validé conforme carte club</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Local Rules Section */}
        <section id="regles" className="panel luxury-panel" style={{ marginTop: 36 }}>
          <div className="eyebrow" style={{ color: "var(--gold)" }}>Règlement officiel</div>
          <h2 style={{ fontSize: 22, marginTop: 6, marginBottom: 16 }}>Règles locales du parcours</h2>
          <ul className="rules-list">
            {LOCAL_RULES.map((rule, idx) => (
              <li key={idx} className="rule-item">
                <span className="rule-num">{idx + 1}</span>
                <span className="rule-text">{rule}</span>
              </li>
            ))}
          </ul>
        </section>

        {/* CTA */}
        <div className="actions" style={{ marginTop: 32, justifyContent: "center" }}>
          <Link className="btn btn-gold" href="/round/new">Démarrer une partie sur ce parcours</Link>
          <Link className="btn btn-outline" href="/">Retour à l’accueil</Link>
        </div>
      </div>
    </main>
  );
}
