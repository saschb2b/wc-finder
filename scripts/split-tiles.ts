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

  fs.writeFileSync(
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
fs.writeFileSync(
  path.join(dataDir, 'tile-index.json'),
  JSON.stringify({
    generated: data.generated,
    source: data.source,
    totalCount: data.count,
    tileCount: index.length,
    tiles: index.sort((a, b) => a.key.localeCompare(b.key)),
  }, null, 2)
);

console.log(`Split ${data.count} toilets into ${index.length} tiles`);
for (const tile of index.sort((a, b) => b.count - a.count).slice(0, 10)) {
  console.log(`  tile_${tile.key}: ${tile.count} toilets`);
}
