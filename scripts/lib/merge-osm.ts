import assert from "node:assert/strict";
import type { Toilet } from "../../src/types/toilet";
import { importHours } from "./import-hours";

/** Prefixes whose original importers preserve a known OSM element type. */
export function canonicalOsmId(id: string): string {
  return id.replace(/^(?:station|sanifair|hbiz)_(node|way|relation)_(\d+)$/, "osm_$1_$2")
    .replace(/^(?:osm|fuel|hbiz|biz|osm_fuel|osm_mall)_(\d+)$/, "osm_node_$1");
  // mall_<number> used both ways and nodes: its type cannot safely be inferred.
}

const normalize = (s: string) => s.toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
  .normalize("NFKD").replace(/\p{M}/gu, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

export function sameVenue(a: Toilet, b: Toilet): boolean {
  const name = normalize(a.name);
  if (!name || (a.address && b.address && normalize(a.address) !== normalize(b.address))) return false;
  // Generated fallback labels do not identify a venue, even at close range.
  if (["barrierefreie toilette", "barrierefreies wc im gebaeude", "oeffentliche toilette", "wc", "toilette", "toiletten"].includes(name)) return false;
  if (name === normalize(b.name)) return true;
  const distance = Math.hypot((a.lat - b.lat) * 111195, (a.lon - b.lon) * 111195 * Math.cos(a.lat * Math.PI / 180));
  if (distance > 15) return false;
  const cities = [...new Set([a.city, b.city].filter((s): s is string => !!s).map(normalize))].filter(s => s.length >= 3);
  const trimCity = (value: string) => {
    for (const city of cities) if (value.endsWith(" " + city)) return value.slice(0, -city.length - 1).trim();
    return value;
  };
  const short = trimCity(name);
  return short.length >= 5 && short === trimCity(normalize(b.name))
    && !/^(?:barrierefreie |oeffentliche )?(?:toilette|toiletten|bahnhof)$/.test(short);
}

/** Refresh typed OSM identities; proximity alone never identifies a venue. */
export function mergeOsm(original: Toilet[], fresh: Toilet[]): Toilet[] {
  assert(fresh.length > 0, "No fresh OSM toilets; existing data was kept");
  for (const t of fresh) assert(/^osm_(?:(?:node|way|relation)_)?\d+$/.test(t.id), `Invalid OSM identity: ${t.id}`);
  return mergeImported(original, fresh);
}

export function mergeImported(original: Toilet[], fresh: Toilet[]): Toilet[] {
  assert(fresh.length > 0, "No fresh toilets; existing data was kept");
  const existingOwners = new Set(original.map(t => canonicalOsmId(t.id)));
  const incoming = new Map<string, Toilet>();
  for (const t of fresh) {
    assert(t.id && t.name && Number.isFinite(t.lat) && Number.isFinite(t.lon)
      && t.lat >= 45 && t.lat <= 55.5 && t.lon >= 5.5 && t.lon <= 17.5, `Invalid OSM toilet: ${t.id}`);
    const id = canonicalOsmId(t.id);
    assert(!incoming.has(id), `Duplicate OSM identity: ${t.id}`);
    const refs = t.sources?.filter(source => {
      const owner = source.id.replace(/^osm\/(node|way|relation)\/(\d+)$/, "osm_$1_$2");
      // A secondary reference cannot take ownership of another existing OSM pin.
      return owner === id || !existingOwners.has(owner);
    });
    incoming.set(id, { ...t, opening_hours: t.opening_hours, operator: t.operator, fee: t.fee,
      ...(refs ? { sources: refs } : {}),
      hours: importHours(t.opening_hours) });
  }
  const sourceIds = new Map([...incoming].flatMap(([id, toilet]) => (toilet.sources || []).map(s => [s.id, id] as const)));
  const sources = (old: Toilet, update: Toilet) => {
    const refs = new Map((old.sources || []).map(s => [s.id, s]));
    update.sources?.forEach(s => refs.set(s.id, s));
    return refs.size ? [...refs.values()] : undefined;
  };
  const enrich = (old: Toilet, update: Toilet): Toilet => ({ ...old, sources: sources(old, update),
    tags: [...new Set([...(old.tags || []), ...(update.tags || [])])],
    accessNote: update.accessNote || old.accessNote });
  const merged = original.map(old => {
    const primary = canonicalOsmId(old.id);
    const linked = new Set([primary, ...(old.sources || []).map(s => sourceIds.get(s.id)).filter((id): id is string => !!id)]);
    let updated = old;
    // Consume every linked identity, including node/way duplicates of one venue.
    for (const id of linked) {
      const update = incoming.get(id);
      incoming.delete(id);
      if (!update || old.care) continue;
      if (id === primary) {
        const refs = sources(updated, update);
        updated = { ...updated, ...update, id: old.id, ...(refs ? { sources: refs } : {}) };
      } else updated = enrich(updated, update);
    }
    return updated;
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
    let nearby: Toilet | undefined;
    for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
      for (const other of grid.get(`${cell(t.lat) + y}_${cell(t.lon) + x}`) || []) {
        const dy = (t.lat - other.lat) * 111195;
        const dx = (t.lon - other.lon) * 111195 * Math.cos(t.lat * Math.PI / 180);
        if (Math.hypot(dx, dy) < 50 && sameVenue(t, other)) nearby = other;
      }
    }
    if (!nearby) { merged.push(t); add(t); }
    else if (!nearby.care && t.sources?.length) {
      // Enrich a confirmed matching venue without changing its favourite ID.
      const index = merged.indexOf(nearby);
      const enriched = enrich(nearby, t);
      merged[index] = enriched;
      const entries = grid.get(`${cell(nearby.lat)}_${cell(nearby.lon)}`)!;
      entries[entries.indexOf(nearby)] = enriched;
    }
  }
  // Absence from an accessibility-filtered query does not prove closure.
  return merged;
}
