/**
 * Fetch shopping centers/malls for Germany
 *
 * Usage: npx tsx scripts/fetch-shopping-germany.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const OVERPASS_URL = 'https://overpass.kumi.systems/api/interpreter';

async function main() {
  console.log('Fetching shopping centers in Germany...\n');

  const query = `
    [out:json][timeout:120];
    area["name"="Deutschland"]["admin_level"=2]->.searchArea;
    (
      node["shop"="mall"](area.searchArea);
      way["shop"="mall"](area.searchArea);
      node["shop"="shopping_centre"](area.searchArea);
      way["shop"="shopping_centre"](area.searchArea);
    );
    out body center;
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
    console.log(`Found ${data.elements.length} shopping centers`);

    const results = data.elements.map((el: any) => {
      const tags = el.tags || {};
      // For ways, use the center point
      const lat = el.lat || el.center?.lat;
      const lon = el.lon || el.center?.lon;

      if (!lat || !lon) return null;

      return {
        id: `mall_${el.id}`,
        lat,
        lon,
        name: tags.name || 'Einkaufszentrum',
        city: tags['addr:city'] || '',
        category: 'other',
        tags: [],
        opening_hours: tags.opening_hours,
      };
    }).filter(Boolean);

    const output = {
      generated: new Date().toISOString().split('T')[0],
      source: 'OpenStreetMap - Shopping Centers',
      count: results.length,
      toilets: results,
    };

    const outPath = path.join(__dirname, '..', 'src', 'data', 'osm-shopping.json');
    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

    console.log(`\nSaved ${results.length} shopping centers to ${outPath}`);

  } catch (err) {
    console.error('Fetch failed:', err);
    process.exit(1);
  }
}

main();
