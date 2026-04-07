/**
 * Enhanced OSM fetcher - simplified for reliability
 * Fetches fuel stations, shopping centers, and tourist facilities
 *
 * Usage: npx tsx scripts/fetch-enhanced-osm.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

const OVERPASS_URLS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
];

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFuelStations(
  bbox: string,
  label: string,
): Promise<ToiletEntry[]> {
  const query = `
    [out:json][timeout:60];
    node["amenity"="fuel"](${bbox});
    out body;
  `;

  for (const url of OVERPASS_URLS) {
    try {
      console.log(`  ${label} fuel stations via ${new URL(url).host}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) continue;

      const data = await res.json();
      const results: ToiletEntry[] = [];

      for (const el of data.elements) {
        const tags = el.tags || {};
        const name = tags.name || tags.brand || "Tankstelle";

        results.push({
          id: `osm_fuel_${el.id}`,
          lat: el.lat,
          lon: el.lon,
          name: name,
          city: tags["addr:city"] || "",
          category: "other",
          tags: [],
          opening_hours: tags.opening_hours,
          operator: tags.operator || tags.brand,
        });
      }

      console.log(`    ${results.length} fuel stations`);
      return results;
    } catch {
      continue;
    }
  }
  return [];
}

async function fetchShopping(
  bbox: string,
  label: string,
): Promise<ToiletEntry[]> {
  const query = `
    [out:json][timeout:60];
    (
      node["shop"="mall"](${bbox});
      node["shop"="shopping_centre"](${bbox});
    );
    out body;
  `;

  for (const url of OVERPASS_URLS) {
    try {
      console.log(`  ${label} shopping via ${new URL(url).host}...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) continue;

      const data = await res.json();
      const results: ToiletEntry[] = [];

      for (const el of data.elements) {
        const tags = el.tags || {};

        results.push({
          id: `osm_mall_${el.id}`,
          lat: el.lat,
          lon: el.lon,
          name: tags.name || "Einkaufszentrum",
          city: tags["addr:city"] || "",
          category: "other",
          tags: [],
          opening_hours: tags.opening_hours,
        });
      }

      console.log(`    ${results.length} shopping centers`);
      return results;
    } catch {
      continue;
    }
  }
  return [];
}

async function main() {
  console.log("Fetching enhanced OSM data (simplified)...\n");

  const bands = [
    { label: "Germany West", bbox: "47.0,5.5,55.5,10.5" },
    { label: "Germany East", bbox: "47.0,10.5,55.5,17.5" },
  ];

  const all: ToiletEntry[] = [];

  for (const { label, bbox } of bands) {
    const fuel = await fetchFuelStations(bbox, label);
    all.push(...fuel);
    await sleep(2000);

    const shopping = await fetchShopping(bbox, label);
    all.push(...shopping);
    await sleep(2000);
  }

  // Deduplicate
  const unique = new Map<string, ToiletEntry>();
  for (const t of all) unique.set(t.id, t);

  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: "OpenStreetMap Overpass API (fuel + shopping)",
    count: unique.size,
    toilets: [...unique.values()],
  };

  const outPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "osm-enhanced.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\n--- Results ---`);
  console.log(`Total unique: ${unique.size}`);

  console.log(`\nSaved to: ${outPath}`);
}

main().catch(console.error);
