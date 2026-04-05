import { Toilet } from '../types/toilet';
import { loadNearbyTiles } from '../data/tileLoader';

/**
 * Gets nearby accessible toilets by loading only relevant geo-tiles.
 * Each tile covers 1°x1° (~110x70km). We load the user's tile + 8 neighbors.
 */
export function getNearbyToilets(
  lat: number,
  lon: number,
  maxResults: number = 50
): Toilet[] {
  const raw = loadNearbyTiles(lat, lon);

  return raw
    .map((t) => ({
      ...t,
      distance: getDistanceMeters(lat, lon, t.lat, t.lon),
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, maxResults);
}

/**
 * Calculate distance between two coordinates in meters (Haversine formula).
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Format distance for display.
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1)} km`;
}

/**
 * Estimate wheelchair travel time. ~70m/min average wheelchair speed on pavement.
 * Returns formatted string like "6 Min." or "< 1 Min."
 */
const WHEELCHAIR_SPEED_M_PER_MIN = 70;

export function formatWheelchairTime(meters: number): string {
  const mins = Math.ceil(meters / WHEELCHAIR_SPEED_M_PER_MIN);
  if (mins < 1) return '< 1 Min.';
  if (mins === 1) return '1 Min.';
  return `${mins} Min.`;
}
