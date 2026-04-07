/**
 * Enriches existing OSM/toilettenhero toilets with Google Places data.
 * Only queries places that are MISSING opening hours to save API calls.
 *
 * Usage: npx tsx scripts/enrich-existing-with-google.ts
 * Cost: ~$0.017 per place found with hours
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);
  if (match) process.env.GOOGLE_PLACES_API_KEY = match[1].trim();
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY not found');
  process.exit(1);
}

interface Toilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  opening_hours?: string;
  tags?: string[];
}

interface GooglePlace {
  id: string;
  displayName: { text: string };
  location: { latitude: number; longitude: number };
  regularOpeningHours?: {
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
  };
  restroom?: boolean;
  accessibilityOptions?: {
    wheelchairAccessibleRestroom?: boolean;
  };
}

// Find toilets without opening hours
async function findToiletsNeedingHours(): Promise<Toilet[]> {
  const toiletsPath = path.join(__dirname, '..', 'src', 'data', 'toilets.json');
  const data = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
  const allToilets: Toilet[] = data.toilets || [];

  // Filter: no opening_hours AND not from Google Places (avoid re-querying)
  const needHours = allToilets.filter(t =>
    !t.opening_hours &&
    !t.id.startsWith('gplace_') &&
    !t.id.startsWith('hbiz_') // Skip our manual business entries too
  );

  console.log(`Total toilets: ${allToilets.length}`);
  console.log(`Missing hours: ${needHours.length}`);

  // Prioritize: public_24h and station categories first (higher value)
  // Then sort by location density (process city centers first)
  return needHours.slice(0, 2000); // Limit to 2000 to control costs (~$34)
}

async function searchGooglePlaces(lat: number, lon: number): Promise<GooglePlace[]> {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchNearby`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.regularOpeningHours,places.restroom,places.accessibilityOptions',
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lon },
              radius: 50, // Very tight radius to find exact match
            },
          },
          maxResultCount: 5,
        }),
      },
    );

    if (!response.ok) return [];
    const data = await response.json();
    return data.places || [];
  } catch {
    return [];
  }
}

function convertToOsmHours(place: GooglePlace): string | undefined {
  const hours = place.regularOpeningHours;
  if (!hours?.periods || hours.periods.length === 0) return undefined;

  const dayMap = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
  const byDay: Record<number, Array<{ open: string; close?: string }>> = {};

  for (const period of hours.periods) {
    const day = period.open.day;
    if (!byDay[day]) byDay[day] = [];

    const openTime = `${String(period.open.hour).padStart(2, '0')}:${String(period.open.minute).padStart(2, '0')}`;
    const closeTime = period.close
      ? `${String(period.close.hour).padStart(2, '0')}:${String(period.close.minute).padStart(2, '0')}`
      : undefined;

    byDay[day].push({ open: openTime, close: closeTime });
  }

  const parts: string[] = [];
  for (let day = 0; day < 7; day++) {
    const dayPeriods = byDay[day];
    if (!dayPeriods || dayPeriods.length === 0) continue;

    const timeRanges = dayPeriods
      .map((p) => (p.close ? `${p.open}-${p.close}` : `${p.open}+`))
      .join(',');

    parts.push(`${dayMap[day]} ${timeRanges}`);
  }

  return parts.length > 0 ? parts.join('; ') : undefined;
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  console.log('🚽 Enriching existing toilets with Google Places data\n');

  const toiletsToEnrich = await findToiletsNeedingHours();

  if (toiletsToEnrich.length === 0) {
    console.log('✅ No toilets need enrichment!');
    return;
  }

  console.log(`Will attempt to enrich: ${toiletsToEnrich.length} toilets`);
  console.log(`Estimated max cost: $${(toiletsToEnrich.length * 0.017).toFixed(2)}\n`);

  // Load main dataset
  const toiletsPath = path.join(__dirname, '..', 'src', 'data', 'toilets.json');
  const data = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
  const allToilets: Toilet[] = data.toilets;

  let enriched = 0;
  let failed = 0;
  let apiCalls = 0;

  for (let i = 0; i < toiletsToEnrich.length; i++) {
    const toilet = toiletsToEnrich[i];

    process.stdout.write(`[${i + 1}/${toiletsToEnrich.length}] ${toilet.name.substring(0, 40)} ... `);

    const places = await searchGooglePlaces(toilet.lat, toilet.lon);
    apiCalls++;

    if (places.length === 0) {
      process.stdout.write(`✗ no nearby places\n`);
      failed++;
      continue;
    }

    // Find best match by name similarity and distance
    let bestMatch: GooglePlace | null = null;
    let bestScore = 0;

    for (const place of places) {
      const dist = getDistanceMeters(toilet.lat, toilet.lon, place.location.latitude, place.location.longitude);
      if (dist > 30) continue; // Must be within 30m

      // Simple name similarity (could be improved)
      const toiletName = toilet.name.toLowerCase();
      const placeName = place.displayName.text.toLowerCase();
      const nameMatch = toiletName.includes(placeName) || placeName.includes(toiletName);

      const score = nameMatch ? 2 : 1;
      if (score > bestScore) {
        bestScore = score;
        bestMatch = place;
      }
    }

    if (bestMatch) {
      const hours = convertToOsmHours(bestMatch);

      // Find and update the toilet in main dataset
      const idx = allToilets.findIndex(t => t.id === toilet.id);
      if (idx >= 0) {
        let updates: string[] = [];

        if (hours && !allToilets[idx].opening_hours) {
          allToilets[idx].opening_hours = hours;
          updates.push('hours');
        }

        if (bestMatch.accessibilityOptions?.wheelchairAccessibleRestroom && !allToilets[idx].tags?.includes('google_wc_accessible')) {
          allToilets[idx].tags = allToilets[idx].tags || [];
          allToilets[idx].tags.push('google_wc_accessible');
          updates.push('accessible');
        }

        if (updates.length > 0) {
          enriched++;
          process.stdout.write(`✓ ${updates.join(', ')}\n`);
        } else {
          process.stdout.write(`✓ (no new data)\n`);
        }
      }
    } else {
      process.stdout.write(`✗ no match\n`);
      failed++;
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 100));

    // Save progress every 100
    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(toiletsPath, JSON.stringify(data, null, 2));
      console.log(`  💾 Saved progress (${i + 1}/${toiletsToEnrich.length}, enriched: ${enriched})\n`);
    }
  }

  // Final save
  fs.writeFileSync(toiletsPath, JSON.stringify(data, null, 2));

  console.log('\n✅ Done!');
  console.log(`  API calls made: ${apiCalls}`);
  console.log(`  Toilets enriched: ${enriched}`);
  console.log(`  Failed: ${failed}`);
  console.log(`  Cost: ~$${(apiCalls * 0.017).toFixed(2)}`);
  console.log(`\n💾 Updated: ${toiletsPath}`);
  console.log('\n📋 Next steps:');
  console.log('   npx tsx scripts/split-tiles.ts');
  console.log('   npx tsx scripts/gen-tile-loader.ts');
}

main().catch(console.error);
