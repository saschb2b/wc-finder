/**
 * Fetches rest areas with toilets from the official German Autobahn API.
 * Free, no authentication required.
 * Source: https://autobahn.api.bund.dev/
 *
 * Usage: npx tsx scripts/fetch-autobahn-rest.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const BASE_URL = "https://verkehr.autobahn.de/o/autobahn";

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

interface ParkingFeatureIcon {
  icon: string;
  description: string;
  style: string;
}

interface ParkingLorry {
  identifier: string;
  subtitle: string;
  title: string;
  coordinate: { long: string; lat: string };
  description: string[];
  lorryParkingFeatureIcons: ParkingFeatureIcon[];
  isBlocked: string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hasToilet(features: ParkingFeatureIcon[]): boolean {
  return features.some(
    (f) =>
      f.description.toLowerCase().includes("toilette") ||
      f.icon.includes("restroom"),
  );
}

function isRaststaette(features: ParkingFeatureIcon[]): boolean {
  return features.some(
    (f) =>
      f.description.toLowerCase().includes("raststätte") ||
      f.description.toLowerCase().includes("restaurant") ||
      f.description.toLowerCase().includes("tankstelle"),
  );
}

function convertToToilet(
  parking: ParkingLorry,
  road: string,
): ToiletEntry | null {
  const lat = parseFloat(parking.coordinate.lat);
  const lon = parseFloat(parking.coordinate.long);

  if (isNaN(lat) || isNaN(lon)) return null;

  const features = parking.lorryParkingFeatureIcons || [];
  const hasWC = hasToilet(features);
  const isStaffed = isRaststaette(features);
  const hasGas = features.some((f) =>
    f.description.toLowerCase().includes("tankstelle"),
  );

  // Build name
  const name = parking.subtitle || parking.title || `Rastplatz ${road}`;

  // Tags
  const tags: string[] = ["autobahn", road.toLowerCase()];
  if (hasWC) tags.push("toilette");
  if (hasGas) tags.push("tankstelle");
  if (isStaffed) tags.push("raststätte");
  for (const f of features) {
    if (f.description.toLowerCase().includes("dusche")) tags.push("dusche");
  }

  // Category: staffed rest areas with gas = tankstelle, rest areas with toilet = public_24h
  let category: ToiletCategory = "other";
  if (hasGas) {
    category = "tankstelle";
  } else if (hasWC) {
    // Unstaffed rest area with toilet — typically 24/7 accessible
    category = "public_24h";
  } else if (isStaffed) {
    category = "gastro";
  }

  return {
    id: `autobahn_${parking.identifier}`,
    lat,
    lon,
    name: `${name} (${road})`,
    city: "",
    category,
    tags,
    opening_hours: hasWC && !isStaffed ? "24/7" : undefined,
    operator: isStaffed ? "Tank & Rast" : "Autobahn GmbH",
  };
}

async function fetchRoads(): Promise<string[]> {
  const res = await fetch(`${BASE_URL}/`);
  if (!res.ok) throw new Error(`Failed to fetch roads: ${res.status}`);
  const data = await res.json();
  return data.roads;
}

async function fetchParkingForRoad(road: string): Promise<ParkingLorry[]> {
  const res = await fetch(`${BASE_URL}/${road}/services/parking_lorry`);
  if (!res.ok) {
    console.warn(`  Warning: failed to fetch ${road}: ${res.status}`);
    return [];
  }
  const data = await res.json();
  return data.parking_lorry || [];
}

async function main() {
  console.log(`\n🛣️  Autobahn Rest Area Fetcher`);
  console.log(`================================\n`);

  const roads = await fetchRoads();
  console.log(`Found ${roads.length} Autobahnen\n`);

  const allToilets: ToiletEntry[] = [];
  let totalParking = 0;
  let withToilet = 0;

  for (const road of roads) {
    const parkings = await fetchParkingForRoad(road);
    totalParking += parkings.length;

    let roadWC = 0;
    for (const p of parkings) {
      const toilet = convertToToilet(p, road);
      if (toilet) {
        allToilets.push(toilet);
        if (toilet.tags.includes("toilette")) roadWC++;
      }
    }
    withToilet += roadWC;

    if (parkings.length > 0) {
      console.log(
        `  ${road}: ${parkings.length} rest areas, ${roadWC} with toilet`,
      );
    }

    // Rate limit: be gentle
    await sleep(100);
  }

  // Deduplicate by proximity (some rest areas appear on multiple roads)
  const deduped: ToiletEntry[] = [];
  const DEDUP_RADIUS = 100; // meters

  for (const t of allToilets) {
    const isDup = deduped.some((e) => {
      const dLat = Math.abs(e.lat - t.lat);
      const dLon = Math.abs(e.lon - t.lon);
      if (dLat > 0.002 || dLon > 0.002) return false;
      const R = 6371000;
      const dlat = ((t.lat - e.lat) * Math.PI) / 180;
      const dlon = ((t.lon - e.lon) * Math.PI) / 180;
      const a =
        Math.sin(dlat / 2) ** 2 +
        Math.cos((e.lat * Math.PI) / 180) *
          Math.cos((t.lat * Math.PI) / 180) *
          Math.sin(dlon / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) < DEDUP_RADIUS;
    });
    if (!isDup) deduped.push(t);
  }

  // Stats
  const cats: Record<string, number> = {};
  for (const t of deduped) cats[t.category] = (cats[t.category] || 0) + 1;

  console.log(`\n--- Results ---`);
  console.log(`Total rest areas found: ${totalParking}`);
  console.log(`With toilet: ${withToilet}`);
  console.log(`After dedup: ${deduped.length}`);
  for (const [cat, count] of Object.entries(cats).sort(
    (a, b) => b[1] - a[1],
  )) {
    console.log(`  ${cat}: ${count}`);
  }

  // Save
  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: "Autobahn GmbH API (autobahn.api.bund.dev)",
    count: deduped.length,
    toilets: deduped,
  };

  const outPath = path.join(__dirname, "..", "src", "data", "autobahn-rest.json");
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
