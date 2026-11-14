"use client";

import { useEffect, useRef, useState } from "react";
import type { CourseModel } from "@/lib/virtual-tour";

const SLOW_MS = 15000;

/**
 * Responsive In-App Sketchfab 3D Viewer.
 * Keeps the user strictly within the application (no external redirects).
 * Includes fullscreen toggle and interaction guide.
 */
export function Course3DViewer({ model }: { model: CourseModel | null }) {
  const box = useRef<HTMLDivElement>(null);
  const [near, setNear] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [slow, setSlow] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNear(true);
          io.disconnect();
        }
      },
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near || loaded) return;
    const t = window.setTimeout(() => setSlow(true), SLOW_MS);
    return () => window.clearTimeout(t);
  }, [near, loaded]);

  const toggleFullscreen = () => {
    if (!box.current) return;
    if (!document.fullscreenElement) {
      box.current.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  if (!model) {
    return (
      <div className="panel" style={{ textAlign: "center", padding: "40px 20px" }}>
        <strong>Modèle 3D en cours de chargement</strong>
        <p className="muted small" style={{ marginTop: 8 }}>
          La maquette numérique 3D sera disponible sous peu.
        </p>
      </div>
    );
  }

  return (
    <div className="viewer-container stack">
      <div
        ref={box}
        className={`viewer-frame ${isFullscreen ? "viewer-fullscreen" : ""}`}
        data-viewer-state={loaded ? "ready" : near ? "loading" : "idle"}
      >
        {near && (
          <iframe
            title="Modèle 3D immersif du President Golf de Yamoussoukro"
            src={model.embedUrl}
            loading="lazy"
            allow="autoplay; fullscreen; xr-spatial-tracking"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            onLoad={() => setLoaded(true)}
          />
        )}
        {!loaded && (
          <div className="viewer-overlay" role="status">
            <div className="viewer-spinner" />
            <p style={{ marginTop: 12 }}>
              {near
                ? slow
                  ? "Chargement de la topographie haute résolution…"
                  : "Chargement du modèle 3D interactif…"
                : "Initialisation du relief 3D…"}
            </p>
          </div>
        )}
      </div>

      <div className="viewer-controls-bar">
        <div className="viewer-tips">
          <span className="viewer-tip-badge">Navigation 3D</span>
          <span className="muted small">
            Faire pivoter : <strong>Clic gauche / Glisser</strong> · Zoom : <strong>Molette / Pincer</strong> · Déplacer : <strong>Clic droit</strong>
          </span>
        </div>
        <div className="viewer-actions">
          <button
            type="button"
            className="btn btn-outline small"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Quitter le plein écran" : "Afficher en plein écran"}
          >
            {isFullscreen ? "⤓ Réduire" : "⤢ Plein écran"}
          </button>
        </div>
      </div>
    </div>
  );
}
