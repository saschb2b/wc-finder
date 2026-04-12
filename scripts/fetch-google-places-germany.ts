/**
 * Fetches places with restrooms from Google Places API across all major DACH cities.
 * Uses a grid pattern per city to get broad gastro/business coverage.
 *
 * Tiers control how many cities get expanded coverage:
 *   --tier 1  → Top 5 cities only (500k+), ~600 API calls
 *   --tier 2  → Top 30 cities (200k+), ~2,500 API calls
 *   --tier 3  → All 90+ cities (100k+), ~5,000 API calls  (~$85 above free tier)
 *   (default) → All cities with original smaller radii (~1,000 calls, free tier)
 *
 * Usage: npx tsx scripts/fetch-google-places-germany.ts [--tier 1|2|3] [--dry-run]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);
  if (match) process.env.GOOGLE_PLACES_API_KEY = match[1].trim();
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY not found in .env");
  process.exit(1);
}

type ToiletCategory =
  | "public_24h"
  | "station"
  | "tankstelle"
  | "gastro"
  | "other";

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

interface GooglePlace {
  id: string;
  displayName: { text: string };
  location: { latitude: number; longitude: number };
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
  };
  restroom?: boolean;
  primaryType?: string;
  types?: string[];
}

// Major DACH cities with two radius values: original (default) and expanded (for --tier mode)
// tier: 1 = 500k+ (top 5 DE + Wien/Zürich), 2 = 200k+, 3 = all 100k+
const CITIES: Array<{
  name: string;
  lat: number;
  lon: number;
  radius: number;      // original radius (km) — used without --tier flag
  expanded: number;     // expanded radius (km) — used with --tier flag
  tier: 1 | 2 | 3;
}> = [
  // Tier 1: 500k+ population — full urban area coverage
  { name: "Berlin", lat: 52.52, lon: 13.405, radius: 5, expanded: 12, tier: 1 },
  { name: "Hamburg", lat: 53.551, lon: 9.994, radius: 4, expanded: 9, tier: 1 },
  { name: "München", lat: 48.137, lon: 11.576, radius: 4, expanded: 8, tier: 1 },
  { name: "Köln", lat: 50.938, lon: 6.96, radius: 4, expanded: 7, tier: 1 },
  { name: "Frankfurt", lat: 50.11, lon: 8.682, radius: 4, expanded: 7, tier: 1 },
  // Tier 2: 200k-500k — cover full city + close suburbs
  { name: "Stuttgart", lat: 48.776, lon: 9.183, radius: 4, expanded: 6, tier: 2 },
  { name: "Düsseldorf", lat: 51.228, lon: 6.774, radius: 3, expanded: 6, tier: 2 },
  { name: "Leipzig", lat: 51.34, lon: 12.375, radius: 3, expanded: 6, tier: 2 },
  { name: "Dresden", lat: 51.051, lon: 13.738, radius: 3, expanded: 6, tier: 2 },
  { name: "Hannover", lat: 52.375, lon: 9.732, radius: 3, expanded: 6, tier: 2 },
  { name: "Nürnberg", lat: 49.454, lon: 11.078, radius: 3, expanded: 5, tier: 2 },
  { name: "Bremen", lat: 53.079, lon: 8.801, radius: 3, expanded: 5, tier: 2 },
  { name: "Essen", lat: 51.457, lon: 7.012, radius: 3, expanded: 5, tier: 2 },
  { name: "Duisburg", lat: 51.435, lon: 6.763, radius: 3, expanded: 5, tier: 2 },
  { name: "Bochum", lat: 51.482, lon: 7.216, radius: 3, expanded: 5, tier: 2 },
  { name: "Wuppertal", lat: 51.256, lon: 7.151, radius: 3, expanded: 5, tier: 2 },
  { name: "Bielefeld", lat: 52.022, lon: 8.532, radius: 3, expanded: 5, tier: 2 },
  { name: "Bonn", lat: 50.737, lon: 7.099, radius: 3, expanded: 5, tier: 2 },
  { name: "Münster", lat: 51.961, lon: 7.628, radius: 3, expanded: 5, tier: 2 },
  { name: "Mannheim", lat: 49.488, lon: 8.467, radius: 3, expanded: 5, tier: 2 },
  { name: "Karlsruhe", lat: 49.007, lon: 8.404, radius: 3, expanded: 5, tier: 2 },
  { name: "Augsburg", lat: 48.366, lon: 10.898, radius: 3, expanded: 5, tier: 2 },
  { name: "Wiesbaden", lat: 50.083, lon: 8.24, radius: 3, expanded: 5, tier: 2 },
  { name: "Mönchengladbach", lat: 51.186, lon: 6.443, radius: 3, expanded: 4, tier: 2 },
  { name: "Gelsenkirchen", lat: 51.518, lon: 7.086, radius: 3, expanded: 4, tier: 2 },
  { name: "Braunschweig", lat: 52.269, lon: 10.522, radius: 3, expanded: 5, tier: 2 },
  { name: "Aachen", lat: 50.776, lon: 6.084, radius: 3, expanded: 5, tier: 2 },
  { name: "Kiel", lat: 54.323, lon: 10.123, radius: 3, expanded: 5, tier: 2 },
  { name: "Chemnitz", lat: 50.828, lon: 12.921, radius: 3, expanded: 5, tier: 2 },
  { name: "Halle", lat: 51.483, lon: 11.97, radius: 3, expanded: 5, tier: 2 },
  { name: "Magdeburg", lat: 52.131, lon: 11.632, radius: 3, expanded: 5, tier: 2 },
  // Tier 3: 100k-200k — expanded city center
  { name: "Freiburg", lat: 47.999, lon: 7.842, radius: 3, expanded: 4, tier: 3 },
  { name: "Krefeld", lat: 51.339, lon: 6.586, radius: 2, expanded: 4, tier: 3 },
  { name: "Mainz", lat: 50.0, lon: 8.271, radius: 3, expanded: 4, tier: 3 },
  { name: "Lübeck", lat: 53.87, lon: 10.687, radius: 3, expanded: 4, tier: 3 },
  { name: "Erfurt", lat: 50.985, lon: 11.03, radius: 3, expanded: 4, tier: 3 },
  { name: "Oberhausen", lat: 51.47, lon: 6.851, radius: 2, expanded: 4, tier: 3 },
  { name: "Rostock", lat: 54.088, lon: 12.14, radius: 3, expanded: 4, tier: 3 },
  { name: "Kassel", lat: 51.316, lon: 9.497, radius: 3, expanded: 4, tier: 3 },
  { name: "Hagen", lat: 51.361, lon: 7.475, radius: 2, expanded: 4, tier: 3 },
  { name: "Potsdam", lat: 52.401, lon: 13.066, radius: 3, expanded: 4, tier: 3 },
  { name: "Saarbrücken", lat: 49.234, lon: 6.997, radius: 3, expanded: 4, tier: 3 },
  { name: "Hamm", lat: 51.674, lon: 7.815, radius: 2, expanded: 4, tier: 3 },
  { name: "Ludwigshafen", lat: 49.481, lon: 8.432, radius: 2, expanded: 3, tier: 3 },
  { name: "Oldenburg", lat: 53.143, lon: 8.214, radius: 2, expanded: 4, tier: 3 },
  { name: "Osnabrück", lat: 52.28, lon: 8.043, radius: 3, expanded: 4, tier: 3 },
  { name: "Leverkusen", lat: 51.049, lon: 7.019, radius: 2, expanded: 3, tier: 3 },
  { name: "Heidelberg", lat: 49.398, lon: 8.672, radius: 2, expanded: 4, tier: 3 },
  { name: "Solingen", lat: 51.165, lon: 7.084, radius: 2, expanded: 3, tier: 3 },
  { name: "Darmstadt", lat: 49.872, lon: 8.651, radius: 2, expanded: 4, tier: 3 },
  { name: "Regensburg", lat: 49.014, lon: 12.1, radius: 3, expanded: 4, tier: 3 },
  { name: "Ingolstadt", lat: 48.764, lon: 11.425, radius: 2, expanded: 4, tier: 3 },
  { name: "Würzburg", lat: 49.794, lon: 9.93, radius: 3, expanded: 4, tier: 3 },
  { name: "Wolfsburg", lat: 52.424, lon: 10.787, radius: 2, expanded: 4, tier: 3 },
  { name: "Ulm", lat: 48.401, lon: 9.988, radius: 2, expanded: 4, tier: 3 },
  { name: "Heilbronn", lat: 49.142, lon: 9.219, radius: 2, expanded: 3, tier: 3 },
  { name: "Göttingen", lat: 51.541, lon: 9.936, radius: 2, expanded: 4, tier: 3 },
  { name: "Pforzheim", lat: 48.892, lon: 8.699, radius: 2, expanded: 3, tier: 3 },
  { name: "Reutlingen", lat: 48.493, lon: 9.214, radius: 2, expanded: 3, tier: 3 },
  { name: "Koblenz", lat: 50.357, lon: 7.589, radius: 2, expanded: 4, tier: 3 },
  { name: "Bremerhaven", lat: 53.54, lon: 8.581, radius: 2, expanded: 3, tier: 3 },
  { name: "Trier", lat: 49.75, lon: 6.637, radius: 2, expanded: 4, tier: 3 },
  { name: "Jena", lat: 50.928, lon: 11.586, radius: 2, expanded: 3, tier: 3 },
  { name: "Erlangen", lat: 49.598, lon: 11.005, radius: 2, expanded: 3, tier: 3 },
  { name: "Moers", lat: 51.451, lon: 6.626, radius: 2, expanded: 3, tier: 3 },
  { name: "Siegen", lat: 50.874, lon: 8.017, radius: 2, expanded: 3, tier: 3 },
  { name: "Hildesheim", lat: 52.151, lon: 9.951, radius: 2, expanded: 3, tier: 3 },
  { name: "Salzgitter", lat: 52.154, lon: 10.332, radius: 2, expanded: 3, tier: 3 },
  { name: "Cottbus", lat: 51.761, lon: 14.335, radius: 2, expanded: 4, tier: 3 },
  { name: "Schwerin", lat: 53.629, lon: 11.414, radius: 2, expanded: 3, tier: 3 },
  { name: "Konstanz", lat: 47.66, lon: 9.175, radius: 2, expanded: 3, tier: 3 },
  { name: "Dortmund", lat: 51.514, lon: 7.466, radius: 3, expanded: 6, tier: 2 },
  // Austria
  { name: "Wien", lat: 48.209, lon: 16.372, radius: 5, expanded: 9, tier: 1 },
  { name: "Graz", lat: 47.071, lon: 15.439, radius: 3, expanded: 5, tier: 2 },
  { name: "Linz", lat: 48.306, lon: 14.286, radius: 3, expanded: 5, tier: 2 },
  { name: "Salzburg", lat: 47.81, lon: 13.055, radius: 3, expanded: 4, tier: 2 },
  { name: "Innsbruck", lat: 47.263, lon: 11.395, radius: 3, expanded: 4, tier: 2 },
  // Switzerland
  { name: "Zürich", lat: 47.377, lon: 8.541, radius: 4, expanded: 7, tier: 1 },
  { name: "Bern", lat: 46.948, lon: 7.448, radius: 3, expanded: 5, tier: 2 },
  { name: "Basel", lat: 47.558, lon: 7.589, radius: 3, expanded: 4, tier: 2 },
  { name: "Genf", lat: 46.205, lon: 6.144, radius: 3, expanded: 5, tier: 2 },
  { name: "Luzern", lat: 47.051, lon: 8.31, radius: 2, expanded: 3, tier: 3 },
];

function generateGrid(
  lat: number,
  lon: number,
  radiusKm: number,
  spacingM: number,
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [];
  const spacingDeg = spacingM / 111000;
  const steps = Math.ceil((radiusKm * 1000) / spacingM);

  for (let x = -steps; x <= steps; x++) {
    for (let y = -steps; y <= steps; y++) {
      const pLat = lat + y * spacingDeg;
      const pLon = lon + x * spacingDeg;
      const distKm = Math.sqrt(
        Math.pow((pLat - lat) * 111, 2) +
          Math.pow(
            (pLon - lon) * 111 * Math.cos((lat * Math.PI) / 180),
            2,
          ),
      );
      if (distKm <= radiusKm) points.push({ lat: pLat, lon: pLon });
    }
  }
  return points;
}

async function fetchPlaces(
  lat: number,
  lon: number,
  radius: number,
): Promise<GooglePlace[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY!,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.accessibilityOptions,places.restroom,places.primaryType,places.types",
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius,
          },
        },
        includedTypes: [
          "restaurant",
          "cafe",
          "fast_food_restaurant",
          "gym",
          "shopping_mall",
          "department_store",
          "supermarket",
          "convenience_store",
          "gas_station",
          "bar",
          "bakery",
        ],
        maxResultCount: 20,
      }),
    },
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API error ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.places || [];
}

function convert(place: GooglePlace, city: string): ToiletEntry | null {
  if (place.restroom !== true) return null;

  const types = place.types || [];
  const pt = place.primaryType || "";

  let category: ToiletCategory = "other";
  if (
    types.includes("restaurant") ||
    types.includes("cafe") ||
    types.includes("fast_food_restaurant") ||
    types.includes("bar") ||
    types.includes("bakery") ||
    pt.includes("restaurant") ||
    pt.includes("cafe") ||
    pt.includes("bakery")
  ) {
    category = "gastro";
  } else if (types.includes("gas_station") || pt.includes("gas_station")) {
    category = "tankstelle";
  }

  const tags: string[] = [];
  if (place.accessibilityOptions?.wheelchairAccessibleRestroom) {
    tags.push("barrierefrei", "google_wc_accessible");
  } else if (place.accessibilityOptions?.wheelchairAccessibleEntrance) {
    tags.push("barrierefrei", "google_entrance_accessible");
  } else {
    tags.push("google_has_restroom");
  }

  return {
    id: `gplace_${place.id}`,
    lat: place.location.latitude,
    lon: place.location.longitude,
    name: place.displayName?.text || "Unnamed",
    city,
    category,
    tags,
  };
}

function distM(
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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const tierIdx = process.argv.indexOf("--tier");
  const tierLevel = tierIdx !== -1 ? parseInt(process.argv[tierIdx + 1]) : 0;
  const SPACING = 1500; // meters between grid points

  // Filter and configure cities based on tier
  const cities = (tierLevel > 0
    ? CITIES.filter((c) => c.tier <= tierLevel)
    : CITIES
  ).map((c) => ({
    ...c,
    activeRadius: tierLevel > 0 ? c.expanded : c.radius,
  }));

  console.log(`\n🇩🇪 Google Places DACH Fetcher`);
  console.log(`===============================\n`);
  if (tierLevel > 0) {
    console.log(`Tier: ${tierLevel} (expanded radii for ${tierLevel === 1 ? "500k+" : tierLevel === 2 ? "200k+" : "100k+"} cities)`);
  } else {
    console.log(`Mode: default (original radii). Use --tier 1|2|3 for expanded coverage.`);
  }
  console.log(`Cities: ${cities.length}`);
  console.log(`Grid spacing: ${SPACING}m`);

  // Calculate total API calls
  let totalCalls = 0;
  for (const city of cities) {
    totalCalls += generateGrid(city.lat, city.lon, city.activeRadius, SPACING).length;
  }
  console.log(`Total API calls needed: ${totalCalls}`);
  console.log(`Estimated cost: ${totalCalls <= 5000 ? "FREE (within free tier)" : `~$${((totalCalls / 1000) * 17).toFixed(0)} (${totalCalls - 5000} calls above free tier)`}\n`);

  if (dryRun) {
    console.log("Dry run - showing per-city breakdown:\n");
    for (const city of cities) {
      const pts = generateGrid(city.lat, city.lon, city.activeRadius, SPACING).length;
      const expanded = tierLevel > 0 && city.activeRadius > city.radius;
      console.log(`  ${city.name.padEnd(20)} ${city.activeRadius}km radius → ${pts.toString().padStart(4)} calls${expanded ? ` (was ${city.radius}km)` : ""}`);
    }
    console.log(`\nTotal: ${totalCalls} API calls`);
    return;
  }

  // Load existing
  const outPath = path.join(__dirname, "..", "src", "data", "google-places.json");
  let existing: ToiletEntry[] = [];
  if (fs.existsSync(outPath)) {
    const data = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    existing = data.toilets || [];
    console.log(`Loaded ${existing.length} existing places\n`);
  }

  const allNew: ToiletEntry[] = [];
  let totalApiCalls = 0;
  let totalFound = 0;

  for (let ci = 0; ci < cities.length; ci++) {
    const city = cities[ci];
    const grid = generateGrid(city.lat, city.lon, city.activeRadius, SPACING);

    process.stdout.write(
      `[${ci + 1}/${cities.length}] ${city.name.padEnd(20)} ${city.activeRadius}km (${grid.length} pts) `,
    );

    let cityFound = 0;
    for (let gi = 0; gi < grid.length; gi++) {
      try {
        const places = await fetchPlaces(
          grid[gi].lat,
          grid[gi].lon,
          SPACING * 0.8,
        );
        totalApiCalls++;

        for (const p of places) {
          const t = convert(p, city.name);
          if (t) {
            allNew.push(t);
            cityFound++;
          }
        }
        totalFound += places.length;

        // Rate limit
        await sleep(80);
      } catch (err: any) {
        process.stdout.write(`ERR `);
        // If rate limited, wait longer and retry
        if (err.message?.includes("429")) {
          await sleep(5000);
        }
      }
    }
    console.log(`→ ${cityFound} with restroom`);
  }

  console.log(`\n--- Summary ---`);
  console.log(`API calls: ${totalApiCalls}`);
  console.log(`Total places found: ${totalFound}`);
  console.log(`With restroom: ${allNew.length}`);

  // Deduplicate new results
  const unique: ToiletEntry[] = [];
  for (const t of allNew) {
    const isDup = unique.some((u) => distM(u.lat, u.lon, t.lat, t.lon) < 30);
    if (!isDup) unique.push(t);
  }
  console.log(`Unique new: ${unique.length}`);

  // Merge with existing
  const merged = [...existing];
  let added = 0;
  for (const t of unique) {
    const isDup = merged.some((e) => distM(e.lat, e.lon, t.lat, t.lon) < 30);
    if (!isDup) {
      merged.push(t);
      added++;
    }
  }

  console.log(`Added ${added} new (${merged.length} total)`);
  console.log(
    `  Gastro: ${merged.filter((t) => t.category === "gastro").length}`,
  );
  console.log(
    `  Tankstelle: ${merged.filter((t) => t.category === "tankstelle").length}`,
  );
  console.log(
    `  Other: ${merged.filter((t) => t.category === "other").length}`,
  );
  console.log(
    `  Wheelchair accessible: ${merged.filter((t) => t.tags.includes("barrierefrei")).length}`,
  );

  // Save
  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: `Google Places API - ${cities.length} cities across DACH${tierLevel > 0 ? ` (tier ${tierLevel})` : ""}`,
    count: merged.length,
    toilets: merged,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outPath}`);

  console.log("\nNext steps:");
  console.log("  npx tsx scripts/merge-sources.ts");
  console.log("  npx tsx scripts/migrate-hours-format.ts");
  console.log("  npx tsx scripts/split-tiles.ts");
  console.log("  npx tsx scripts/gen-tile-loader.ts");
}

main().catch(console.error);
