/**
 * Fetches businesses with wheelchair-accessible toilets from OpenStreetMap.
 * Many toilets are INSIDE businesses (restaurants, cafes, gyms, supermarkets)
 * and not tagged as separate amenity=toilets.
 *
 * Usage: npx tsx scripts/fetch-business-toilets.ts
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

async function fetchQuery(
  bbox: string,
  queryType: string,
  query: string,
  label: string,
): Promise<ToiletEntry[]> {
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`  ${label} (${queryType})...`);
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });

      if (!res.ok) {
        console.warn(`    ${res.status}, trying next...`);
        continue;
      }

      const data = await res.json();
      const results: ToiletEntry[] = [];

      for (const el of data.elements) {
        const tags = el.tags || {};

        // Skip standalone toilets
        if (tags.amenity === "toilets") continue;

        const name = tags.name || tags.brand || tags.operator;
        if (!name) continue;

        const entryTags: string[] = ["barrierefrei"];

        let category: ToiletCategory = "other";
        const amenity = tags.amenity || "";
        const shop = tags.shop || "";

        if (
          amenity === "restaurant" ||
          amenity === "fast_food" ||
          amenity === "cafe"
        ) {
          category = "gastro";
        }

        if (tags.eurokey === "yes") entryTags.push("eurokey");
        if (tags.fee === "no") entryTags.push("kostenlos");

        results.push({
          id: `biz_${el.id}`,
          lat: el.lat || el.center?.lat,
          lon: el.lon || el.center?.lon,
          name: name,
          city: tags["addr:city"] || "",
          category,
          tags: entryTags,
          opening_hours: tags.opening_hours,
          operator: tags.operator || tags.brand,
          fee: tags.fee,
        });
      }

      console.log(`    ${results.length} found`);
      return results;
    } catch (err) {
      console.warn(`    failed: ${err}`);
    }
  }
  return [];
}

async function fetchBand(bbox: string, label: string): Promise<ToiletEntry[]> {
  const all: ToiletEntry[] = [];

  // Query 1: Restaurants with wheelchair toilets
  const restaurants = await fetchQuery(
    bbox,
    "restaurants",
    `
    [out:json][timeout:60];
    node["amenity"~"restaurant|fast_food"]["toilets:wheelchair"="yes"](${bbox});
    out body;
  `,
    label,
  );
  all.push(...restaurants);
  await sleep(3000);

  // Query 2: Cafes
  const cafes = await fetchQuery(
    bbox,
    "cafes",
    `
    [out:json][timeout:60];
    node["amenity"="cafe"]["toilets:wheelchair"="yes"](${bbox});
    out body;
  `,
    label,
  );
  all.push(...cafes);
  await sleep(3000);

  // Query 3: Supermarkets with wheelchair access
  const supermarkets = await fetchQuery(
    bbox,
    "supermarkets",
    `
    [out:json][timeout:60];
    node["shop"="supermarket"]["wheelchair"="yes"](${bbox});
    out body;
  `,
    label,
  );
  all.push(...supermarkets);
  await sleep(3000);

  // Query 4: Gyms/fitness
  const gyms = await fetchQuery(
    bbox,
    "gyms",
    `
    [out:json][timeout:60];
    node["leisure"="fitness_centre"]["wheelchair"="yes"](${bbox});
    out body;
  `,
    label,
  );
  all.push(...gyms);

  return all;
}

async function main() {
  console.log("Fetching businesses with wheelchair-accessible toilets...\n");

  // Just Germany for now (faster)
  const bands = [
    { label: "North Germany (52-55)", bbox: "52.0,6.0,55.0,15.0" },
    { label: "Central Germany (50-52)", bbox: "50.0,6.0,52.0,15.0" },
    { label: "South Germany (47-50)", bbox: "47.0,6.0,50.0,15.0" },
  ];

  const all: ToiletEntry[] = [];

  for (const { label, bbox } of bands) {
    const results = await fetchBand(bbox, label);
    all.push(...results);
  }

  // Deduplicate
  const unique: ToiletEntry[] = [];
  const DEDUP_RADIUS = 0.0005;

  for (const t of all) {
    const isDuplicate = unique.some(
      (u) =>
        Math.abs(u.lat - t.lat) < DEDUP_RADIUS &&
        Math.abs(u.lon - t.lon) < DEDUP_RADIUS,
    );
    if (!isDuplicate) unique.push(t);
  }

  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: "OpenStreetMap - Businesses with wheelchair toilets",
    count: unique.length,
    toilets: unique,
  };

  const outPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "business-toilets.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  const cats: Record<string, number> = { gastro: 0, other: 0 };
  for (const t of unique) cats[t.category] = (cats[t.category] || 0) + 1;

  console.log(`\n--- Results ---`);
  console.log(`Total businesses: ${unique.length}`);
  console.log(`  gastro: ${cats.gastro}`);
  console.log(`  other: ${cats.other}`);

  // Check Hannover specifically
  const hannover = unique.filter(
    (t) => t.lat > 52.35 && t.lat < 52.42 && t.lon > 9.7 && t.lon < 9.85,
  );
  console.log(`\nHannover area: ${hannover.length} businesses`);
  hannover.slice(0, 10).forEach((t) => console.log(`  - ${t.name}`));
}

main().catch(console.error);
