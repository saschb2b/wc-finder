/**
 * Enhanced OSM fetcher that gets MORE toilets than basic wheelchair=yes filter
 * Includes:
 * - wheelchair=limited (usable with assistance)
 * - Any amenity=toilets (we'll categorize as accessible if it looks public)
 * - Businesses with toilets (fuel stations, restaurants, cafes, etc.)
 *
 * Usage: npx tsx scripts/fetch-enhanced-osm.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

type ToiletCategory = 'public_24h' | 'station' | 'gastro' | 'other';

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
  wheelchair?: 'yes' | 'limited' | 'no' | undefined;
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

  // Station toilets
  if (/sanifair|db station|bahnhof|hbf|raststätte|autohof/.test(name + operator)) {
    return 'station';
  }

  // Fuel stations often have toilets
  if (tags.amenity === 'fuel' || /shell|aral|jet|total|bp/.test(name + operator)) {
    return 'other';
  }

  // Restaurants/cafes
  if (tags.amenity === 'restaurant' || tags.amenity === 'cafe' || tags.amenity === 'fast_food') {
    return 'gastro';
  }

  // Public 24/7 indicators
  if (tags.opening_hours === '24/7') return 'public_24h';
  if (tags.access === 'yes' || tags.access === 'public') return 'public_24h';
  if (tags.eurokey === 'yes' || tags.centralkey === 'yes') return 'public_24h';
  if (/öffentliche|public|city.?toilette|city.?wc|ct/ .test(name)) return 'public_24h';

  // If it's a designated toilet amenity
  if (tags.amenity === 'toilets') {
    if (tags.wheelchair === 'yes' || tags['toilets:wheelchair'] === 'yes') {
      return 'public_24h';
    }
    return 'other';
  }

  return 'other';
}

async function fetchToilets(bbox: string, label: string): Promise<ToiletEntry[]> {
  // Enhanced query - gets wheelchair accessible + limited + public facilities
  const query = `
    [out:json][timeout:120];
    (
      // Full wheelchair access
      node["amenity"="toilets"]["wheelchair"="yes"](${bbox});
      node["amenity"="toilets"]["toilets:wheelchair"="yes"](${bbox});

      // Limited wheelchair access (usable with assistance)
      node["amenity"="toilets"]["wheelchair"="limited"](${bbox});
      node["amenity"="toilets"]["toilets:wheelchair"="limited"](${bbox});

      // Public toilets without explicit wheelchair tag (may still be accessible)
      node["amenity"="toilets"]["access"="public"](${bbox});
      node["amenity"="toilets"]["access"="yes"](${bbox});

      // Eurokey/Centralkey toilets
      node["amenity"="toilets"]["eurokey"="yes"](${bbox});
      node["amenity"="toilets"]["centralkey"="yes"](${bbox});

      // Fuel stations (usually have accessible toilets)
      node["amenity"="fuel"](${bbox});

      // Shopping centers/malls
      node["shop"="mall"](${bbox});
      node["shop"="shopping_centre"](${bbox});

      // Tourist facilities
      node["tourism"="information"]["information"="office"](${bbox});
      node["tourism"="museum"](${bbox});
      node["tourism"="hotel"](${bbox});
      node["tourism"="guest_house"](${bbox});
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

        // Skip if clearly not a toilet and not a likely toilet location
        const isToilet = tags.amenity === 'toilets';
        const hasToiletTag = tags.toilets === 'yes' || tags['toilets:wheelchair'];
        const isLikelyToiletLocation =
          tags.amenity === 'fuel' ||
          tags.amenity === 'restaurant' ||
          tags.amenity === 'cafe' ||
          tags.amenity === 'fast_food' ||
          tags.shop === 'mall' ||
          tags.tourism === 'hotel' ||
          tags.tourism === 'museum';

        if (!isToilet && !hasToiletTag && !isLikelyToiletLocation) {
          continue;
        }

        const entryTags: string[] = [];

        if (tags.eurokey === 'yes' || tags.centralkey === 'yes') entryTags.push('eurokey');
        if (tags.fee === 'no') entryTags.push('kostenlos');
        if (tags.wheelchair === 'yes' || tags['toilets:wheelchair'] === 'yes') {
          entryTags.push('barrierefrei');
        }
        if (tags.wheelchair === 'limited' || tags['toilets:wheelchair'] === 'limited') {
          entryTags.push('bedingt_barrierefrei');
        }

        // Generate a reasonable name
        let name = tags.name;
        if (!name) {
          if (tags.amenity === 'fuel') name = 'Tankstelle';
          else if (tags.amenity === 'restaurant') name = 'Restaurant';
          else if (tags.amenity === 'cafe') name = 'Café';
          else if (tags.amenity === 'fast_food') name = 'Fast Food';
          else if (tags.shop === 'mall') name = 'Einkaufszentrum';
          else if (tags.tourism === 'museum') name = 'Museum';
          else if (tags.tourism === 'hotel') name = 'Hotel';
          else name = 'Toilette';
        }

        results.push({
          id: `osm_${el.id}`,
          lat: el.lat,
          lon: el.lon,
          name,
          city: tags['addr:city'] || '',
          category: classifyFromOsm(tags),
          tags: entryTags,
          opening_hours: tags.opening_hours,
          operator: tags.operator,
          fee: tags.fee,
          wheelchair: tags.wheelchair || tags['toilets:wheelchair'],
        });
      }

      console.log(`    ${results.length} locations`);
      return results;
    } catch {
      console.warn(`    fetch failed, trying next...`);
    }
  }

  console.warn(`  ${label}: all endpoints failed`);
  return [];
}

async function main() {
  console.log('Fetching enhanced OSM data (more sources)...\n');

  // DACH region split into latitude bands
  const bands = [
    { label: 'South (45-48)', bbox: '45.0,5.5,48.0,17.5' },
    { label: 'Mid-South (48-50)', bbox: '48.0,5.5,50.0,17.5' },
    { label: 'Mid-North (50-52)', bbox: '50.0,5.5,52.0,17.5' },
    { label: 'North (52-55.5)', bbox: '52.0,5.5,55.5,17.5' },
  ];

  const all: ToiletEntry[] = [];

  for (const { label, bbox } of bands) {
    const results = await fetchToilets(bbox, label);
    all.push(...results);
    await sleep(5000);
  }

  // Deduplicate by OSM ID
  const unique = new Map<string, ToiletEntry>();
  for (const t of all) unique.set(t.id, t);

  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'OpenStreetMap Overpass API (enhanced)',
    count: unique.size,
    toilets: [...unique.values()],
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'osm-enhanced.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Stats
  const cats = { public_24h: 0, station: 0, gastro: 0, other: 0 };
  for (const t of unique.values()) cats[t.category]++;

  const wheelchairStats = { yes: 0, limited: 0, no: 0, unknown: 0 };
  for (const t of unique.values()) {
    if (t.wheelchair === 'yes') wheelchairStats.yes++;
    else if (t.wheelchair === 'limited') wheelchairStats.limited++;
    else if (t.wheelchair === 'no') wheelchairStats.no++;
    else wheelchairStats.unknown++;
  }

  console.log(`\n--- Results ---`);
  console.log(`Total unique: ${unique.size}`);
  console.log(`\nBy category:`);
  console.log(`  public_24h: ${cats.public_24h}`);
  console.log(`  station: ${cats.station}`);
  console.log(`  gastro: ${cats.gastro}`);
  console.log(`  other: ${cats.other}`);
  console.log(`\nWheelchair access:`);
  console.log(`  yes: ${wheelchairStats.yes}`);
  console.log(`  limited: ${wheelchairStats.limited}`);
  console.log(`  no: ${wheelchairStats.no}`);
  console.log(`  unknown: ${wheelchairStats.unknown}`);

  // City checks
  const cities = [
    { name: 'Hannover', lat: 52.3759, lon: 9.732, radius: 0.15 },
    { name: 'Dortmund', lat: 51.5136, lon: 7.4653, radius: 0.15 },
    { name: 'Berlin', lat: 52.52, lon: 13.405, radius: 0.2 },
    { name: 'München', lat: 48.1351, lon: 11.582, radius: 0.2 },
  ];

  console.log(`\nBy city:`);
  for (const city of cities) {
    const count = [...unique.values()].filter(
      (t) =>
        t.lat > city.lat - city.radius &&
        t.lat < city.lat + city.radius &&
        t.lon > city.lon - city.radius &&
        t.lon < city.lon + city.radius
    ).length;
    console.log(`  ${city.name}: ${count}`);
  }

  console.log(`\nSaved to: ${outPath}`);
}

main().catch(console.error);
