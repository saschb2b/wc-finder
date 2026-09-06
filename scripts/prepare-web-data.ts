import fs from 'node:fs';
import path from 'node:path';

const index = JSON.parse(fs.readFileSync('src/data/tile-index.json', 'utf8'));
fs.mkdirSync('public/data/tiles', { recursive: true });
for (const { key } of index.tiles) {
  const name = `tile_${key}.json`;
  fs.copyFileSync(path.join('src/data/tiles', name), path.join('public/data/tiles', name));
}
console.log(`Prepared ${index.tiles.length} regional files for the browser.`);
