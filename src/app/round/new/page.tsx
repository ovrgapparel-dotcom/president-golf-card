import { NewRoundForm } from "@/components/new-round-form";
import { PageHeroBanner } from "@/components/page-hero-banner";

export default function NewRoundPage() {
  return (
    <main>
      <PageHeroBanner
        eyebrow="Configuration de la Partie"
        title="Nouvelle Carte"
        titleHighlight="de Score"
        description="Sélectionnez la série de départs de votre groupe et ajoutez les joueurs. La carte sera sauvegardée en continu sur cet appareil et synchronisée en ligne."
        bgImage="/images/fairway-lake.jpg"
        badge="PARTIE LIBRE OU GROUPE"
      />

      <div className="container" style={{ maxWidth: 760, marginTop: -24, position: "relative", zIndex: 10 }}>
        <NewRoundForm />
      </div>
    </main>
  );
}
