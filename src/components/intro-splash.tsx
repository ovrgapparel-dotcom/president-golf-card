"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

export function IntroSplash() {
  const [visible, setVisible] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // Check if intro has already been displayed during this session
    const hasSeen = sessionStorage.getItem("pg_intro_played");
    if (!hasSeen) {
      setVisible(true);
      const fadeTimer = setTimeout(() => {
        setFading(true);
      }, 2600);
      const hideTimer = setTimeout(() => {
        setVisible(false);
        sessionStorage.setItem("pg_intro_played", "1");
      }, 3400);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(hideTimer);
      };
    }
  }, []);

  const handleSkip = () => {
    setFading(true);
    setTimeout(() => {
      setVisible(false);
      sessionStorage.setItem("pg_intro_played", "1");
    }, 400);
  };

  if (!visible) return null;

  return (
    <div
      className={`intro-splash-overlay ${fading ? "intro-fade-out" : ""}`}
      role="dialog"
      aria-modal="true"
      aria-label="Bienvenue au President Golf de Yamoussoukro"
    >
      <div className="intro-backdrop-glow" />
      <div className="intro-content">
        <div className="intro-crest-wrap">
          <div className="intro-aura" />
          <Image
            src="/crest-intro.png"
            alt="Blason d'Or President Golf Yamoussoukro"
            width={180}
            height={180}
            priority
            className="intro-crest-img"
          />
        </div>

        <div className="intro-typography">
          <div className="intro-eyebrow">Excellence · Tradition · Prestige</div>
          <h1 className="intro-title">PRESIDENT GOLF</h1>
          <div className="intro-subtitle">YAMOUSSOUKRO · CÔTE D’IVOIRE</div>
          <div className="intro-tagline">18 Trous de Championnat · PAR 72</div>
        </div>

        <div className="intro-loader-line">
          <div className="intro-loader-bar" />
        </div>

        <button
          type="button"
          onClick={handleSkip}
          className="intro-enter-btn"
        >
          Entrer sur le parcours →
        </button>
      </div>
    </div>
  );
}
