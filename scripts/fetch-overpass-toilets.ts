/**
 * Fetches wheelchair-accessible toilets directly from OpenStreetMap Overpass API
 * as a PRIMARY data source (not just enrichment).
 * Queries in lat bands to avoid timeouts.
 *
 * Usage: npx tsx scripts/fetch-overpass-toilets.ts
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function classifyFromOsm(tags: Record<string, string>): ToiletCategory {
  const name = (tags.name || '').toLowerCase();
  const operator = (tags.operator || '').toLowerCase();

  // Fuel stations / Raststätten
  if (/raststätte|autohof|tankstelle/.test(name + operator)) {
    return 'tankstelle';
  }

  // Train station toilets
  if (/sanifair|db station|bahnhof|hbf/.test(name + operator)) {
    return 'station';
  }

  // Public 24/7 indicators
  if (tags.opening_hours === '24/7') return 'public_24h';
  if (tags.access === 'yes' || tags.access === 'public') return 'public_24h';
  if (tags.eurokey === 'yes' || tags.centralkey === 'yes') return 'public_24h';
  if (/öffentliche|public|city.?toilette|city.?wc/.test(name)) return 'public_24h';

  // If no name and wheelchair accessible, likely a public toilet
  if (!tags.name && (tags.wheelchair === 'yes' || tags['toilets:wheelchair'] === 'yes')) {
    return 'public_24h';
  }

  return 'other';
}

async function fetchBand(bbox: string, label: string): Promise<ToiletEntry[]> {
  const query = `
    [out:json][timeout:90];
    (
      node["amenity"="toilets"]["wheelchair"="yes"](${bbox});
      node["amenity"="toilets"]["toilets:wheelchair"="yes"](${bbox});
    );
    out body;
  `;

  for (const url of OVERPASS_URLS) {
    try {
      console.log(`  ${label} via ${new URL(url).host}...`);
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
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
        const entryTags: string[] = ['barrierefrei'];

        if (tags.eurokey === 'yes' || tags.centralkey === 'yes') entryTags.push('eurokey');
        if (tags.fee === 'no') entryTags.push('kostenlos');

        results.push({
          id: `osm_${el.id}`,
          lat: el.lat,
          lon: el.lon,
          name: tags.name || tags.description || 'Barrierefreie Toilette',
          city: tags['addr:city'] || '',
          category: classifyFromOsm(tags),
          tags: entryTags,
          opening_hours: tags.opening_hours,
          operator: tags.operator,
          fee: tags.fee,
        });
      }

      console.log(`    ${results.length} toilets`);
      return results;
    } catch {
      console.warn(`    fetch failed, trying next...`);
    }
  }

  console.warn(`  ${label}: all endpoints failed`);
  return [];
}

async function main() {
  console.log('Fetching wheelchair toilets from Overpass API...\n');

  // DACH region split into latitude bands
  const bands = [
    { label: 'South (45-48)', bbox: '45.0,5.5,48.0,17.5' },
    { label: 'Mid-South (48-50)', bbox: '48.0,5.5,50.0,17.5' },
    { label: 'Mid-North (50-52)', bbox: '50.0,5.5,52.0,17.5' },
    { label: 'North (52-55.5)', bbox: '52.0,5.5,55.5,17.5' },
  ];

  const all: ToiletEntry[] = [];

  for (const { label, bbox } of bands) {
    const results = await fetchBand(bbox, label);
    all.push(...results);
    await sleep(5000);
  }

  // Deduplicate by OSM ID
  const unique = new Map<string, ToiletEntry>();
  for (const t of all) unique.set(t.id, t);

  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'OpenStreetMap Overpass API (direct)',
    count: unique.size,
    toilets: [...unique.values()],
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'osm-toilets.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Stats
  const cats = { public_24h: 0, station: 0, tankstelle: 0, gastro: 0, other: 0 };
  for (const t of unique.values()) cats[t.category]++;

  console.log(`\n--- Results ---`);
  console.log(`Total unique: ${unique.size}`);
  console.log(`  public_24h: ${cats.public_24h}`);
  console.log(`  station: ${cats.station}`);
  console.log(`  other: ${cats.other}`);

  // Hannover check
  const hannover = [...unique.values()].filter(
    (t) => t.lat > 52.3 && t.lat < 52.45 && t.lon > 9.6 && t.lon < 9.9
  );
  console.log(`\nHannover area: ${hannover.length} toilets`);
}

main().catch(console.error);
