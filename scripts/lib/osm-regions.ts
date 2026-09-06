import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { fetchOverpass, type OverpassResponse } from "./overpass";
import { accessibleToiletQuery, type OsmElement } from "./osm-toilets";

export function splitBbox(bbox: string): string[] {
  const [south, west, north, east] = bbox.split(",").map(Number);
  assert([south, west, north, east].every(Number.isFinite) && south < north && west < east, "Invalid bbox");
  if ((east - west) * .6 > north - south) {
    const middle = (east + west) / 2;
    return [[south, west, north, middle], [south, middle, north, east]].map(b => b.join(","));
  }
  const middle = (south + north) / 2;
  return [[south, west, middle, east], [middle, west, north, east]].map(b => b.join(","));
}

/** Small, resumable requests. No stale cache or partial region is published. */
export async function fetchOsmRegion(bbox: string, cacheDir: string, depth = 0): Promise<OverpassResponse<OsmElement>> {
  const query = accessibleToiletQuery(bbox);
  const filename = path.join(cacheDir, createHash("sha256").update(query).digest("hex") + ".json");
  if (fs.existsSync(filename) && Date.now() - fs.statSync(filename).mtimeMs < 60 * 60 * 1000) {
    try {
      const cached = JSON.parse(fs.readFileSync(filename, "utf8"));
      assert(!cached.remark && Array.isArray(cached.elements) && Number.isFinite(Date.parse(cached.osm3s?.timestamp_osm_base)));
      return cached;
    } catch { /* Ignore corrupt cache and retrieve this region again. */ }
  }
  let data: OverpassResponse<OsmElement>;
  try {
    data = await fetchOverpass<OsmElement>(query, { timeoutMs: 45000, allowEmpty: true });
  } catch (error) {
    if (depth >= 2) throw error;
    console.log(`Splitting slow region ${bbox}`);
    const parts: OverpassResponse<OsmElement>[] = [];
    for (const part of splitBbox(bbox)) parts.push(await fetchOsmRegion(part, cacheDir, depth + 1));
    data = { elements: parts.flatMap(p => p.elements), osm3s: {
      timestamp_osm_base: parts.map(p => p.osm3s.timestamp_osm_base).sort()[0] } };
  }
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(filename + ".tmp", JSON.stringify(data));
  fs.renameSync(filename + ".tmp", filename);
  return data;
}
