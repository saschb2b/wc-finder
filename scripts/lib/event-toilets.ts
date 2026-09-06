import assert from "node:assert/strict";
import type { CareFacilities, ToiletAvailability, Toilet } from "../../src/types/toilet";

export interface EventLocation {
  id: string;
  name: string;
  city: string;
  coordinates: { lat: number; lon: number } | null;
  availability: ToiletAvailability;
  care: CareFacilities;
}

/** An event needs both a verified position and a finite, non-recurring date range. */
export function eventToilets(events: EventLocation[]): Toilet[] {
  return events.flatMap(event => {
    const { from, through } = event.availability;
    for (const date of [from, through]) {
      assert(date && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))
        && new Date(date).toISOString().slice(0, 10) === date, `Invalid event date: ${event.id}`);
    }
    assert(from! <= through!, `Reversed event dates: ${event.id}`);
    if (!event.coordinates) return [];
    const { lat, lon } = event.coordinates;
    assert(Number.isFinite(lat) && Number.isFinite(lon) && lat >= 45 && lat <= 56 && lon >= 5 && lon <= 17);
    return [{ id: event.id, name: event.name, city: event.city, lat, lon, category: "other",
      tags: ["barrierefrei", "pflegetoilette", "veranstaltung", ...(event.care.eurokey ? ["eurokey"] : [])],
      hours: { type: "unknown", original: event.care.hoursNote }, care: event.care, availability: event.availability }];
  });
}
