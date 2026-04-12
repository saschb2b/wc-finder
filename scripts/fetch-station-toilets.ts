/**
 * Fetches toilet data at train/bus stations from OpenStreetMap.
 * Queries: stations with toilets tagged, Sanifair/DB toilets, toilets at stations.
 *
 * Usage: npx tsx scripts/fetch-station-toilets.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OVERPASS_URLS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function queryOverpass(
  query: string,
  maxRetries = 3,
): Promise<any[]> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    if (attempt > 0) {
      const wait = 30000 * attempt;
      console.log(`  Retry ${attempt}/${maxRetries}, waiting ${wait / 1000}s...`);
      await sleep(wait);
    }
    for (const url of OVERPASS_URLS) {
      try {
        console.log(`  Trying ${new URL(url).hostname}...`);
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(120000),
        });
        if (res.status === 429) {
          console.warn(`  429 rate limited from ${url}`);
          continue;
        }
        if (!res.ok) {
          console.warn(`  ${res.status} from ${url}`);
          continue;
        }
        const text = await res.text();
        if (text.includes("<html")) {
          console.warn(`  Got HTML error from ${url}`);
          continue;
        }
        const data = JSON.parse(text);
        return data.elements || [];
      } catch (e: any) {
        console.warn(`  Error from ${url}: ${e.message}`);
      }
      await sleep(3000);
    }
  }
  throw new Error("All Overpass servers failed after retries");
}

function getCoords(el: any): { lat: number; lon: number } | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;
  return { lat, lon };
}

function convertStation(el: any): ToiletEntry | null {
  const coords = getCoords(el);
  if (!coords) return null;

  const tags = el.tags || {};
  const name = tags.name || "Bahnhof";
  const isWheelchairWC =
    tags["toilets:wheelchair"] === "yes" || tags.wheelchair === "yes";

  const entryTags: string[] = ["bahnhof"];
  if (isWheelchairWC) entryTags.push("barrierefrei");
  if (tags.railway === "halt") entryTags.push("haltepunkt");

  return {
    id: `station_${el.type}_${el.id}`,
    lat: coords.lat,
    lon: coords.lon,
    name,
    city: tags["addr:city"] || "",
    category: "station",
    tags: entryTags,
    opening_hours: tags.opening_hours,
    operator: tags.operator || tags.network,
  };
}

function convertSanifairToilet(el: any): ToiletEntry | null {
  const coords = getCoords(el);
  if (!coords) return null;

  const tags = el.tags || {};
  const operator = tags.operator || "";
  const name = tags.name || `Sanifair WC`;
  const isWheelchairWC =
    tags.wheelchair === "yes" || tags["toilets:wheelchair"] === "yes";

  const entryTags: string[] = ["sanifair"];
  if (isWheelchairWC) entryTags.push("barrierefrei");
  if (tags.fee === "yes") entryTags.push("kostenpflichtig");

  return {
    id: `sanifair_${el.type}_${el.id}`,
    lat: coords.lat,
    lon: coords.lon,
    name,
    city: tags["addr:city"] || "",
    category: "station",
    tags: entryTags,
    opening_hours: tags.opening_hours,
    operator,
    fee: tags.fee,
  };
}

async function main() {
  console.log(`\n🚉 Station Toilet Fetcher`);
  console.log(`=========================\n`);

  // DACH bounding box: 46.0,5.5,55.5,17.5
  const bbox = "46.0,5.5,55.5,17.5";

  // Query 1: Stations with toilets
  console.log("Fetching stations with toilets...");
  const stationQuery = `[out:json][timeout:180];
(
  nwr["railway"="station"]["toilets"~"yes"](${bbox});
  nwr["railway"="station"]["toilets:wheelchair"="yes"](${bbox});
  nwr["railway"="halt"]["toilets"~"yes"](${bbox});
  nwr["railway"="halt"]["toilets:wheelchair"="yes"](${bbox});
);
out center body;`;

  const stationElements = await queryOverpass(stationQuery);
  console.log(`  Found ${stationElements.length} station elements\n`);

  await sleep(30000);

  // Query 2: Sanifair / DB toilets
  console.log("Fetching Sanifair/DB toilets...");
  const sanifairQuery = `[out:json][timeout:180];
(
  nwr["amenity"="toilets"]["operator"~"Sanifair|DB|Deutsche Bahn",i](${bbox});
  nwr["amenity"="toilets"]["brand"~"Sanifair",i](${bbox});
  nwr["amenity"="toilets"]["name"~"Sanifair",i](${bbox});
);
out center body;`;

  const sanifairElements = await queryOverpass(sanifairQuery);
  console.log(`  Found ${sanifairElements.length} Sanifair/DB toilet elements\n`);

  // Convert
  const toilets: ToiletEntry[] = [];

  for (const el of stationElements) {
    const t = convertStation(el);
    if (t) toilets.push(t);
  }

  for (const el of sanifairElements) {
    const t = convertSanifairToilet(el);
    if (t) toilets.push(t);
  }

  // Deduplicate
  const deduped: ToiletEntry[] = [];
  const DEDUP_RADIUS = 50;

  for (const t of toilets) {
    const isDup = deduped.some((e) => {
      const dLat = Math.abs(e.lat - t.lat);
      const dLon = Math.abs(e.lon - t.lon);
      if (dLat > 0.001 || dLon > 0.001) return false;
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
  const withBarrierefrei = deduped.filter((t) =>
    t.tags.includes("barrierefrei"),
  ).length;
  const sanifairCount = deduped.filter((t) =>
    t.tags.includes("sanifair"),
  ).length;

  console.log(`--- Results ---`);
  console.log(`Total: ${deduped.length} station toilets`);
  console.log(`  Wheelchair accessible: ${withBarrierefrei}`);
  console.log(`  Sanifair: ${sanifairCount}`);
  console.log(`  Regular station: ${deduped.length - sanifairCount}`);

  // Save
  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: "OpenStreetMap Overpass (train stations + Sanifair toilets)",
    count: deduped.length,
    toilets: deduped,
  };

  const outPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "station-toilets.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outPath}`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
