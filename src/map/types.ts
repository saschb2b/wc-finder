export interface MapRegion {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

/** Text shown inside the embedded map document. */
export interface MapStrings {
  lang: string;
  title: string;
  zoomIn: string;
  zoomOut: string;
  contributors: string;
  tilesUnavailable: string;
  publicToilet: string;
  startRoute: string;
}

export const DEFAULT_MAP_STRINGS: MapStrings = {
  lang: "de",
  title: "Karte mit öffentlichen Toiletten",
  zoomIn: "Vergrößern",
  zoomOut: "Verkleinern",
  contributors: "OpenStreetMap-Mitwirkende",
  tilesUnavailable: "Kartenhintergrund nicht verfügbar. Toiletten und Liste bleiben nutzbar.",
  publicToilet: "Öffentliche Toilette",
  startRoute: "Route starten",
};

export interface MapPin {
  id: string;
  name: string;
  lat: number;
  lon: number;
  color: string;
  opacity: number;
  selected: boolean;
}

export interface MapData {
  pins: MapPin[];
  userLocation: { lat: number; lon: number } | null;
}

export type MapCommand =
  | { type: "sync" }
  | { type: "data"; data: MapData }
  | { type: "focus"; region: MapRegion; duration: number };

export type MapEvent =
  | { type: "ready" }
  | { type: "select" | "navigate"; id: string }
  | { type: "region"; region: MapRegion; isGesture: boolean };

export interface ToiletMapHandle {
  animateToRegion: (region: MapRegion, duration?: number) => void;
}

export interface ToiletMapProps extends MapData {
  initialRegion: MapRegion;
  onSelect: (id: string) => void;
  onNavigate: (id: string) => void;
  onRegionChange: (region: MapRegion, isGesture: boolean) => void;
}

export function isMapRegion(value: unknown): value is MapRegion {
  if (!value || typeof value !== "object") return false;
  const r = value as MapRegion;
  return [r.latitude, r.longitude, r.latitudeDelta, r.longitudeDelta].every(Number.isFinite)
    && Math.abs(r.latitude) <= 90 && Math.abs(r.longitude) <= 180
    && r.latitudeDelta > 0 && r.latitudeDelta <= 180
    && r.longitudeDelta > 0 && r.longitudeDelta <= 360;
}

export function parseMapEvent(raw: string): MapEvent | null {
  try {
    const event = JSON.parse(raw);
    if (!event || typeof event !== "object") return null;
    if (event.type === "ready") return { type: "ready" };
    if ((event.type === "select" || event.type === "navigate") && typeof event.id === "string") {
      return { type: event.type, id: event.id };
    }
    if (event.type === "region" && isMapRegion(event.region) && typeof event.isGesture === "boolean") {
      return { type: "region", region: event.region, isGesture: event.isGesture };
    }
  } catch { /* Ignore malformed messages from the embedded document. */ }
  return null;
}
