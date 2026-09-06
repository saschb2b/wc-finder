import type { Toilet } from "../../src/types/toilet";

/** Specialist records override generic accessibility assumptions. Keep saved IDs. */
export function mergeCare<T extends Toilet>(original: T[], care: Toilet[]): T[] {
  const result = original.map(t => ({ ...t }));
  for (const entry of care) {
    let index = result.findIndex(t => t.id === entry.id || (entry.care && t.care?.sourceId === entry.care.sourceId));
    if (index < 0) {
      // Only merge identical venue names nearby; proximity alone is not identity.
      const normalize = (s: string) => s.toLocaleLowerCase("de").replace(/[^\p{L}\p{N}]/gu, "");
      const matches = result.flatMap((t, i) => !t.care && normalize(t.name) === normalize(entry.name)
        && Math.abs(t.lat - entry.lat) < 0.001 && Math.abs(t.lon - entry.lon) < 0.0015 ? [i] : []);
      if (matches.length === 1) index = matches[0];
    }
    if (index < 0) result.push(entry as T);
    else {
      const existing = result[index];
      const tags = [...new Set([...(existing.tags || []).filter(t =>
        !["eurokey", "pflegeliege", "lifter", "toilette-fuer-alle", "pflegetoilette"].includes(t)), ...(entry.tags || [])])];
      result[index] = { ...existing, ...entry, id: existing.id, tags,
        availability: entry.availability } as T;
    }
  }
  return result;
}
