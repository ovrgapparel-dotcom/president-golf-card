/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import type { CourseModel } from "@/lib/virtual-tour";

export interface Course3DViewerRef {
  jumpToHole: (holeNumber: number) => void;
}

interface Course3DViewerProps {
  model: CourseModel | null;
  selectedHole?: number;
  onAnnotationSelect?: (holeNumber: number) => void;
}

export const Course3DViewer = forwardRef<Course3DViewerRef, Course3DViewerProps>(
  function Course3DViewer({ model, selectedHole, onAnnotationSelect }, ref) {
    const box = useRef<HTMLDivElement>(null);
    const iframeRef = useRef<HTMLIFrameElement>(null);
    const apiRef = useRef<any>(null);
    const [loaded, setLoaded] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const annotationsRef = useRef<Array<{ title: string; index: number }>>([]);

    const onAnnotationSelectRef = useRef(onAnnotationSelect);
    onAnnotationSelectRef.current = onAnnotationSelect;

    // Jump to annotation matching a hole number (e.g. "Start Hole #7", "Hole 7", or 0-indexed index)
    const jumpToHole = (holeNum: number) => {
      const api = apiRef.current;
      if (!api) return;

      const list = annotationsRef.current;
      if (list && list.length > 0) {
        // Look for match by title regex (e.g. "Hole #7", "Trou 7", "Hole 7")
        const regex = new RegExp(`(?:hole|trou)\\s*(?:#|n°)?\\s*${holeNum}\\b`, "i");
        const found = list.find((item) => regex.test(item.title));

        if (found) {
          api.gotoAnnotation(found.index, { preventCameraAnimation: false });
          return;
        }

        // Fallback: 1-indexed (index holeNum - 1)
        if (list[holeNum - 1]) {
          api.gotoAnnotation(holeNum - 1, { preventCameraAnimation: false });
          return;
        }
      }

      // Default fallback by index
      try {
        api.gotoAnnotation(holeNum - 1, { preventCameraAnimation: false });
      } catch {
        // ignore
      }
    };

    useImperativeHandle(ref, () => ({
      jumpToHole,
    }));

    // Trigger jump whenever selectedHole prop changes
    useEffect(() => {
      if (loaded && selectedHole) {
        jumpToHole(selectedHole);
      }
    }, [selectedHole, loaded]);

    // Initialize Sketchfab Viewer API once per modelId
    const modelId = model?.modelId;
    const isInitializingRef = useRef(false);

    useEffect(() => {
      if (!modelId || !iframeRef.current) return;
      if (apiRef.current || isInitializingRef.current) return; // Prevent multiple client.init calls

      let isMounted = true;
      isInitializingRef.current = true;

      function initApi() {
        const Sketchfab = (window as any).Sketchfab;
        if (!Sketchfab || !iframeRef.current) return;

        const client = new Sketchfab(iframeRef.current);
        client.init(modelId, {
          autostart: 1,
          preload: 1,
          ui_hint: 2,
          success: (api: any) => {
            if (!isMounted) return;
            apiRef.current = api;
            api.start();

            api.addEventListener("viewerready", () => {
              if (!isMounted) return;
              setLoaded(true);

              // Query available annotations
              api.getAnnotationList((err: any, annotations: any[]) => {
                if (!err && annotations) {
                  annotationsRef.current = annotations.map((a, i) => ({
                    title: a.title || `Annotation ${i + 1}`,
                    index: i,
                  }));

                  // If an initial hole is selected, jump to it
                  if (selectedHole) {
                    jumpToHole(selectedHole);
                  }
                }
              });

              // Listen for clicks on 3D annotations
              api.addEventListener("annotationSelect", (index: number) => {
                if (index >= 0 && onAnnotationSelectRef.current) {
                  const item = annotationsRef.current[index];
                  if (item) {
                    const match = item.title.match(/(?:hole|trou)\s*(?:#|n°)?\s*(\d+)/i);
                    if (match) {
                      const num = parseInt(match[1], 10);
                      onAnnotationSelectRef.current(num);
                      return;
                    }
                  }
                  // Fallback: index + 1
                  onAnnotationSelectRef.current(index + 1);
                }
              });
            });
          },
          error: () => {
            console.error("Sketchfab Viewer API failed to initialize.");
            isInitializingRef.current = false;
          },
        });
      }

      // Check if script is already available
      if ((window as any).Sketchfab) {
        initApi();
      } else {
        const interval = setInterval(() => {
          if ((window as any).Sketchfab) {
            clearInterval(interval);
            initApi();
          }
        }, 100);
        return () => {
          clearInterval(interval);
          isMounted = false;
        };
      }

      return () => {
        isMounted = false;
      };
    }, [modelId]);

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
          data-viewer-state={loaded ? "ready" : "loading"}
        >
          <iframe
            ref={iframeRef}
            id="sketchfab-api-frame"
            title="Modèle 3D immersif du President Golf de Yamoussoukro"
            src=""
            allow="autoplay; fullscreen; xr-spatial-tracking"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
          {!loaded && (
            <div className="viewer-overlay" role="status">
              <div className="viewer-spinner" />
              <p style={{ marginTop: 12 }}>Chargement du relief 3D et des 18 trous…</p>
            </div>
          )}
        </div>

        <div className="viewer-controls-bar">
          <div className="viewer-tips">
            <span className="viewer-tip-badge">Navigation 3D</span>
            <span className="muted small">
              Faire pivoter : <strong>Clic gauche</strong> · Zoom : <strong>Molette / Pincer</strong> · Déplacer : <strong>Clic droit</strong>
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
);
