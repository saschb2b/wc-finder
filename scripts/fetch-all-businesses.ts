/**
 * Fetches ALL wheelchair-accessible businesses that likely have toilets.
 * This includes restaurants, cafes, supermarkets, gyms - places where toilets
 * are typically available for customers even if not explicitly tagged.
 *
 * These are marked as "gastro" or "other" category so users know they're
 * business toilets, not public facilities.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

async function fetchHannoverBusinesses(): Promise<ToiletEntry[]> {
  const query = `
    [out:json][timeout:60];
    (
      // All wheelchair-accessible restaurants/cafes/fast food in Hannover
      node["amenity"~"restaurant|cafe|fast_food"]["wheelchair"="yes"](52.3,9.6,52.45,9.9);

      // All wheelchair-accessible supermarkets in Hannover
      node["shop"="supermarket"]["wheelchair"="yes"](52.3,9.6,52.45,9.9);

      // All wheelchair-accessible gyms
      node["leisure"="fitness_centre"]["wheelchair"="yes"](52.3,9.6,52.45,9.9);

      // Bakeries
      node["shop"="bakery"]["wheelchair"="yes"](52.3,9.6,52.45,9.9);
    );
    out body;
  `;

  console.log("Fetching Hannover businesses...");
  const res = await fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const data = await res.json();
  console.log(`Found ${data.elements.length} raw results`);

  const results: ToiletEntry[] = [];

  for (const el of data.elements) {
    const t = el.tags || {};

    // Skip standalone toilets (we already have those)
    if (t.amenity === "toilets") continue;

    const name = t.name || t.brand || t.operator;
    if (!name) continue;

    const entryTags: string[] = ["barrierefrei"];

    // Categorize
    let category: ToiletCategory = "other";
    const amenity = t.amenity || "";
    const shop = t.shop || "";

    if (
      amenity === "restaurant" ||
      amenity === "fast_food" ||
      amenity === "cafe"
    ) {
      category = "gastro";
    }
    // Supermarkets, bakeries, gyms stay as 'other'

    if (t.eurokey === "yes") entryTags.push("eurokey");
    if (t.fee === "no" || t["toilets:fee"] === "no")
      entryTags.push("kostenlos");

    results.push({
      id: `hbiz_${el.id}`,
      lat: el.lat,
      lon: el.lon,
      name: name,
      city: t["addr:city"] || "Hannover",
      category,
      tags: entryTags,
      opening_hours: t.opening_hours,
      operator: t.operator || t.brand,
      fee: undefined, // Likely free for customers but not sure
    });
  }

  return results;
}

async function main() {
  console.log("Fetching Hannover businesses with likely toilets...\n");

  const businesses = await fetchHannoverBusinesses();

  // Deduplicate
  const unique: ToiletEntry[] = [];
  const DEDUP_RADIUS = 0.0005;

  for (const t of businesses) {
    const isDup = unique.some(
      (u) =>
        Math.abs(u.lat - t.lat) < DEDUP_RADIUS &&
        Math.abs(u.lon - t.lon) < DEDUP_RADIUS,
    );
    if (!isDup) unique.push(t);
  }

  const output = {
    generated: new Date().toISOString().split("T")[0],
    source:
      "OpenStreetMap - Hannover wheelchair-accessible businesses (restaurants, supermarkets, gyms, bakeries)",
    count: unique.length,
    toilets: unique,
  };

  const outPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "hannover-businesses.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Stats
  const cats: Record<string, number> = { gastro: 0, other: 0 };
  for (const t of unique) cats[t.category] = (cats[t.category] || 0) + 1;

  console.log(`\n--- Results ---`);
  console.log(`Total businesses: ${unique.length}`);
  console.log(`  gastro (restaurants/cafes): ${cats.gastro}`);
  console.log(`  other (supermarkets/gyms/bakeries): ${cats.other}`);

  // Check near user's location
  const userLat = 52.375;
  const userLon = 9.82;

  function dist(lat1: number, lon1: number, lat2: number, lon2: number) {
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

  console.log(`\n--- Near In den Sieben Stücken ---`);
  const nearby500 = unique.filter(
    (t) => dist(t.lat, t.lon, userLat, userLon) < 500,
  );
  const nearby1k = unique.filter(
    (t) => dist(t.lat, t.lon, userLat, userLon) < 1000,
  );
  const nearby2k = unique.filter(
    (t) => dist(t.lat, t.lon, userLat, userLon) < 2000,
  );

  console.log(`Within 500m: ${nearby500.length}`);
  console.log(`Within 1km: ${nearby1k.length}`);
  console.log(`Within 2km: ${nearby2k.length}`);

  console.log(`\nClosest 10:`);
  unique
    .map((t) => ({ ...t, d: dist(t.lat, t.lon, userLat, userLon) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 10)
    .forEach((t) => {
      console.log(`  ${Math.round(t.d)}m: ${t.name} (${t.category})`);
    });

  console.log(`\nSaved to: ${outPath}`);
}

main().catch(console.error);
