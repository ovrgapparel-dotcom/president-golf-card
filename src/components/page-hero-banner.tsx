import React from "react";
import Image from "next/image";

type HeroBannerProps = {
  eyebrow: string;
  title: string;
  titleHighlight?: string;
  description: string;
  bgImage?: string;
  badge?: string;
  children?: React.ReactNode;
};

export function PageHeroBanner({
  eyebrow,
  title,
  titleHighlight,
  description,
  bgImage = "/images/clubhouse-aerial.jpg",
  badge,
  children,
}: HeroBannerProps) {
  return (
    <div className="page-hero-banner">
      <div className="page-hero-bg">
        <Image
          src={bgImage}
          alt="President Golf de Yamoussoukro"
          fill
          priority
          sizes="100vw"
          className="page-hero-bg-img"
        />
        <div className="page-hero-overlay" />
      </div>

      <div className="container page-hero-content">
        <div className="page-hero-text">
          <div className="page-hero-meta">
            <span className="page-hero-eyebrow">{eyebrow}</span>
            {badge && <span className="badge-luxury-gold">{badge}</span>}
          </div>
          <h1 className="page-hero-title">
            {title} {titleHighlight && <span className="gold-gradient-text">{titleHighlight}</span>}
          </h1>
          <p className="page-hero-desc">{description}</p>
          {children && <div className="page-hero-actions">{children}</div>}
        </div>
      </div>
    </div>
  );
}
