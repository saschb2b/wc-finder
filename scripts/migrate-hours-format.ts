/**
 * Migration script: Convert all opening hours to standardized format
 *
 * Usage: npx tsx scripts/migrate-hours-format.ts
 *
 * This script:
 * 1. Reads all toilets from toilets.json
 * 2. Normalizes opening_hours to the new standardized format
 * 3. Saves back to toilets.json
 * 4. Regenerates tiles
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeOpeningHours } from '../src/utils/normalize-hours.js';
import { StandardizedHours } from '../src/types/opening-hours.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Toilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  opening_hours?: string;
  hours?: StandardizedHours; // New field
  [key: string]: any;
}

async function main() {
  console.log('🔄 Migrating opening hours to standardized format\n');

  const toiletsPath = path.join(__dirname, '..', 'src', 'data', 'toilets.json');
  const data = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
  const toilets: Toilet[] = data.toilets || [];

  console.log(`Total toilets: ${toilets.length}`);

  let migrated = 0;
  let alreadyMigrated = 0;
  let failed = 0;
  const failures: Array<{ id: string; name: string; hours: string; error: string }> = [];

  for (const toilet of toilets) {
    // Skip if already has new format
    if (toilet.hours) {
      alreadyMigrated++;
      continue;
    }

    if (!toilet.opening_hours) {
      // No hours to migrate
      toilet.hours = { type: 'unknown' };
      continue;
    }

    try {
      const normalized = normalizeOpeningHours(toilet.opening_hours);
      toilet.hours = normalized;
      migrated++;

      if (migrated % 1000 === 0) {
        console.log(`  Processed ${migrated}...`);
      }
    } catch (err) {
      failed++;
      failures.push({
        id: toilet.id,
        name: toilet.name,
        hours: toilet.opening_hours,
        error: String(err),
      });
      // Set as unknown
      toilet.hours = { type: 'unknown', original: toilet.opening_hours };
    }
  }

  // Save updated data
  fs.writeFileSync(toiletsPath, JSON.stringify(data, null, 2));

  console.log(`\n✅ Migration complete!`);
  console.log(`  Migrated: ${migrated}`);
  console.log(`  Already migrated: ${alreadyMigrated}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Total with hours: ${migrated + alreadyMigrated}`);

  if (failures.length > 0) {
    console.log(`\n⚠️  Sample failures:`);
    failures.slice(0, 5).forEach(f => {
      console.log(`  - ${f.name}: "${f.hours}" (${f.error})`);
    });
  }

  // Show statistics
  const with24_7 = toilets.filter(t => t.hours?.type === '24_7').length;
  const withWeekly = toilets.filter(t => t.hours?.type === 'weekly').length;
  const withUnknown = toilets.filter(t => t.hours?.type === 'unknown').length;

  console.log(`\n📊 New format distribution:`);
  console.log(`  24/7: ${with24_7}`);
  console.log(`  Weekly: ${withWeekly}`);
  console.log(`  Unknown: ${withUnknown}`);

  console.log(`\n📋 Next steps:`);
  console.log(`   npx tsx scripts/split-tiles.ts`);
  console.log(`   npx tsx scripts/gen-tile-loader.ts`);
}

main().catch(console.error);
