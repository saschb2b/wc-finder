/** Refresh Hannover without re-merging or rewriting data for other regions.
 * Usage: pnpm data:hannover [--input saved-overpass-response.json]
 */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { Toilet } from "../src/types/toilet";
import { normalizeOpeningHours } from "../src/utils/normalize-hours";
import { fetchOverpass } from "./lib/overpass";

type Entry = Toilet & { city: string; tags: string[] };
interface Element {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags: Record<string, string>;
}
interface Response {
  endpoint?: string;
  elements: Element[];
  osm3s: { timestamp_osm_base: string };
  remark?: string;
}
const dataDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data");
const bbox = "52.3,9.6,52.45,9.9";
const endpoint = "https://overpass-api.de/api/interpreter";
const query = `[out:json][timeout:45];(
  nwr["amenity"="toilets"](${bbox});
  nwr["toilets:wheelchair"](${bbox});
  node["wheelchair"="yes"]["amenity"~"^(restaurant|fast_food|cafe)$"](${bbox});
  node["wheelchair"="yes"]["shop"~"^(supermarket|bakery)$"](${bbox});
  node["wheelchair"="yes"]["leisure"="fitness_centre"](${bbox});
);out center tags;`;
const inArea = (t: { lat: number; lon: number }) =>
  t.lat > 52.3 && t.lat < 52.45 && t.lon > 9.6 && t.lon < 9.9;
const read = (filename: string) => JSON.parse(fs.readFileSync(path.join(dataDir, filename), "utf8"));
const save = (filename: string, data: unknown) => fs.writeFileSync(path.join(dataDir, filename), JSON.stringify(data, null, 2));
const key = (e: Element) => `${e.type}_${e.id}`;
const businessId = (e: Element) => e.type === "node" ? `hbiz_${e.id}` : `hbiz_${key(e)}`;
const sourceId = (e: Element) => e.tags.amenity === "toilets" ? `osm_${key(e)}` : businessId(e);
const inaccessible = (e: Element) => e.tags.toilets === "no"
  || [e.tags.access, e.tags["toilets:access"]].some(access => /(^|;\s*)(no|private|employees)(;|$)/.test(access || ""));
const accessible = (e: Element) => ["yes", "designated"].includes(
  e.tags["toilets:wheelchair"] || (e.tags.amenity === "toilets" ? e.tags.wheelchair : ""),
);
const isBusiness = (e: Element) => /^(restaurant|fast_food|cafe)$/.test(e.tags.amenity || "")
  || /^(supermarket|bakery)$/.test(e.tags.shop || "") || e.tags.leisure === "fitness_centre";

function entryFrom(e: Element, old?: Entry): Entry {
  const t = e.tags;
  const coords = e.center || { lat: e.lat!, lon: e.lon! };
  assert(inArea(coords), `Out-of-area coordinates: ${key(e)}`);
  const tags = (old?.tags || []).filter(tag => !["barrierefrei", "eurokey", "kostenlos"].includes(tag));
  if (accessible(e)) tags.push("barrierefrei");
  if (t.eurokey === "yes" || t.centralkey === "eurokey" || t["toilets:centralkey"] === "eurokey") tags.push("eurokey");
  const fee = t["toilets:fee"] || t.fee;
  if (fee === "no") tags.push("kostenlos");
  const hours = t["toilets:opening_hours"] || t.opening_hours;
  const name = t.name || t.brand || t.operator || old?.name || "Barrierefreie Toilette";
  const category = /sanifair|bahnhof|hbf/i.test(name + (t.operator || "")) ? "station"
    : t.amenity === "fuel" ? "tankstelle"
      : /^(restaurant|fast_food|cafe)$/.test(t.amenity || "") ? "gastro"
        : t.amenity === "toilets" && hours === "24/7" ? "public_24h" : "other";
  return {
    ...old, id: old?.id || sourceId(e), ...coords, name,
    city: t["addr:city"] || old?.city || "Hannover", category, tags,
    opening_hours: hours, hours: normalizeOpeningHours(hours),
    operator: t.operator || t.brand, fee,
  };
}

function distance(a: Entry, b: Entry) {
  const radians = Math.PI / 180;
  const h = Math.sin((b.lat - a.lat) * radians / 2) ** 2
    + Math.cos(a.lat * radians) * Math.cos(b.lat * radians)
    * Math.sin((b.lon - a.lon) * radians / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

async function main() {
  const inputIndex = process.argv.indexOf("--input");
  let response: Response;
  if (inputIndex !== -1) {
    assert(process.argv[inputIndex + 1], "--input requires a saved Overpass JSON response");
    response = JSON.parse(fs.readFileSync(process.argv[inputIndex + 1], "utf8"));
  } else {
    console.log("Fetching Hannover from OpenStreetMap...");
    response = await fetchOverpass<Element>(query, { timeoutMs: 55000 });
  }
  // Overpass can return HTTP 200 with partial data after a timeout.
  assert(!response.remark, response.remark);
  assert(Array.isArray(response.elements) && response.elements.length > 0, "Empty Overpass response");
  assert(Number.isFinite(Date.parse(response.osm3s?.timestamp_osm_base)), "Missing source timestamp");
  const elements = response.elements;
  const byId = new Map(elements.map(e => [key(e), e]));
  assert(byId.size === elements.length, "Duplicate source identities");
  const dataset = read("toilets.json");
  const original: Entry[] = dataset.toilets;
  const businesses = read("hannover-businesses.json");
  const oldBusinesses: Entry[] = businesses.toilets;
  const updates = new Map<string, Entry>();
  const removals = new Set<string>();
  const unresolved: string[] = [];
  const refreshedBusinesses: Entry[] = [];
  for (const old of oldBusinesses) {
    const id = old.id.slice(5);
    const e = byId.get(/^\d+$/.test(id) ? `node_${id}` : id);
    // Absence from a filtered query is not proof that a business closed.
    if (!e || !inArea(old)) { refreshedBusinesses.push(old); unresolved.push(old.id); continue; }
    if (inaccessible(e)) { removals.add(old.id); continue; }
    const updated = entryFrom(e, old);
    updates.set(old.id, updated);
    refreshedBusinesses.push(updated);
  }
  for (const old of original) {
    if (!inArea(old) || !old.id.startsWith("osm_") || old.care) continue;
    const id = old.id.slice(4);
    const e = byId.get(/^\d+$/.test(id) ? `node_${id}` : id);
    if (!e) continue;
    if (inaccessible(e)) removals.add(old.id);
    else updates.set(old.id, entryFrom(e, old));
  }
  let changed = 0;
  const merged = original.filter(t => t.care || !removals.has(t.id)).map(t => {
    if (!inArea(t) || t.care) return t;
    const update = updates.get(t.id);
    const updated = update ? { ...t, ...update } : undefined;
    if (updated && JSON.stringify(t) !== JSON.stringify(updated)) changed++;
    return updated || t;
  });
  const local = merged.filter(inArea);
  const ids = new Set(merged.map(t => t.id));
  const added: Entry[] = [];
  let nearbySkipped = 0;
  const sourceToilets: Entry[] = [];
  for (const e of elements) {
    if (inaccessible(e) || !accessible(e)) continue;
    if (e.tags.amenity !== "toilets" && !isBusiness(e)) continue;
    const coords = e.center || { lat: e.lat!, lon: e.lon! };
    if (!inArea(coords)) continue;
    const entry = entryFrom(e);
    if (e.tags.amenity === "toilets") sourceToilets.push(entry);
    if (ids.has(entry.id)) continue;
    // Preserve curated identities/favorites and avoid adding a second pin at
    // an existing location. Never overwrite a different nearby venue's hours.
    if (local.some(t => distance(t, entry) < 50)) { nearbySkipped++; continue; }
    merged.push(entry); local.push(entry); added.push(entry); ids.add(entry.id);
    if (e.tags.amenity !== "toilets") refreshedBusinesses.push(entry);
  }
  assert.deepEqual(merged.filter(t => !inArea(t)), original.filter(t => !inArea(t)), "Data outside Hannover changed");
  const duplicates = (entries: Entry[]) => entries.length - new Set(entries.map(t => t.id)).size;
  assert(duplicates(merged) <= duplicates(original), "Refresh introduced duplicate IDs");
  for (const entry of [...updates.values(), ...added]) {
    assert(entry.name && Number.isFinite(entry.lat) && Number.isFinite(entry.lon) && entry.hours);
  }
  const stamp = response.osm3s.timestamp_osm_base;
  const summary = {
    updated: stamp, source: "OpenStreetMap", endpoint: response.endpoint || endpoint, bbox,
    unresolvedBusinessIds: unresolved,
    count: merged.filter(inArea).length,
  };
  dataset.toilets = merged;
  dataset.count = merged.length;
  // Keep the overall date: a Hannover refresh is not a nationwide refresh.
  dataset.regionalUpdates = { ...dataset.regionalUpdates, hannover: summary };
  save("toilets.json", dataset);
  const sourceEntry = ({ hours: _hours, ...entry }: Entry) => entry;
  save("hannover-businesses.json", {
    ...businesses, generated: stamp.slice(0, 10), count: refreshedBusinesses.length,
    toilets: refreshedBusinesses.map(sourceEntry), unresolvedBusinessIds: unresolved,
  });
  save("hannover-osm-toilets.json", {
    generated: stamp.slice(0, 10), source: "OpenStreetMap - Hannover accessible toilets",
    endpoint: response.endpoint || endpoint, bbox, count: sourceToilets.length, toilets: sourceToilets.map(sourceEntry),
  });
  console.log(JSON.stringify({ ...summary, refreshed: changed, added: added.length,
    removed: original.filter(t => removals.has(t.id)).length, nearbySkipped }, null, 2));
  await import("./split-tiles");
  await import("./gen-tile-loader");
}

main().catch(error => { console.error(error); process.exitCode = 1; });
