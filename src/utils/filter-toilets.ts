import type { Toilet } from "../types/toilet";
import { isWithinAvailability, toiletOpenStatus } from "./toilet-availability";

export interface ToiletFilters {
  openNow: boolean;
  favoritesOnly: boolean;
  favoriteIds: ReadonlySet<string>;
  eurokey: boolean;
  wheelchair: boolean;
  bed: boolean;
  hoist: boolean;
}

export function filterToilets(toilets: Toilet[], filters: ToiletFilters, now = new Date()): Toilet[] {
  return toilets.filter(t => {
    if (!filters.favoritesOnly && !isWithinAvailability(t, now)) return false;
    if (filters.openNow && toiletOpenStatus(t, now) !== true) return false;
    if (filters.favoritesOnly && !filters.favoriteIds.has(t.id)) return false;
    if (filters.eurokey && !(t.care ? t.care.eurokey === true : t.tags?.includes("eurokey"))) return false;
    if (filters.wheelchair && !t.tags?.some(tag => ["eurokey", "barrierefrei"].includes(tag))) return false;
    if (filters.bed && t.care?.bed !== "available") return false;
    if (filters.hoist && t.care?.hoist !== "available") return false;
    return true;
  }).sort((a, b) => {
    const rank = (t: Toilet) => ({ true: 0, null: 1, false: 2 })[String(toiletOpenStatus(t, now)) as "true" | "null" | "false"];
    return rank(a) - rank(b);
  });
}
