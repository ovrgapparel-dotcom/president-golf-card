/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, LayerGroup, Marker, TileLayer } from "leaflet";
import { HOLES } from "@/lib/course";
import { Course3DViewer } from "@/components/course-3d-viewer";
import { getCourseModel } from "@/lib/virtual-tour";
import Link from "next/link";

// Official coordinates for the 18 holes of Président Golf Club (adjacent to Hôtel Président, Yamoussoukro)
// Anchor: Clubhouse/Pool (Roger Taillibert bldg) = 6.7971, -5.2533 (SW corner, near road)
// Bounding box: Lat 6.7912 - 6.8005, Lon -5.2539 - -5.2428
// Layout calibrated from 3D model bird's-eye: holes radiate NE from clubhouse in a loop
const HOLE_COORDS: Record<number, { lat: number; lng: number; greenLat: number; greenLng: number }> = {
  1:  { lat: 6.7976, lng: -5.2528, greenLat: 6.7995, greenLng: -5.2518 }, // Start near clubhouse → N
  2:  { lat: 6.7998, lng: -5.2525, greenLat: 6.8002, greenLng: -5.2510 }, // Upper-left
  3:  { lat: 6.8002, lng: -5.2508, greenLat: 6.7998, greenLng: -5.2492 }, // Upper-left → E
  4:  { lat: 6.7996, lng: -5.2490, greenLat: 6.7984, greenLng: -5.2478 }, // Upper-center-left
  5:  { lat: 6.7988, lng: -5.2518, greenLat: 6.7995, greenLng: -5.2508 }, // Left side returning
  6:  { lat: 6.7956, lng: -5.2522, greenLat: 6.7948, greenLng: -5.2508 }, // Left-middle
  7:  { lat: 6.7946, lng: -5.2506, greenLat: 6.7948, greenLng: -5.2490 }, // Center-left
  8:  { lat: 6.7962, lng: -5.2492, greenLat: 6.7982, greenLng: -5.2490 }, // Center going N
  9:  { lat: 6.7984, lng: -5.2478, greenLat: 6.7976, greenLng: -5.2458 }, // Upper-center → E
  10: { lat: 6.7968, lng: -5.2522, greenLat: 6.7958, greenLng: -5.2508 }, // Near clubhouse (return side)
  11: { lat: 6.7956, lng: -5.2504, greenLat: 6.7944, greenLng: -5.2486 }, // Center
  12: { lat: 6.7940, lng: -5.2480, greenLat: 6.7930, greenLng: -5.2462 }, // Center → lake area
  13: { lat: 6.7926, lng: -5.2455, greenLat: 6.7932, greenLng: -5.2440 }, // Near lake / right
  14: { lat: 6.7936, lng: -5.2436, greenLat: 6.7960, greenLng: -5.2440 }, // Right side → N
  15: { lat: 6.7963, lng: -5.2438, greenLat: 6.7984, greenLng: -5.2448 }, // Upper-right
  16: { lat: 6.7986, lng: -5.2452, greenLat: 6.7986, greenLng: -5.2468 }, // Upper-right → W
  17: { lat: 6.7980, lng: -5.2470, greenLat: 6.7974, greenLng: -5.2486 }, // Center-right → W
  18: { lat: 6.7972, lng: -5.2490, greenLat: 6.7971, greenLng: -5.2525 }, // Return to clubhouse
};

function calculateDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3;
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function InteractiveCourseMap() {
  const [selectedHole, setSelectedHole] = useState<number>(1);
  const [activeTab, setActiveTab] = useState<"3d" | "map">("3d");
  const [mapLayer, setMapLayer] = useState<"satellite" | "osm">("satellite");
  const [filters, setFilters] = useState({
    departs: true,
    greens: true,
    fairways: true,
    bunkers: true,
    eau: true,
    autres: true,
  });

  // GPS state
  const [gpsActive, setGpsActive] = useState<boolean>(false);
  const [gpsError, setGpsError] = useState<string>("");
  const [playerPos, setPlayerPos] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [watchId, setWatchId] = useState<number | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<LeafletMap | null>(null);
  const markersLayerRef = useRef<LayerGroup | null>(null);
  const playerMarkerRef = useRef<Marker | null>(null);
  const tileLayerRef = useRef<TileLayer | null>(null);

  // Keep stable refs for values used inside async map callbacks
  const selectedHoleRef = useRef(selectedHole);
  const filtersRef = useRef(filters);
  selectedHoleRef.current = selectedHole;
  filtersRef.current = filters;

  const currentHoleData = HOLES[selectedHole - 1];
  const model3D = getCourseModel();

  function drawMapFeatures(map: any, layer: any, LInstance: any, holeNum: number, currentFilters: typeof filters) {
    layer.clearLayers();

    Object.entries(HOLE_COORDS).forEach(([numStr, coords]) => {
      const n = Number(numStr);
      const isCurrent = n === holeNum;

      if (currentFilters.departs) {
        const teeIcon = LInstance.divIcon({
          className: "custom-golf-marker",
          html: `<div class="marker-tee ${isCurrent ? "marker-active-tee" : ""}">T${n}</div>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        });
        const teeMarker = LInstance.marker([coords.lat, coords.lng], { icon: teeIcon })
          .bindPopup(`<strong>Trou ${n} — Départ</strong><br/>PAR ${HOLES[n - 1].par} · Index ${HOLES[n - 1].strokeIndex}`)
          .on("click", () => setSelectedHole(n));
        layer.addLayer(teeMarker);
      }

      if (currentFilters.greens) {
        const greenIcon = LInstance.divIcon({
          className: "custom-golf-marker",
          html: `<div class="marker-green ${isCurrent ? "marker-active-green" : ""}">⛳${n}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });
        const greenMarker = LInstance.marker([coords.greenLat, coords.greenLng], { icon: greenIcon })
          .bindPopup(`<strong>Trou ${n} — Green</strong><br/>Distance Blanc : ${HOLES[n - 1].distances.WHITE} m`)
          .on("click", () => setSelectedHole(n));
        layer.addLayer(greenMarker);
      }

      if (isCurrent && currentFilters.fairways) {
        const line = LInstance.polyline(
          [[coords.lat, coords.lng], [coords.greenLat, coords.greenLng]],
          { color: "#c89f53", weight: 3, dashArray: "6, 8", opacity: 0.9 }
        );
        layer.addLayer(line);
      }
    });

    if (currentFilters.eau) {
      const waterIcon = LInstance.divIcon({
        className: "custom-golf-marker",
        html: `<div class="marker-water">💧 Lac aux Crocodiles</div>`,
        iconSize: [120, 24],
      });
      const waterMarker = LInstance.marker([6.7932, -5.2448], { icon: waterIcon }).bindPopup(
        "<strong>Obstacle d'Eau Principal (Lac)</strong><br/>Obstacle d'eau frontal avec dropping zone officielle."
      );
      layer.addLayer(waterMarker);
    }

    if (currentFilters.autres) {
      const clubIcon = LInstance.divIcon({
        className: "custom-golf-marker",
        html: `<div class="marker-tee marker-active-tee" style="background:#0a271d;border:2px solid #c89f53;color:#c89f53;font-weight:700;width:auto;padding:2px 8px;border-radius:12px;font-size:11px;">🏛️ Club-House / Piscine</div>`,
        iconSize: [140, 24],
        iconAnchor: [70, 12],
      });
      const clubMarker = LInstance.marker([6.7971, -5.2533], { icon: clubIcon }).bindPopup(
        "<strong>Club-House du Président Golf</strong><br/>Bâtiment Roger Taillibert, Pro Shop, Piscine & Lounge (Point 19 sur la maquette)."
      );
      layer.addLayer(clubMarker);
    }

    const target = HOLE_COORDS[holeNum];
    if (target) {
      map.flyTo([(target.lat + target.greenLat) / 2, (target.lng + target.greenLng) / 2], 16, {
        duration: 1.2,
      });
    }
  }

  // Initialize Leaflet Map (only once, when map tab is first shown)
  // drawMapFeatures and mapLayer are intentionally excluded — handled by dedicated effects below
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      if (typeof window === "undefined" || !mapContainerRef.current) return;
      const L = (await import("leaflet")).default;
      if (!isMounted) return;

      if (!mapInstanceRef.current && mapContainerRef.current) {
        const map = L.map(mapContainerRef.current, {
          center: [6.7958, -5.2483],
          zoom: 16,
          zoomControl: false,
        });

        L.control.zoom({ position: "topright" }).addTo(map);
        L.control.scale({ imperial: false, position: "bottomright" }).addTo(map);

        const satelliteUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
        const osmUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";

        const tileLayer = L.tileLayer(mapLayer === "satellite" ? satelliteUrl : osmUrl, {
          attribution: "Imagerie © Esri & contributeurs",
          maxZoom: 19,
        }).addTo(map);

        tileLayerRef.current = tileLayer;
        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;
        mapInstanceRef.current = map;

        drawMapFeatures(map, markersLayer, L, selectedHoleRef.current, filtersRef.current);
      }
    }

    if (activeTab === "map") {
      void initLeaflet();
    }

    return () => { isMounted = false; };
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Swap tile layer when mapLayer changes
  useEffect(() => {
    if (!mapInstanceRef.current || !tileLayerRef.current) return;
    const satelliteUrl = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    const osmUrl = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
    tileLayerRef.current.setUrl(mapLayer === "satellite" ? satelliteUrl : osmUrl);
  }, [mapLayer]);

  // Redraw markers when selectedHole or filters change
  useEffect(() => {
    if (!mapInstanceRef.current || !markersLayerRef.current) return;
    void import("leaflet").then((mod) => {
      if (mapInstanceRef.current && markersLayerRef.current) {
        drawMapFeatures(
          mapInstanceRef.current,
          markersLayerRef.current,
          mod.default,
          selectedHole,
          filters
        );
      }
    });
  }, [selectedHole, filters]); // eslint-disable-line react-hooks/exhaustive-deps

  // Toggle GPS
  const toggleGps = () => {
    if (gpsActive) {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      setGpsActive(false);
      setPlayerPos(null);
      if (playerMarkerRef.current && mapInstanceRef.current) {
        mapInstanceRef.current.removeLayer(playerMarkerRef.current);
        playerMarkerRef.current = null;
      }
      return;
    }

    if (!("geolocation" in navigator)) {
      setGpsError("La géolocalisation n'est pas supportée par votre navigateur.");
      return;
    }

    setGpsError("");
    setGpsActive(true);

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        setPlayerPos({ lat: latitude, lng: longitude, accuracy: Math.round(accuracy) });

        if (mapInstanceRef.current) {
          void import("leaflet").then((mod) => {
            if (!playerMarkerRef.current && mapInstanceRef.current) {
              const playerIcon = mod.default.divIcon({
                className: "custom-golf-marker",
                html: `<div class="marker-player"><div class="player-dot"></div><div class="player-pulse"></div></div>`,
                iconSize: [24, 24],
                iconAnchor: [12, 12],
              });
              playerMarkerRef.current = mod.default
                .marker([latitude, longitude], { icon: playerIcon })
                .addTo(mapInstanceRef.current);
            } else if (playerMarkerRef.current) {
              playerMarkerRef.current.setLatLng([latitude, longitude]);
            }
          });
        }
      },
      () => {
        setGpsError("Signal GPS non disponible ou autorisation refusée.");
        setGpsActive(false);
      },
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 12000 }
    );

    setWatchId(id);
  };

  // Distance from player to green of currently selected hole
  const distanceToGreen =
    playerPos && HOLE_COORDS[selectedHole]
      ? calculateDistanceMeters(
          playerPos.lat,
          playerPos.lng,
          HOLE_COORDS[selectedHole].greenLat,
          HOLE_COORDS[selectedHole].greenLng
        )
      : null;

  return (
    <div className="course-interactive-card">
      {/* Top Bar Switcher: Map vs 3D */}
      <div className="map-view-header">
        <div className="view-mode-tabs">
          <button
            type="button"
            className={`view-mode-btn ${activeTab === "map" ? "active" : ""}`}
            onClick={() => setActiveTab("map")}
          >
            🗺️ Carte Satellite &amp; GPS
          </button>
          <button
            type="button"
            className={`view-mode-btn ${activeTab === "3d" ? "active" : ""}`}
            onClick={() => setActiveTab("3d")}
          >
            🌐 Maquette 3D Interactive
          </button>
        </div>
        <div className="view-mode-right">
          <span className="badge-verified">Données officielles club</span>
        </div>
      </div>

      <div className="course-map-grid">
        {/* Left column: Visual Area (Map or 3D) */}
        <div className="map-visual-pane">
          {activeTab === "map" ? (
            <div className="leaflet-wrapper">
              <div ref={mapContainerRef} className="leaflet-map-root" />

              {/* Floating Layer Controls */}
              <div className="map-overlay-card map-legend-card">
                <div className="legend-title">Éléments du parcours</div>
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={filters.departs}
                    onChange={(e) => setFilters({ ...filters, departs: e.target.checked })}
                  />
                  <span className="legend-color-dots">
                    <span className="dot dot-white" />
                    <span className="dot dot-yellow" />
                    <span className="dot dot-blue" />
                    <span className="dot dot-red" />
                  </span>
                  <span>Départs</span>
                </label>
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={filters.greens}
                    onChange={(e) => setFilters({ ...filters, greens: e.target.checked })}
                  />
                  <span className="legend-box box-green" />
                  <span>Greens</span>
                </label>
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={filters.fairways}
                    onChange={(e) => setFilters({ ...filters, fairways: e.target.checked })}
                  />
                  <span className="legend-box box-fairway" />
                  <span>Fairways</span>
                </label>
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={filters.bunkers}
                    onChange={(e) => setFilters({ ...filters, bunkers: e.target.checked })}
                  />
                  <span className="legend-box box-bunker" />
                  <span>Bunkers</span>
                </label>
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={filters.eau}
                    onChange={(e) => setFilters({ ...filters, eau: e.target.checked })}
                  />
                  <span className="legend-box box-water" />
                  <span>Eau</span>
                </label>
                <label className="legend-item">
                  <input
                    type="checkbox"
                    checked={filters.autres}
                    onChange={(e) => setFilters({ ...filters, autres: e.target.checked })}
                  />
                  <span className="legend-box box-other" />
                  <span>Autres</span>
                </label>
              </div>

              {/* Floating Tile Switcher */}
              <div className="map-overlay-card map-tiles-card">
                <label className="tile-radio-item">
                  <input
                    type="radio"
                    name="mapLayer"
                    value="satellite"
                    checked={mapLayer === "satellite"}
                    onChange={() => setMapLayer("satellite")}
                  />
                  <span>Satellite</span>
                </label>
                <label className="tile-radio-item">
                  <input
                    type="radio"
                    name="mapLayer"
                    value="osm"
                    checked={mapLayer === "osm"}
                    onChange={() => setMapLayer("osm")}
                  />
                  <span>Plan OSM</span>
                </label>
              </div>
            </div>
          ) : (
            <div className="embedded-3d-wrapper">
              <Course3DViewer
                model={model3D}
                selectedHole={selectedHole}
                onAnnotationSelect={(num) => setSelectedHole(num)}
              />
            </div>
          )}
        </div>

        {/* Right column: Hole Selector & Details */}
        <div className="map-sidebar-pane">
          <div className="hole-selector-top">
            <button
              type="button"
              className="nav-arrow-btn"
              disabled={selectedHole === 1}
              onClick={() => setSelectedHole((h) => Math.max(1, h - 1))}
            >
              ‹ Préc.
            </button>
            <h2 className="hole-selector-title">Trou {selectedHole}</h2>
            <button
              type="button"
              className="nav-arrow-btn"
              disabled={selectedHole === 18}
              onClick={() => setSelectedHole((h) => Math.min(18, h + 1))}
            >
              Suiv. ›
            </button>
          </div>

          <div className="holes-grid-buttons">
            {HOLES.map((h) => (
              <button
                key={h.number}
                type="button"
                className={`hole-btn-chip ${selectedHole === h.number ? "active" : ""}`}
                onClick={() => setSelectedHole(h.number)}
              >
                {h.number}
              </button>
            ))}
          </div>

          <div className="hole-status-bar">
            <span className="badge-carto">DONNÉES OFFICIELLES DU CLUB</span>
          </div>
          <p className="hole-carto-notice">
            Caractéristiques et distances exactes validées pour le President Golf de Yamoussoukro.
          </p>

          <div className="hole-info-details-table">
            <div className="detail-row">
              <span className="detail-label">Départ blanc</span>
              <span className="detail-val">{currentHoleData.distances.WHITE} m</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Départ jaune</span>
              <span className="detail-val">{currentHoleData.distances.YELLOW} m</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Départ bleu</span>
              <span className="detail-val">{currentHoleData.distances.BLUE} m</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Départ rouge</span>
              <span className="detail-val">{currentHoleData.distances.RED} m</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Green</span>
              <span className="detail-val">Green régulier en herbe naturelle</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Fairway</span>
              <span className="detail-val">Fairway tropical bordé d&apos;arbres</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Bunkers</span>
              <span className="detail-val">Bunkers de protection de green</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Eau</span>
              <span className="detail-val">
                {currentHoleData.isSignatureHole
                  ? "Lac complet — Green en Île (Trou 12)"
                  : currentHoleData.hasWaterHazard
                  ? "Obstacle d'eau en jeu"
                  : "Hors obstacles d'eau majeurs"}
              </span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Autres</span>
              <span className="detail-val">
                {currentHoleData.isSignatureHole
                  ? "Règle locale 4 : Dropping zone obligatoire"
                  : "Obstructions inamovibles (R. 24.2)"}
              </span>
            </div>
            <div className="detail-row summary-highlight-row">
              <span className="detail-label">Par · Index · Distances</span>
              <span className="detail-val highlight-gold">
                PAR {currentHoleData.par} · Index {currentHoleData.strokeIndex}
              </span>
            </div>
          </div>

          {/* MA POSITION Section (GPS) */}
          <div className="my-position-card">
            <div className="my-position-header">
              <span className="my-position-title">MA POSITION</span>
              <span className={`gps-status-pill ${gpsActive ? "active" : ""}`}>
                {gpsActive
                  ? playerPos
                    ? `Précision ±${playerPos.accuracy}m`
                    : "Recherche satellite…"
                  : "Désactivée"}
              </span>
            </div>

            <div className="my-position-controls">
              <button
                type="button"
                className={`btn ${gpsActive ? "btn-outline" : "btn-gold"} small`}
                onClick={toggleGps}
              >
                {gpsActive ? "Désactiver ma position" : "Activer ma position"}
              </button>

              {distanceToGreen !== null && (
                <div className="distance-to-green-badge">
                  Distance au green (Trou {selectedHole}) : <strong>{distanceToGreen} m</strong>
                </div>
              )}
            </div>

            {gpsError && <p className="gps-error-notice">{gpsError}</p>}

            <p className="my-position-disclaimer">
              La position n&apos;est ni enregistrée ni suivie en arrière-plan. Elle est indicative et ne
              remplace pas une mesure officielle de distance.
            </p>
          </div>

          <div className="sidebar-action-cta">
            <Link className="btn btn-primary" href="/round/new" style={{ width: "100%" }}>
              Démarrer une carte de score →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
