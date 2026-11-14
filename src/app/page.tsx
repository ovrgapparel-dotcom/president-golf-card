import Link from "next/link";
import Image from "next/image";
// course data used via InteractiveCourseMap
import { IntroSplash } from "@/components/intro-splash";
import { PageHeroBanner } from "@/components/page-hero-banner";
import { InteractiveCourseMap } from "@/components/interactive-course-map";

export default function HomePage() {
  return (
    <>
      {/* Intro Animation with Golf Crest */}
      <IntroSplash />

      <main className="main-content">
        {/* Luxury Hero Banner */}
        <PageHeroBanner
          eyebrow="Club Privé de Prestige · Fondé en 1979"
          title="President Golf"
          titleHighlight="Yamoussoukro"
          description="Découvrez le parcours de championnat 18 trous de Yamoussoukro. Carte de score digitale de précision, géolocalisation sur le terrain et modélisation 3D interactive."
          bgImage="/images/hero-tee-hotel.jpg"
          badge="PAR 72 · 6 015 MÈTRES"
        >
          <Link className="btn btn-gold" href="/round/new">
            ⛳ Démarrer une partie
          </Link>
          <a className="btn btn-outline-white" href="#carte-parcours">
            🗺️ Explorer la carte &amp; GPS
          </a>
          <Link className="btn btn-outline-white" href="/round">
            📋 Mes cartes enregistrées
          </Link>
        </PageHeroBanner>

        <div className="container" style={{ marginTop: -32, position: "relative", zIndex: 10 }}>
          {/* Quick Tee Distances Bar */}
          <div className="luxury-stats-strip">
            <div className="strip-item">
              <span className="strip-label">Parcours officiel</span>
              <strong className="strip-val">18 Trous · PAR 72</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Départs Blancs</span>
              <strong className="strip-val">6 015 m</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Départs Jaunes</span>
              <strong className="strip-val">5 680 m</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Départs Bleus</span>
              <strong className="strip-val">5 221 m</strong>
            </div>
            <div className="strip-item">
              <span className="strip-label">Départs Rouges</span>
              <strong className="strip-val">5 107 m</strong>
            </div>
          </div>

          {/* Section 1: The Featured Interactive Golf Course Map & GPS */}
          <section id="carte-parcours" style={{ marginTop: 44 }}>
            <div className="section-header-luxury">
              <span className="eyebrow-gold">Navigation &amp; Topographie</span>
              <h2 className="section-title-luxury">
                Carte du Parcours &amp; <span className="gold-gradient-text">Localisation GPS</span>
              </h2>
              <p className="section-desc-luxury">
                Visualisez la vue satellite officielle du domaine ou la maquette 3D immersive.
                Naviguez trou par trou, consultez les distances exactes et activez votre position en temps réel.
              </p>
            </div>

            <InteractiveCourseMap />
          </section>

          {/* Section 2: Club Heritage & Photo Showcase */}
          <section style={{ marginTop: 64 }}>
            <div className="section-header-luxury">
              <span className="eyebrow-gold">Patrimoine &amp; Cadre d&apos;Exception</span>
              <h2 className="section-title-luxury">
                Le Joyau de la Capitale <span className="gold-gradient-text">aux Mille Lacs</span>
              </h2>
            </div>

            <div className="gallery-showcase-grid">
              <div className="gallery-card">
                <div className="gallery-img-wrap">
                  <Image
                    src="/images/clubhouse-aerial.jpg"
                    alt="Vue aérienne du Club House et de la piscine du President Golf"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="gallery-img"
                  />
                </div>
                <div className="gallery-caption">
                  <span className="gallery-tag">Architecture</span>
                  <h3>Le Club House &amp; Piscine</h3>
                  <p>Un ensemble iconique conçu pour l&apos;accueil des golfeurs et des compétitions internationales.</p>
                </div>
              </div>

              <div className="gallery-card">
                <div className="gallery-img-wrap">
                  <Image
                    src="/images/golf-lake-green.jpg"
                    alt="Trou n°12 en bordure de lac au President Golf"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="gallery-img"
                  />
                </div>
                <div className="gallery-caption">
                  <span className="gallery-tag">Trou Signature</span>
                  <h3>Le Trou n°12 &amp; Green en Île</h3>
                  <p>Un PAR 3 d&apos;anthologie cerclé par le lac naturel de Yamoussoukro avec dropping zone dédiée.</p>
                </div>
              </div>

              <div className="gallery-card">
                <div className="gallery-img-wrap">
                  <Image
                    src="/images/hotel-president.jpg"
                    alt="Hôtel Président de Yamoussoukro"
                    fill
                    sizes="(max-width: 768px) 100vw, 33vw"
                    className="gallery-img"
                  />
                </div>
                <div className="gallery-caption">
                  <span className="gallery-tag">Hôtellerie 5 Étoiles</span>
                  <h3>L&apos;Hôtel Président</h3>
                  <p>Dominant le parcours avec sa tour emblématique et ses prestations haut de gamme sous gestion SODERTOUR.</p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 3: Luxury Features Grid */}
          <section style={{ marginTop: 54 }} className="grid-3">
            <div className="panel luxury-panel">
              <div className="luxury-icon-wrap">⛳</div>
              <h3 style={{ fontSize: 20, marginTop: 12 }}>Carte de Score Digitale</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                Saisie simple trou par trou adaptée aux gants de golf, calcul des totaux Aller / Retour,
                handicap et écart au PAR en direct.
              </p>
              <div style={{ marginTop: 16 }}>
                <Link className="btn btn-outline small" href="/round/new">
                  Créer une carte de score →
                </Link>
              </div>
            </div>

            <div className="panel luxury-panel">
              <div className="luxury-icon-wrap">🌐</div>
              <h3 style={{ fontSize: 20, marginTop: 12 }}>Relief 3D Intégré</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                Explorez le relief et le dénivelé des 18 trous directement dans l&apos;application, sans
                aucune redirection externe.
              </p>
              <div style={{ marginTop: 16 }}>
                <Link className="btn btn-outline small" href="/course">
                  Consulter la maquette 3D →
                </Link>
              </div>
            </div>

            <div className="panel luxury-panel">
              <div className="luxury-icon-wrap">📜</div>
              <h3 style={{ fontSize: 20, marginTop: 12 }}>Règles Locales &amp; Certifications</h3>
              <p className="muted" style={{ marginTop: 8 }}>
                Attestation officielle, contre-signature du marqueur et règles locales du R&amp;A respectées.
                Fonctionnement hors-ligne garanti.
              </p>
              <div style={{ marginTop: 16 }}>
                <Link className="btn btn-outline small" href="/course#regles">
                  Consulter les règles locales →
                </Link>
              </div>
            </div>
          </section>
        </div>
      </main>
    </>
  );
}
