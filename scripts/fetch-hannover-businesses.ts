/**
 * Fetches wheelchair-accessible businesses in Hannover from OSM.
 * This is a LIMITED query to avoid Overpass timeouts - fetches only
 * restaurants/cafes/supermarkets with wheelchair=yes in Hannover bbox.
 *
 * Usage: npx tsx scripts/fetch-hannover-businesses.ts
 * Note: Overpass may timeout during peak hours. Run manually if needed.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

async function fetchWithFallback(query: string): Promise<any[]> {
  for (const url of OVERPASS_URLS) {
    try {
      console.log(`Trying ${new URL(url).host}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(60000),
      });

      if (!res.ok) {
        console.warn(`  HTTP ${res.status}, trying next...`);
        continue;
      }

      const data = await res.json();
      return data.elements || [];
    } catch (err) {
      console.warn(`  Failed: ${err instanceof Error ? err.message : err}`);
    }
  }
  throw new Error('All Overpass endpoints failed');
}

async function main() {
  console.log('Fetching Hannover businesses with wheelchair access...\n');
  console.log('Note: This query may timeout during peak hours.');
  console.log('If it fails, the existing hannover-businesses.json will be kept.\n');

  // Hannover bounding box (approximate)
  const bbox = '52.3,9.6,52.45,9.9';

  try {
    // Simple query - just nodes to avoid complexity
    const query = `
[out:json][timeout:60];
(
  node["amenity"~"restaurant|fast_food|cafe"]["wheelchair"="yes"](${bbox});
  node["shop"="supermarket"]["wheelchair"="yes"](${bbox});
  node["leisure"="fitness_centre"]["wheelchair"="yes"](${bbox});
  node["shop"="bakery"]["wheelchair"="yes"](${bbox});
);
out body;
`;

    const elements = await fetchWithFallback(query);
    console.log(`Found ${elements.length} businesses`);

    const results: ToiletEntry[] = [];

    for (const el of elements) {
      const t = el.tags || {};
      if (t.amenity === 'toilets') continue; // Skip standalone

      const name = t.name || t.brand || t.operator;
      if (!name) continue;

      const entryTags: string[] = ['barrierefrei'];

      let category: ToiletCategory = 'other';
      const amenity = t.amenity || '';

      if (amenity === 'restaurant' || amenity === 'fast_food' || amenity === 'cafe') {
        category = 'gastro';
      }

      if (t.eurokey === 'yes') entryTags.push('eurokey');

      results.push({
        id: `hbiz_${el.id}`,
        lat: el.lat,
        lon: el.lon,
        name,
        city: t['addr:city'] || 'Hannover',
        category,
        tags: entryTags,
        opening_hours: t.opening_hours,
        operator: t.operator || t.brand,
      });
    }

    // Deduplicate
    const unique: ToiletEntry[] = [];
    const DEDUP_RADIUS = 0.0005;

    for (const t of results) {
      const isDup = unique.some(u =>
        Math.abs(u.lat - t.lat) < DEDUP_RADIUS &&
        Math.abs(u.lon - t.lon) < DEDUP_RADIUS
      );
      if (!isDup) unique.push(t);
    }

    const output = {
      generated: new Date().toISOString().split('T')[0],
      source: 'OpenStreetMap - Hannover wheelchair-accessible businesses',
      count: unique.length,
      toilets: unique,
    };

    const outPath = path.join(__dirname, '..', 'src', 'data', 'hannover-businesses.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`\n✅ Saved ${unique.length} businesses to hannover-businesses.json`);
    console.log(`   - gastro: ${unique.filter(t => t.category === 'gastro').length}`);
    console.log(`   - other: ${unique.filter(t => t.category === 'other').length}`);

  } catch (err) {
    console.error('\n❌ Fetch failed:', err instanceof Error ? err.message : err);
    console.log('\nKeeping existing hannover-businesses.json (manual data)');
    process.exit(0); // Don't fail the pipeline
  }
}

main();
