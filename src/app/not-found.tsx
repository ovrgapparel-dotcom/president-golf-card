import Link from "next/link";

export default function NotFound() {
  return <main><div className="container"><div className="panel"><h1 style={{ fontSize: 36 }}>Page introuvable</h1><p className="muted">La page demandée n’existe pas.</p><Link href="/" className="btn btn-primary">Retour à l’accueil</Link></div></div></main>;
}
