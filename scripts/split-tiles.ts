/**
 * Splits toilets.json into 1°x1° geo-grid tiles.
 * Each tile file is named by its grid coordinates: tile_52_9.json (lat 52-53, lon 9-10)
 *
 * Also generates an index file listing all tiles and their bounding boxes.
 *
 * Usage: npx tsx scripts/split-tiles.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, '..', 'src', 'data');
const tilesDir = path.join(dataDir, 'tiles');

function writeJson(file: string, text: string) {
  const temporary = file + '.tmp';
  fs.writeFileSync(temporary, text);
  // Windows scanners/watchers can briefly hold a generated tile open.
  for (let attempt = 0; ; attempt++) {
    try { fs.renameSync(temporary, file); return; }
    catch (error) {
      if (attempt >= 4 || !['EPERM', 'EACCES', 'EBUSY', 'UNKNOWN'].includes((error as NodeJS.ErrnoException).code || '')) throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 100);
    }
  }
}

const data = JSON.parse(fs.readFileSync(path.join(dataDir, 'toilets.json'), 'utf-8'));

// Group toilets by 1° grid cell
const tiles: Record<string, any[]> = {};

for (const toilet of data.toilets) {
  const latKey = Math.floor(toilet.lat);
  const lonKey = Math.floor(toilet.lon);
  const key = `${latKey}_${lonKey}`;
  if (!tiles[key]) tiles[key] = [];
  tiles[key].push(toilet);
}

// Create tiles directory
fs.mkdirSync(tilesDir, { recursive: true });

// Write each tile
const index: { key: string; latMin: number; latMax: number; lonMin: number; lonMax: number; count: number }[] = [];

for (const [key, toilets] of Object.entries(tiles)) {
  const [latStr, lonStr] = key.split('_');
  const latMin = parseInt(latStr);
  const lonMin = parseInt(lonStr);

  writeJson(
    path.join(tilesDir, `tile_${key}.json`),
    JSON.stringify(toilets)
  );

  index.push({
    key,
    latMin,
    latMax: latMin + 1,
    lonMin,
    lonMax: lonMin + 1,
    count: toilets.length,
  });
}

// Write index
writeJson(
  path.join(dataDir, 'tile-index.json'),
  JSON.stringify({
    generated: data.generated,
    source: data.source,
    ...(data.osmUpdate ? { osmUpdate: data.osmUpdate } : {}),
    ...(data.municipalUpdate ? { municipalUpdate: data.municipalUpdate } : {}),
    ...(data.partnerUpdates ? { partnerUpdates: data.partnerUpdates } : {}),
    ...(data.regionalUpdates ? { regionalUpdates: data.regionalUpdates } : {}),
    ...(data.specialistUpdate ? { specialistUpdate: data.specialistUpdate } : {}),
    totalCount: data.count,
    tileCount: index.length,
    tiles: index.sort((a, b) => a.key.localeCompare(b.key)),
  }, null, 2)
);

console.log(`Split ${data.count} toilets into ${index.length} tiles`);
for (const tile of index.sort((a, b) => b.count - a.count).slice(0, 10)) {
  console.log(`  tile_${tile.key}: ${tile.count} toilets`);
}
