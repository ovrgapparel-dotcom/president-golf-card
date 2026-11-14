import { Scorecard } from "@/components/scorecard";
import { PageHeroBanner } from "@/components/page-hero-banner";

export default async function RoundPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <main>
      <PageHeroBanner
        eyebrow="En direct sur le terrain"
        title="Partie en Cours"
        titleHighlight="· Yamoussoukro"
        description="Saisie des scores trou par trou avec sauvegardes automatiques. Consultez les distances, PAR et index du trou actif."
        bgImage="/images/hero-tee-hotel.jpg"
        badge="SCORECARD LIVE"
      />

      <div className="container" style={{ maxWidth: 1040, marginTop: -24, position: "relative", zIndex: 10 }}>
        <Scorecard roundId={id} />
      </div>
    </main>
  );
}
