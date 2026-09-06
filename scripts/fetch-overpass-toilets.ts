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
import assert from 'node:assert/strict';
import { fetchOverpass } from './lib/overpass';

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

interface OsmNode { id: number; lat: number; lon: number; tags?: Record<string, string> }

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

  return 'other';
}

async function fetchBand(bbox: string, label: string): Promise<{ toilets: ToiletEntry[]; timestamp: string }> {
  const query = `
    [out:json][timeout:90];
    (
      node["amenity"="toilets"]["wheelchair"="yes"](${bbox});
      node["amenity"="toilets"]["toilets:wheelchair"="yes"](${bbox});
    );
    out body;
  `;

  console.log(`  ${label}...`);
  const data = await fetchOverpass<OsmNode>(query);
  const results: ToiletEntry[] = [];

  for (const el of data.elements) {
    const tags = el.tags || {};
    assert(Number.isFinite(el.lat) && Number.isFinite(el.lon) && Number.isSafeInteger(el.id), 'Invalid OSM node');
    if ([tags.access, tags['toilets:access']].some(access => ['no', 'private', 'employees'].includes(access || ''))
      || tags.toilets === 'no' || tags['toilets:wheelchair'] === 'no') continue;
    const entryTags: string[] = ['barrierefrei'];

    if (tags.eurokey === 'yes' || tags.centralkey === 'eurokey' || tags['toilets:centralkey'] === 'eurokey') entryTags.push('eurokey');
    const fee = tags['toilets:fee'] || tags.fee;
    if (fee === 'no') entryTags.push('kostenlos');

    results.push({
      id: `osm_${el.id}`,
      lat: el.lat,
      lon: el.lon,
      name: tags.name || tags.description || 'Barrierefreie Toilette',
      city: tags['addr:city'] || '',
      category: classifyFromOsm(tags),
      tags: entryTags,
      opening_hours: tags['toilets:opening_hours'] || tags.opening_hours,
      operator: tags.operator,
      fee,
    });
  }

  console.log(`    ${results.length} toilets`);
  return { toilets: results, timestamp: data.osm3s.timestamp_osm_base };
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
  const sourceTimestamps: Record<string, string> = {};

  for (const { label, bbox } of bands) {
    const results = await fetchBand(bbox, label);
    all.push(...results.toilets);
    sourceTimestamps[label] = results.timestamp;
    await sleep(5000);
  }

  // Deduplicate by OSM ID
  const unique = new Map<string, ToiletEntry>();
  for (const t of all) unique.set(t.id, t);

  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'OpenStreetMap Overpass API (direct)',
    sourceTimestamps,
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

main().catch(error => { console.error(error); process.exitCode = 1; });
