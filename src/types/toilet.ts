import { StandardizedHours } from "./opening-hours";

export type ToiletCategory = "public_24h" | "station" | "gastro" | "other";

export interface Toilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city?: string;
  category: ToiletCategory;
  tags?: string[];
  /** @deprecated Use hours instead */
  opening_hours?: string;
  /** Standardized opening hours format */
  hours?: StandardizedHours;
  operator?: string;
  fee?: string;
  distance?: number;
}

export const CATEGORY_LABELS: Record<ToiletCategory, string> = {
  public_24h: "24/7 Öffentlich",
  station: "Bahnhof",
  gastro: "Gastronomie",
  other: "Sonstige",
};

// Colors optimized for map pins (high contrast, colorblind-friendly)
export const CATEGORY_COLORS: Record<ToiletCategory, string> = {
  public_24h: "#34a853", // Green - always available, most important
  station: "#1a73e8", // Blue - transit hubs, easy to find
  gastro: "#f5a623", // Orange - businesses, limited hours
  other: "#9aa0a6", // Gray - miscellaneous
};

// Pin colors for different states
export const PIN_COLORS = {
  selected: "#ea4335", // Red - selected toilet stands out
  favorite: "#e91e63", // Pink - favorites are special
  closed: "#9aa0a6", // Gray - closed toilets fade into background
};
