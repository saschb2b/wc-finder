/**
 * Merges toilet data from all sources into one dataset, then splits into tiles.
 * Deduplicates by proximity (~50m radius).
 * Priority: curated (TFA/city) > OSM > toilettenhero
 *
 * Usage:
 *   1. Run fetch-toilets.ts (toilettenhero)
 *   2. Run fetch-overpass-toilets.ts (OSM direct)
 *   3. Run fetch-tfa.ts (curated)
 *   4. Run merge-sources.ts (this script)
 *   5. Run split-tiles.ts + gen-tile-loader.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');

interface ToiletEntry {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: string;
  tags: string[];
  opening_hours?: string;
  operator?: string;
  fee?: string;
}

interface DataFile {
  count: number;
  toilets: ToiletEntry[];
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function loadIfExists(filename: string): ToiletEntry[] {
  const p = path.join(dataDir, filename);
  if (!fs.existsSync(p)) {
    console.log(`  ${filename}: not found, skipping`);
    return [];
  }
  const data: DataFile = JSON.parse(fs.readFileSync(p, 'utf-8'));
  console.log(`  ${filename}: ${data.count} toilets`);
  return data.toilets;
}

function main() {
  console.log('Loading sources...');

  // Load in priority order (highest priority last, so they overwrite)
  const thToilets = loadIfExists('toilets.json');       // toilettenhero
  const osmToilets = loadIfExists('osm-toilets.json');  // overpass direct
  const tfaToilets = loadIfExists('tfa-toilets.json');  // curated

  // Merge: add all, deduplicate by proximity
  // Higher-priority sources added later will replace lower-priority duplicates
  const merged: ToiletEntry[] = [];
  const DEDUP_RADIUS = 50; // meters

  function addWithDedup(toilets: ToiletEntry[], sourceName: string) {
    let added = 0;
    let replaced = 0;
    let skipped = 0;

    for (const t of toilets) {
      // Find nearby existing toilet
      let nearbyIdx = -1;
      let nearbyDist = Infinity;

      for (let i = 0; i < merged.length; i++) {
        // Quick lat/lon filter before expensive haversine
        if (Math.abs(merged[i].lat - t.lat) > 0.001 && Math.abs(merged[i].lon - t.lon) > 0.001) continue;

        const d = getDistanceMeters(merged[i].lat, merged[i].lon, t.lat, t.lon);
        if (d < nearbyDist) {
          nearbyDist = d;
          nearbyIdx = i;
        }
      }

      if (nearbyIdx >= 0 && nearbyDist < DEDUP_RADIUS) {
        // Merge: keep higher-priority entry, but enrich with data from lower
        const existing = merged[nearbyIdx];

        // Take opening_hours, operator, fee from whichever has them
        if (!existing.opening_hours && t.opening_hours) existing.opening_hours = t.opening_hours;
        if (!existing.operator && t.operator) existing.operator = t.operator;
        if (!existing.fee && t.fee) existing.fee = t.fee;

        // Merge tags
        const tagSet = new Set([...existing.tags, ...t.tags]);
        existing.tags = [...tagSet];

        // If new source has a better name
        if (existing.name === 'Barrierefreie Toilette' && t.name !== 'Barrierefreie Toilette') {
          existing.name = t.name;
        }

        // If new source has better category
        if (existing.category === 'other' && t.category !== 'other') {
          existing.category = t.category;
        }

        // If new source has city and existing doesn't
        if (!existing.city && t.city) existing.city = t.city;

        replaced++;
      } else {
        merged.push({ ...t });
        added++;
      }
    }

    console.log(`  ${sourceName}: +${added} new, ${replaced} merged, ${skipped} skipped`);
  }

  console.log('\nMerging...');
  addWithDedup(thToilets, 'toilettenhero');
  addWithDedup(osmToilets, 'OSM direct');
  addWithDedup(tfaToilets, 'curated (TFA/city)');

  // Stats
  const cats: Record<string, number> = {};
  for (const t of merged) cats[t.category] = (cats[t.category] || 0) + 1;

  const hannover = merged.filter(
    (t) => t.lat > 52.3 && t.lat < 52.45 && t.lon > 9.6 && t.lon < 9.9
  );

  console.log(`\n--- Merged Results ---`);
  console.log(`Total: ${merged.length}`);
  for (const [cat, count] of Object.entries(cats).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ${count}`);
  }
  console.log(`\nHannover area: ${hannover.length} toilets`);
  console.log(`  eurokey: ${hannover.filter((t) => t.tags.includes('eurokey')).length}`);
  console.log(`  with opening hours: ${hannover.filter((t) => t.opening_hours).length}`);

  // Save
  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'Merged: toilettenhero.de + OpenStreetMap + Toiletten für alle + Stadt Hannover',
    count: merged.length,
    toilets: merged,
  };

  const outPath = path.join(dataDir, 'toilets.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to src/data/toilets.json`);
}

main();
