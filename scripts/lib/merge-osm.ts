import assert from "node:assert/strict";
import type { Toilet } from "../../src/types/toilet";
import { normalizeOpeningHours } from "../../src/utils/normalize-hours";

/** Refresh matching OSM nodes without re-deduplicating curated identities. */
export function mergeOsm(original: Toilet[], fresh: Toilet[]): Toilet[] {
  assert(fresh.length > 0, "No fresh OSM toilets; existing data was kept");
  const incoming = new Map<string, Toilet>();
  for (const t of fresh) {
    assert(/^osm_\d+$/.test(t.id) && t.name && Number.isFinite(t.lat) && Number.isFinite(t.lon)
      && t.lat >= 45 && t.lat <= 55.5 && t.lon >= 5.5 && t.lon <= 17.5, `Invalid OSM toilet: ${t.id}`);
    assert(!incoming.has(t.id), `Duplicate OSM identity: ${t.id}`);
    incoming.set(t.id, { ...t, opening_hours: t.opening_hours, operator: t.operator, fee: t.fee,
      hours: normalizeOpeningHours(t.opening_hours) });
  }
  const merged = original.map(old => {
    const id = old.id.replace(/^osm_node_/, "osm_");
    const update = incoming.get(id);
    incoming.delete(id);
    if (!update || old.care) return old;
    return { ...old, ...update, id: old.id };
  });
  // Only additions are checked for nearby pins. Existing favorites keep their IDs.
  const grid = new Map<string, Toilet[]>();
  const cell = (value: number) => Math.floor(value * 1000);
  const add = (t: Toilet) => {
    const key = `${cell(t.lat)}_${cell(t.lon)}`;
    const entries = grid.get(key) || [];
    entries.push(t); grid.set(key, entries);
  };
  merged.forEach(add);
  for (const t of incoming.values()) {
    let nearby = false;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      for (const other of grid.get(`${cell(t.lat) + y}_${cell(t.lon) + x}`) || []) {
        const dy = (t.lat - other.lat) * 111195;
        const dx = (t.lon - other.lon) * 111195 * Math.cos(t.lat * Math.PI / 180);
        if (Math.hypot(dx, dy) < 50) nearby = true;
      }
    }
    if (!nearby) { merged.push(t); add(t); }
  }
  // Absence from an accessibility-filtered query does not prove closure.
  return merged;
}
