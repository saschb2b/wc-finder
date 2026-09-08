import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

// Use the image tooling shipped with the project's pinned Expo installation.
const require = createRequire(import.meta.url);
const { getJimpImageAsync } = require('@expo/image-utils/build/jimp');
const root = fileURLToPath(new URL('../', import.meta.url));
const master = await getJimpImageAsync(`${root}assets/brand/icon-master.png`);
const png = 'image/png';

async function save(image, destination) {
  await fs.writeFile(`${root}${destination}`, await image.getBufferAsync(png));
}

// Platform exports only: retain the approved artwork, resize it, and apply the
// launcher corner mask. Antialias the mask at the 1024px source resolution.
const icon = master.clone().resize(1024, 1024);
await save(icon.clone().colorType(2), 'assets/icon.png');
await save(icon.clone().resize(48, 48).colorType(2), 'assets/favicon.png');
await save(icon.clone().resize(256, 256).colorType(2), 'assets/brand/app-icon.png');

const rounded = icon.clone();
const radius = 228;
for (let y = 0; y < 1024; y++) {
  for (let x = 0; x < 1024; x++) {
    const dx = Math.max(radius - x - 0.5, x + 0.5 - (1024 - radius), 0);
    const dy = Math.max(radius - y - 0.5, y + 0.5 - (1024 - radius), 0);
    const coverage = Math.max(0, Math.min(1, radius + 0.5 - Math.hypot(dx, dy)));
    rounded.bitmap.data[(y * 1024 + x) * 4 + 3] = Math.round(coverage * 255);
  }
}
// Genuine alpha lets the same artwork sit on either themed splash background.
await save(rounded, 'assets/splash-icon.png');
await save(rounded, 'assets/splash-icon-dark.png');

// Android masks vary. Keep the accessibility emblem well inside the central
// 66/108 safe circle; the decorative shell can extend into the masked area.
const adaptive = icon.clone();
adaptive.bitmap.data.fill(0);
adaptive.composite(rounded.clone().resize(640, 640), 192, 192);
await save(adaptive, 'assets/adaptive-icon.png');

await save(icon.clone().resize(512, 512).colorType(2), 'docs/icon.png');
await save(icon.clone().resize(192, 192).colorType(2), 'docs/icon-192.png');
await save(icon.clone().resize(48, 48).colorType(2), 'docs/favicon.png');
console.log('Exported app, adaptive, splash, in-app, and website brand assets.');
