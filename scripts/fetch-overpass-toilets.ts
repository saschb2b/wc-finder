/** Fetch a complete DACH snapshot, including accessible WCs inside venues. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { osmToilet } from './lib/osm-toilets';
import { fetchOsmRegion, splitBbox } from './lib/osm-regions';
import type { Toilet } from '../src/types/toilet';

async function main() {
  const bands = [
    { label: 'South (45-48)', bbox: '45.0,5.5,48.0,17.5' },
    { label: 'Mid-South (48-50)', bbox: '48.0,5.5,50.0,17.5' },
    { label: 'Mid-North (50-52)', bbox: '50.0,5.5,52.0,17.5' },
    { label: 'North (52-55.5)', bbox: '52.0,5.5,55.5,17.5' },
  ];
  const unique = new Map<string, Toilet>();
  const sourceTimestamps: Record<string, string> = {};
  const retrievedAt = new Date().toISOString();
  let queried = 0;
  const cacheDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.expo/data-cache/osm');
  for (const { label, bbox } of bands) {
    console.log('Fetching ' + label);
    const stamps: string[] = [];
    let bandCount = 0;
    for (const part of splitBbox(bbox)) {
      console.log('  ' + part);
      const response = await fetchOsmRegion(part, cacheDir);
      stamps.push(response.osm3s.timestamp_osm_base);
      queried += response.elements.length;
      bandCount += response.elements.length;
      for (const el of response.elements) {
        const toilet = osmToilet(el, retrievedAt, response.osm3s.timestamp_osm_base);
        if (toilet) unique.set(toilet.id, toilet);
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    assert(bandCount > 0, 'Empty OSM band: ' + label);
    sourceTimestamps[label] = stamps.sort()[0];
    console.log(unique.size + ' eligible unique toilets so far');
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  const output = { generated: retrievedAt.slice(0, 10), source: 'OpenStreetMap Overpass API (direct)',
    sourceTimestamps, queried, count: unique.size, toilets: [...unique.values()].sort((a, b) => a.id.localeCompare(b.id)) };
  const outPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/osm-toilets.json');
  fs.writeFileSync(outPath + '.tmp', JSON.stringify(output, null, 2));
  fs.renameSync(outPath + '.tmp', outPath);
  console.log('Complete snapshot: ' + unique.size + ' toilets');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
