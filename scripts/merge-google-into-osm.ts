/**
 * Merges Google Places data into existing OSM/toilettenhero entries.
 *
 * Finds OSM toilets without hours that have a nearby Google Place match,
 * and copies the hours, restroom info, and accessibility data.
 *
 * This is free (no API calls) since we already have google-places.json!
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface Toilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  opening_hours?: string;
  tags?: string[];
  category?: string;
}

interface GooglePlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  opening_hours?: string;
  tags?: string[];
  original_data?: any;
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/toilette|wc|restroom|bathroom/g, '');
}

async function main() {
  console.log('🔗 Merging Google Places data into existing OSM toilets\n');

  // Load datasets
  const toiletsPath = path.join(__dirname, '..', 'src', 'data', 'toilets.json');
  const googlePath = path.join(__dirname, '..', 'src', 'data', 'google-places.json');

  const data = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
  const allToilets: Toilet[] = data.toilets || [];

  const googleData = JSON.parse(fs.readFileSync(googlePath, 'utf-8'));
  const googlePlaces: GooglePlace[] = googleData.toilets || [];

  console.log(`Main dataset: ${allToilets.length} toilets`);
  console.log(`Google Places: ${googlePlaces.length} places\n`);

  // Find OSM/toilettenhero toilets without hours
  const osmWithoutHours = allToilets.filter(t =>
    !t.opening_hours &&
    (t.id.startsWith('osm_') || t.id.startsWith('th_'))
  );

  console.log(`OSM/toilettenhero without hours: ${osmWithoutHours.length}\n`);

  let enriched = 0;
  let withAccessibility = 0;
  const mergedIds: string[] = [];

  for (const osmToilet of osmWithoutHours) {
    // Find nearby Google Places with hours
    let bestMatch: GooglePlace | null = null;
    let bestDistance = Infinity;

    for (const gPlace of googlePlaces) {
      if (!gPlace.opening_hours) continue;

      const dist = getDistanceMeters(
        osmToilet.lat, osmToilet.lon,
        gPlace.lat, gPlace.lon
      );

      // Must be very close (< 30m) and closer than current best
      if (dist < 30 && dist < bestDistance) {
        bestDistance = dist;
        bestMatch = gPlace;
      }
    }

    if (bestMatch) {
      // Enrich the OSM toilet
      const idx = allToilets.findIndex(t => t.id === osmToilet.id);
      if (idx >= 0) {
        allToilets[idx].opening_hours = bestMatch.opening_hours;

        // Merge accessibility tags
        if (bestMatch.tags?.includes('wheelchair')) {
          allToilets[idx].tags = allToilets[idx].tags || [];
          if (!allToilets[idx].tags?.includes('wheelchair')) {
            allToilets[idx].tags?.push('wheelchair');
          }
          withAccessibility++;
        }

        enriched++;
        mergedIds.push(`${osmToilet.name} ← ${bestMatch.name} (${Math.round(bestDistance)}m)`);
      }
    }
  }

  // Save
  fs.writeFileSync(toiletsPath, JSON.stringify(data, null, 2));

  console.log(`✅ Enriched ${enriched} OSM toilets with Google Places hours`);
  console.log(`   With accessibility data: ${withAccessibility}`);
  console.log(`\n📊 New coverage:`);

  const newTotal = allToilets.filter(t => t.opening_hours).length;
  console.log(`   ${newTotal}/${allToilets.length} with hours (${(newTotal/allToilets.length*100).toFixed(1)}%)`);

  if (enriched > 0) {
    console.log(`\n📝 Sample merges:`);
    mergedIds.slice(0, 5).forEach(m => console.log(`   • ${m}`));
  }

  console.log(`\n💾 Saved: ${toiletsPath}`);
}

main().catch(console.error);
