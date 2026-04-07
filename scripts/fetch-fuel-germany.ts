/**
 * Fetch fuel stations for Germany
 * Simple, reliable query
 *
 * Usage: npx tsx scripts/fetch-fuel-germany.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';

async function main() {
  console.log('Fetching fuel stations in Germany...\n');

  // Query ALL fuel stations in Germany
  const query = `
    [out:json][timeout:120];
    area["name"="Deutschland"]["admin_level"=2]->.searchArea;
    node["amenity"="fuel"](area.searchArea);
    out body;
  `;

  try {
    console.log('Querying Overpass API...');
    const res = await fetch(OVERPASS_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `data=${encodeURIComponent(query)}`,
    });

    if (!res.ok) {
      console.error(`HTTP ${res.status}`);
      process.exit(1);
    }

    const data = await res.json();
    console.log(`Found ${data.elements.length} fuel stations`);

    const results = data.elements.map((el: any) => {
      const tags = el.tags || {};
      return {
        id: `fuel_${el.id}`,
        lat: el.lat,
        lon: el.lon,
        name: tags.name || tags.brand || 'Tankstelle',
        city: tags['addr:city'] || '',
        category: 'other',
        tags: [],
        opening_hours: tags.opening_hours,
        operator: tags.operator || tags.brand,
      };
    });

    const output = {
      generated: new Date().toISOString().split('T')[0],
      source: 'OpenStreetMap - Fuel Stations',
      count: results.length,
      toilets: results,
    };

    const outPath = path.join(__dirname, '..', 'src', 'data', 'osm-fuel.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`\nSaved ${results.length} fuel stations to ${outPath}`);

    // Sample
    console.log('\nSample entries:');
    results.slice(0, 3).forEach((r: any) => {
      console.log(`  - ${r.name} (${r.lat.toFixed(4)}, ${r.lon.toFixed(4)})`);
    });

  } catch (err) {
    console.error('Fetch failed:', err);
    process.exit(1);
  }
}

main();
