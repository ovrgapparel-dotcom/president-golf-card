import Link from "next/link";
import Image from "next/image";

export function SiteHeader() {
  return (
    <header className="topbar">
      <div className="container topbar-inner">
        <Link href="/" className="brand" aria-label="President Golf Yamoussoukro accueil">
          <div className="brand-logo-wrap">
            <Image
              src="/logo.png"
              alt="Blason President Golf Yamoussoukro"
              width={44}
              height={44}
              priority
              className="brand-logo-img"
            />
          </div>
          <div className="brand-text">
            <span className="brand-title">PRESIDENT GOLF</span>
            <span className="brand-subtitle">Yamoussoukro · Côte d’Ivoire</span>
          </div>
        </Link>
        <nav className="header-nav" aria-label="Navigation principale">
          <Link href="/round/new" className="nav-link">Nouvelle partie</Link>
          <Link href="/course" className="nav-link">Parcours 3D</Link>
          <Link href="/round" className="nav-link">Mes parties</Link>
        </nav>
      </div>
    </header>
  );
}
