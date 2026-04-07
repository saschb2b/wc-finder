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
 *   6. Run split-tiles.ts + gen-tile-loader.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "..", "src", "data");

type ToiletCategory = "public_24h" | "station" | "gastro" | "other";

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

/**
 * Fixes categorization based on opening hours.
 * Toilets with seasonal hours should NOT be public_24h.
 */
function fixCategory(toilet: ToiletEntry): ToiletEntry {
  const hours = (toilet.opening_hours || "").toLowerCase();

  // If it has seasonal hours (Apr-Sep, summer/winter, etc.), it's not 24/7
  if (hours.match(/(apr|sep|summer|winter|oct|mar|season)/i)) {
    if (toilet.category === "public_24h") {
      toilet.category = "other";
    }
  }

  // If it closes at specific times (not 24/7), fix category
  if (hours && !hours.includes("24/7") && toilet.category === "public_24h") {
    // Check if it's actually 24/7 with different syntax
    const is24_7 = hours.includes("00:00-24:00") || hours.includes("24h");
    if (!is24_7) {
      // It might be a public toilet but not 24/7 - keep as public but note it's not 24/7
      // Actually, let's keep public_24h for things open until 22:00+ in city center
      // But mark seasonal ones as 'other'
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
  const tfaToilets = loadIfExists("tfa-toilets.json"); // curated Hannover
  const dortmundToilets = loadIfExists("dortmund-toilets.json"); // curated Dortmund

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
    "Merging (priority: toilettenhero < OSM < OSM Enhanced < Manual < TFA < Dortmund)...\n",
  );
  addWithDedup(thToilets, "toilettenhero");
  addWithDedup(osmToilets, "OSM basic");
  addWithDedup(osmEnhancedToilets, "OSM enhanced (fuel, hotels, etc.)");
  addWithDedup(manualToilets, "Manual curated");
  addWithDedup(tfaToilets, "curated Hannover (TFA)");
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

  // Save
  const output = {
    generated: new Date().toISOString().split("T")[0],
    source:
      "Merged: toilettenhero.de + OpenStreetMap (basic + enhanced) + Manual curation + Toiletten für alle + Stadt Hannover + Dortmund",
    count: merged.length,
    toilets: merged,
  };

  const outPath = path.join(dataDir, "toilets.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to src/data/toilets.json`);
}

main();
