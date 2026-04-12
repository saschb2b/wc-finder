/**
 * Merges toilet data from all sources into one dataset, then splits into tiles.
 * Deduplicates by proximity (~50m radius).
 * Priority: curated (TFA/city/Dortmund) > OSM > toilettenhero
 *
 * Usage:
 *   1. Run fetch-toilets.ts (toilettenhero)
 *   2. Run fetch-overpass-toilets.ts (OSM direct)
 *   3. Run fetch-tfa.ts (curated Hannover)
 *   4. Run fetch-dortmund.ts (curated Dortmund)
 *   5. Run merge-sources.ts (this script)
 *   6. Run migrate-hours-format.ts (normalize opening hours to new format)
 *   7. Run split-tiles.ts + gen-tile-loader.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "data");

type ToiletCategory = "public_24h" | "station" | "tankstelle" | "gastro" | "other";

interface ToiletEntry {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: ToiletCategory;
  tags: string[];
  opening_hours?: string;
  operator?: string;
  fee?: string;
}

interface DataFile {
  count: number;
  toilets: ToiletEntry[];
}

function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function loadIfExists(filename: string): ToiletEntry[] {
  const p = path.join(dataDir, filename);
  if (!fs.existsSync(p)) {
    console.log(`  ${filename}: not found, skipping`);
    return [];
  }
  const data: DataFile = JSON.parse(fs.readFileSync(p, "utf-8"));
  console.log(`  ${filename}: ${data.count} toilets`);
  return data.toilets;
}

// Known fuel station brands/operators
const FUEL_BRANDS = [
  "shell", "aral", "esso", "avia", "total", "totalenergies", "jet",
  "bft", "star", "agip", "hem", "freie tankstelle", "raiffeisen",
  "oil!", "tankpool24", "westfalen", "classic", "hoyer", "orlen",
  "q1", "markant", "sprint", "tamoil", "eni", "bp", "omv", "mol",
  "lukoil", "repsol", "cepsa", "gulf",
];

const FUEL_NAME_PATTERNS =
  /\b(tankstelle|tanken|tank\s*&|gas\s*station|fuel|benzin|zapfsäule)\b/i;

function isFuelStation(toilet: ToiletEntry): boolean {
  const name = (toilet.name || "").toLowerCase();
  const op = (toilet.operator || "").toLowerCase();
  const tags = toilet.tags.map((t) => t.toLowerCase());

  // Check operator
  if (FUEL_BRANDS.some((b) => op.includes(b))) return true;

  // Check name against brands
  if (FUEL_BRANDS.some((b) => name.startsWith(b + " ") || name === b))
    return true;

  // Check name patterns
  if (FUEL_NAME_PATTERNS.test(name)) return true;

  // Check tags
  if (tags.includes("fuel") || tags.includes("tankstelle")) return true;

  return false;
}

/**
 * Fixes categorization based on name/operator/hours.
 */
function fixCategory(toilet: ToiletEntry): ToiletEntry {
  const hours = (toilet.opening_hours || "").toLowerCase();

  // Reclassify fuel stations from "other" to "tankstelle"
  if (toilet.category === "other" && isFuelStation(toilet)) {
    toilet.category = "tankstelle";
  }

  // Also reclassify fuel stations that were previously categorized as "station"
  if (toilet.category === "station" && isFuelStation(toilet)) {
    toilet.category = "tankstelle";
  }

  // If it has seasonal hours (Apr-Sep, summer/winter, etc.), it's not 24/7
  if (hours.match(/(apr|sep|summer|winter|oct|mar|season)/i)) {
    if (toilet.category === "public_24h") {
      toilet.category = "other";
    }
  }

  return toilet;
}

function main() {
  console.log("Loading sources...\n");

  // Load in priority order (lowest priority first)
  const thToilets = loadIfExists("toilets.json"); // toilettenhero
  const osmToilets = loadIfExists("osm-toilets.json"); // overpass direct (basic)
  const osmEnhancedToilets = loadIfExists("osm-enhanced.json"); // overpass (enhanced with fuel, hotels, etc.)
  const manualToilets = loadIfExists("manual-curated.json"); // manual curation
  const majorCitiesToilets = loadIfExists("major-cities.json"); // curated major cities
  const tfaToilets = loadIfExists("tfa-toilets.json"); // curated Hannover
  const dortmundToilets = loadIfExists("dortmund-toilets.json"); // curated Dortmund
  const hannoverBizToilets = loadIfExists("hannover-businesses.json"); // Hannover businesses
  const googlePlacesToilets = loadIfExists("google-places.json"); // Google Places API data
  const autobahnToilets = loadIfExists("autobahn-rest.json"); // Autobahn rest areas
  const stationToilets = loadIfExists("station-toilets.json"); // Train station / Sanifair toilets

  // Merge: add all, deduplicate by proximity
  // Higher-priority sources added later will replace lower-priority duplicates
  const merged: ToiletEntry[] = [];
  const DEDUP_RADIUS = 50; // meters

  function addWithDedup(toilets: ToiletEntry[], sourceName: string) {
    let added = 0;
    let replaced = 0;
    let skipped = 0;

    for (const t of toilets) {
      // Fix categorization first
      const toilet = fixCategory({ ...t });

      // Find nearby existing toilet
      let nearbyIdx = -1;
      let nearbyDist = Infinity;

      for (let i = 0; i < merged.length; i++) {
        // Quick lat/lon filter before expensive haversine
        if (
          Math.abs(merged[i].lat - toilet.lat) > 0.001 &&
          Math.abs(merged[i].lon - toilet.lon) > 0.001
        )
          continue;

        const d = getDistanceMeters(
          merged[i].lat,
          merged[i].lon,
          toilet.lat,
          toilet.lon,
        );
        if (d < nearbyDist) {
          nearbyDist = d;
          nearbyIdx = i;
        }
      }

      if (nearbyIdx >= 0 && nearbyDist < DEDUP_RADIUS) {
        // Merge: keep higher-priority entry, but enrich with data from lower
        const existing = merged[nearbyIdx];

        // Take opening_hours, operator, fee from whichever has them
        if (!existing.opening_hours && toilet.opening_hours)
          existing.opening_hours = toilet.opening_hours;
        if (!existing.operator && toilet.operator)
          existing.operator = toilet.operator;
        if (!existing.fee && toilet.fee) existing.fee = toilet.fee;

        // Merge tags
        const tagSet = new Set([...existing.tags, ...toilet.tags]);
        existing.tags = [...tagSet];

        // If new source has a better name
        if (
          existing.name === "Barrierefreie Toilette" &&
          toilet.name !== "Barrierefreie Toilette"
        ) {
          existing.name = toilet.name;
        }

        // If new source has better category (not 'other')
        if (existing.category === "other" && toilet.category !== "other") {
          existing.category = toilet.category;
        }

        // If new source has city and existing doesn't
        if (!existing.city && toilet.city) existing.city = toilet.city;

        replaced++;
      } else {
        merged.push({ ...toilet });
        added++;
      }
    }

    console.log(
      `  ${sourceName}: +${added} new, ${replaced} merged, ${skipped} skipped`,
    );
  }

  console.log(
    "Merging (priority: toilettenhero < OSM < OSM Enhanced < Manual < Major Cities < TFA < Dortmund)...\n",
  );
  addWithDedup(thToilets, "toilettenhero");
  addWithDedup(osmToilets, "OSM basic");
  addWithDedup(osmEnhancedToilets, "OSM enhanced (fuel, hotels, etc.)");
  addWithDedup(manualToilets, "Manual curated");
  addWithDedup(majorCitiesToilets, "Major cities curated");
  addWithDedup(tfaToilets, "curated Hannover (TFA)");
  addWithDedup(hannoverBizToilets, "Hannover businesses");
  addWithDedup(autobahnToilets, "Autobahn rest areas");
  addWithDedup(stationToilets, "Station/Sanifair toilets");
  addWithDedup(googlePlacesToilets, "Google Places API");
  addWithDedup(dortmundToilets, "curated Dortmund");

  // Stats
  const cats: Record<string, number> = {};
  for (const t of merged) cats[t.category] = (cats[t.category] || 0) + 1;

  // City-specific stats
  const hannover = merged.filter(
    (t) => t.lat > 52.3 && t.lat < 52.45 && t.lon > 9.6 && t.lon < 9.9,
  );
  const dortmund = merged.filter(
    (t) => t.lat > 51.4 && t.lat < 51.6 && t.lon > 7.3 && t.lon < 7.6,
  );

  console.log(`\n--- Merged Results ---`);
  console.log(`Total: ${merged.length}`);
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }

  console.log(`\nCity breakdown:`);
  console.log(`  Hannover area: ${hannover.length} toilets`);
  console.log(
    `    eurokey: ${hannover.filter((t) => t.tags.includes("eurokey")).length}`,
  );
  console.log(
    `    public_24h: ${hannover.filter((t) => t.category === "public_24h").length}`,
  );
  console.log(
    `    with opening hours: ${hannover.filter((t) => t.opening_hours).length}`,
  );

  console.log(`  Dortmund area: ${dortmund.length} toilets`);
  console.log(
    `    eurokey: ${dortmund.filter((t) => t.tags.includes("eurokey")).length}`,
  );
  console.log(
    `    public_24h: ${dortmund.filter((t) => t.category === "public_24h").length}`,
  );
  console.log(
    `    with opening hours: ${dortmund.filter((t) => t.opening_hours).length}`,
  );

  // Major cities stats
  const berlin = merged.filter(
    (t) => t.lat > 52.3 && t.lat < 52.7 && t.lon > 13.0 && t.lon < 13.8,
  );
  const hamburg = merged.filter(
    (t) => t.lat > 53.4 && t.lat < 53.7 && t.lon > 9.8 && t.lon < 10.3,
  );
  const munich = merged.filter(
    (t) => t.lat > 48.0 && t.lat < 48.3 && t.lon > 11.4 && t.lon < 11.8,
  );

  console.log(`\nMajor cities:`);
  console.log(`  Berlin area: ${berlin.length} toilets`);
  console.log(
    `    public_24h: ${berlin.filter((t) => t.category === "public_24h").length}`,
  );
  console.log(`  Hamburg area: ${hamburg.length} toilets`);
  console.log(
    `    public_24h: ${hamburg.filter((t) => t.category === "public_24h").length}`,
  );
  console.log(`  Munich area: ${munich.length} toilets`);
  console.log(
    `    public_24h: ${munich.filter((t) => t.category === "public_24h").length}`,
  );

  // Save
  const output = {
    generated: new Date().toISOString().split("T")[0],
    source:
      "Merged: toilettenhero.de + OpenStreetMap + Manual curation + Major cities + Hannover businesses + Autobahn rest areas + Station/Sanifair + Google Places + Toiletten für alle + Stadt Hannover + Dortmund",
    count: merged.length,
    toilets: merged,
  };

  const outPath = path.join(dataDir, "toilets.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to src/data/toilets.json`);
}

main();
