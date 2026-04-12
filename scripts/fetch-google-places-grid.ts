/**
 * Fetches places from Google Places API in a grid pattern to cover a larger area.
 * Each API call returns up to 20 places within a radius.
 *
 * Usage: npx tsx scripts/fetch-google-places-grid.ts <lat> <lon> <radius_km> [grid_spacing_m]
 * Example: npx tsx scripts/fetch-google-places-grid.ts 52.375 9.82 10 800
 *
 * Grid spacing: Distance between search points (default 800m)
 * - Smaller = more overlap, more API calls, more complete coverage
 * - Larger = fewer API calls, may miss some places
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key from .env
const envPath = path.join(__dirname, '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  const match = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);
  if (match) {
    process.env.GOOGLE_PLACES_API_KEY = match[1].trim();
  }
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error('❌ GOOGLE_PLACES_API_KEY not found in .env file');
  process.exit(1);
}

type ToiletCategory = "public_24h" | "station" | "tankstelle" | "gastro" | "other";

interface ToiletEntry {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: ToiletCategory;
  tags: string[];
  opening_hours?: string;
  operator?: string;
  fee?: string;
}

interface GooglePlace {
  id: string;
  displayName: { text: string };
  location: { latitude: number; longitude: number };
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
  };
  restroom?: boolean;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
}

function generateGridPoints(
  centerLat: number,
  centerLon: number,
  radiusKm: number,
  spacingM: number,
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [];

  // Convert radius to degrees (approximate)
  const radiusDeg = radiusKm / 111; // 1 degree ≈ 111km
  const spacingDeg = spacingM / 111000; // meters to degrees

  const steps = Math.ceil(radiusKm * 1000 / spacingM);

  for (let x = -steps; x <= steps; x++) {
    for (let y = -steps; y <= steps; y++) {
      const lat = centerLat + y * spacingDeg;
      const lon = centerLon + x * spacingDeg;

      // Check if point is within radius
      const distKm = Math.sqrt(
        Math.pow((lat - centerLat) * 111, 2) +
        Math.pow((lon - centerLon) * 111 * Math.cos(centerLat * Math.PI / 180), 2)
      );

      if (distKm <= radiusKm) {
        points.push({ lat, lon });
      }
    }
  }

  return points;
}

async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radius: number,
): Promise<GooglePlace[]> {
  const response = await fetch(
    `https://places.googleapis.com/v1/places:searchNearby`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.location,places.accessibilityOptions,places.restroom,places.primaryType,places.types,places.businessStatus',
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: radius,
          },
        },
        includedTypes: [
          'restaurant',
          'cafe',
          'fast_food_restaurant',
          'gym',
          'shopping_mall',
          'department_store',
          'supermarket',
          'convenience_store',
          'gas_station',
          'bar',
          'bakery',
        ],
        maxResultCount: 20,
      }),
    },
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Places API error: ${error}`);
  }

  const data = await response.json();
  return data.places || [];
}

function convertToToilet(place: GooglePlace): ToiletEntry | null {
  const types = place.types || [];
  const primaryType = place.primaryType || '';

  if (place.restroom !== true) {
    return null;
  }

  let category: ToiletCategory = 'other';
  if (
    types.includes('restaurant') ||
    types.includes('cafe') ||
    types.includes('fast_food_restaurant') ||
    types.includes('bar') ||
    types.includes('bakery') ||
    primaryType.includes('restaurant') ||
    primaryType.includes('cafe') ||
    primaryType.includes('bakery')
  ) {
    category = 'gastro';
  } else if (
    types.includes('gas_station') ||
    primaryType.includes('gas_station')
  ) {
    category = 'tankstelle';
  }

  const tags: string[] = [];
  const hasAccessibleRestroom =
    place.accessibilityOptions?.wheelchairAccessibleRestroom === true;
  const hasAccessibleEntrance =
    place.accessibilityOptions?.wheelchairAccessibleEntrance === true;

  if (hasAccessibleRestroom) {
    tags.push('barrierefrei');
    tags.push('google_wc_accessible');
  } else if (hasAccessibleEntrance) {
    tags.push('barrierefrei');
    tags.push('google_entrance_accessible');
  } else {
    tags.push('google_has_restroom');
  }

  return {
    id: `gplace_${place.id}`,
    lat: place.location.latitude,
    lon: place.location.longitude,
    name: place.displayName?.text || 'Unnamed Location',
    city: '',
    category,
    tags,
  };
}

function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.log('Usage: npx tsx scripts/fetch-google-places-grid.ts <lat> <lon> <radius_km> [grid_spacing_m]');
    console.log('Example: npx tsx scripts/fetch-google-places-grid.ts 52.375 9.82 10 800');
    console.log('');
    console.log('Parameters:');
    console.log('  lat, lon     - Center coordinates');
    console.log('  radius_km    - Search radius in kilometers');
    console.log('  grid_spacing - Distance between search points (default: 800m)');
    console.log('');
    console.log('Cost estimate:');
    console.log('  5km radius with 800m spacing ≈ 50 API calls');
    console.log('  10km radius with 800m spacing ≈ 150 API calls');
    process.exit(1);
  }

  const centerLat = parseFloat(args[0]);
  const centerLon = parseFloat(args[1]);
  const radiusKm = parseFloat(args[2]);
  const spacingM = parseInt(args[3] || '800', 10);

  if (isNaN(centerLat) || isNaN(centerLon) || isNaN(radiusKm)) {
    console.error('Invalid coordinates or radius');
    process.exit(1);
  }

  console.log(`\n🚽 WC Finder - Google Places Grid Fetcher`);
  console.log(`==========================================\n`);
  console.log(`Center: ${centerLat}, ${centerLon}`);
  console.log(`Radius: ${radiusKm}km`);
  console.log(`Grid spacing: ${spacingM}m\n`);

  const gridPoints = generateGridPoints(centerLat, centerLon, radiusKm, spacingM);
  console.log(`Grid points to search: ${gridPoints.length}`);
  console.log(`Estimated cost: ${gridPoints.length} API calls\n`);

  if (gridPoints.length > 100) {
    console.log(`⚠️  Warning: This will use ${gridPoints.length} API calls.`);
    console.log(`   Free tier: 5,000/month = ~166/day`);
    console.log(`   Continue? (This is fine for occasional use)\n`);
  }

  const allToilets: ToiletEntry[] = [];
  let totalPlaces = 0;
  let apiCalls = 0;

  for (let i = 0; i < gridPoints.length; i++) {
    const point = gridPoints[i];
    process.stdout.write(`[${i + 1}/${gridPoints.length}] ${point.lat.toFixed(4)}, ${point.lon.toFixed(4)} ... `);

    try {
      const places = await fetchNearbyPlaces(point.lat, point.lon, spacingM * 0.7);
      apiCalls++;
      totalPlaces += places.length;

      for (const place of places) {
        const toilet = convertToToilet(place);
        if (toilet) {
          allToilets.push(toilet);
        }
      }

      process.stdout.write(`${places.length} places\n`);

      // Rate limiting - be nice to the API
      if (i < gridPoints.length - 1) {
        await new Promise(r => setTimeout(r, 100));
      }
    } catch (err) {
      process.stdout.write(`ERROR: ${err instanceof Error ? err.message : err}\n`);
    }
  }

  console.log(`\n✅ Completed ${apiCalls} API calls`);
  console.log(`Total places found: ${totalPlaces}`);
  console.log(`Places with restrooms: ${allToilets.length}`);

  // Deduplicate
  const unique: ToiletEntry[] = [];
  const DEDUP_RADIUS = 30;

  for (const t of allToilets) {
    const isDup = unique.some(
      u => getDistanceMeters(u.lat, u.lon, t.lat, t.lon) < DEDUP_RADIUS
    );
    if (!isDup) {
      unique.push(t);
    }
  }

  console.log(`Unique places: ${unique.length}`);
  console.log(`   - Wheelchair WC accessible: ${unique.filter(t => t.tags.includes('google_wc_accessible')).length}`);
  console.log(`   - Wheelchair entrance only: ${unique.filter(t => t.tags.includes('google_entrance_accessible')).length}`);
  console.log(`   - Has restroom (unknown): ${unique.filter(t => t.tags.includes('google_has_restroom')).length}`);

  // Show sample
  console.log('\nSample results:');
  unique.slice(0, 15).forEach(t => {
    const d = getDistanceMeters(centerLat, centerLon, t.lat, t.lon);
    const accessibility = t.tags.includes('google_wc_accessible')
      ? '♿ WC'
      : t.tags.includes('google_entrance_accessible')
        ? '♿ entrance'
        : '❓ unknown';
    console.log(`  ${Math.round(d)}m: ${t.name} (${accessibility})`);
  });
  if (unique.length > 15) {
    console.log(`  ... and ${unique.length - 15} more`);
  }

  // Load existing data
  const outPath = path.join(__dirname, '..', 'src', 'data', 'google-places.json');
  let existing: ToiletEntry[] = [];

  if (fs.existsSync(outPath)) {
    const data = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
    existing = data.toilets || [];
    console.log(`\n📁 Loaded ${existing.length} existing places`);
  }

  // Merge with existing
  const merged = [...existing];
  for (const t of unique) {
    const isDup = merged.some(
      e => getDistanceMeters(e.lat, e.lon, t.lat, t.lon) < DEDUP_RADIUS
    );
    if (!isDup) {
      merged.push(t);
    }
  }

  console.log(`\n📊 Final dataset: ${merged.length} total places`);
  console.log(`   (added ${merged.length - existing.length} new)`);

  // Save
  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: `Google Places API - grid search ${radiusKm}km around ${centerLat}, ${centerLon}`,
    count: merged.length,
    toilets: merged,
  };

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n💾 Saved to: ${outPath}`);

  console.log('\n📋 Next steps:');
  console.log('   npx tsx scripts/merge-sources.ts');
  console.log('   npx tsx scripts/split-tiles.ts');
  console.log('   npx tsx scripts/gen-tile-loader.ts');
}

main().catch(console.error);
