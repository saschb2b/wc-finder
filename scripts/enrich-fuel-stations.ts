/**
 * Enriches OSM fuel stations with Google Places opening hours.
 *
 * Fuel stations are important public toilets and usually have consistent hours.
 * This script queries Google Places near each fuel station location to find
 * matching places with opening hours.
 *
 * Usage: npx tsx scripts/enrich-fuel-stations.ts
 * Cost: ~$0.017 per API call (max ~$79 for 4,645 stations)
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
  address?: string;
  gplace_id?: string;
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
  types?: string[];
}

function getDistanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function searchNearby(lat: number, lon: number): Promise<GooglePlace[]> {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchNearby`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': GOOGLE_PLACES_API_KEY,
          'X-Goog-FieldMask': 'places.id,places.displayName,places.location,places.regularOpeningHours,places.types',
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lon },
              radius: 100, // 100m radius for gas stations
            },
          },
          includedTypes: ['gas_station'],
          maxResultCount: 3,
        }),
      },
    );

    if (!response.ok) {
      const text = await response.text();
      console.error(`API error: ${text}`);
      return [];
    }

    const data = await response.json();
    return data.places || [];
  } catch (err) {
    console.error(`Error: ${err}`);
    return [];
  }
}

function convertToOsmHours(place: GooglePlace): string | undefined {
  const hours = place.regularOpeningHours;
  if (!hours?.periods || hours.periods.length === 0) return undefined;

  // Check if 24/7 (open all day every day)
  const is24_7 = hours.periods.every((p: any) =>
    p.open.day === 0 && p.open.hour === 0 && p.open.minute === 0 &&
    p.close?.day === 0 && p.close?.hour === 23 && p.close?.minute === 59
  );
  if (is24_7) return '24/7';

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

async function main() {
  console.log('⛽ Enriching fuel stations with Google Places hours\n');

  const toiletsPath = path.join(__dirname, '..', 'src', 'data', 'toilets.json');
  const data = JSON.parse(fs.readFileSync(toiletsPath, 'utf-8'));
  const allToilets: Toilet[] = data.toilets;

  // Find fuel stations without hours and not already linked to Google
  const fuelStations = allToilets.filter(t =>
    t.id.startsWith('fuel_') &&
    !t.opening_hours &&
    !t.gplace_id // Don't re-query if we already tried
  );

  console.log(`Fuel stations to enrich: ${fuelStations.length}`);
  console.log(`Estimated cost: $${(fuelStations.length * 0.017).toFixed(2)}`);
  console.log(`Progress will be saved every 100 stations\n`);

  let enriched = 0;
  let notFound = 0;
  let noHours = 0;
  let apiCalls = 0;

  for (let i = 0; i < fuelStations.length; i++) {
    const station = fuelStations[i];

    process.stdout.write(`[${i + 1}/${fuelStations.length}] ${station.name.substring(0, 35).padEnd(35)} ... `);

    const places = await searchNearby(station.lat, station.lon);
    apiCalls++;

    if (places.length === 0) {
      process.stdout.write(`✗ no gas station found\n`);
      notFound++;

      // Mark as attempted
      const idx = allToilets.findIndex(t => t.id === station.id);
      if (idx >= 0) allToilets[idx].gplace_id = 'not_found';
      continue;
    }

    // Find closest match
    let bestMatch: GooglePlace | null = null;
    let bestDistance = Infinity;

    for (const place of places) {
      const dist = getDistanceMeters(
        station.lat, station.lon,
        place.location.latitude, place.location.longitude
      );
      if (dist < bestDistance) {
        bestDistance = dist;
        bestMatch = place;
      }
    }

    if (!bestMatch) {
      process.stdout.write(`✗ match error\n`);
      notFound++;
      continue;
    }

    const hours = convertToOsmHours(bestMatch);

    if (!hours) {
      process.stdout.write(`✓ found but no hours (${Math.round(bestDistance)}m)\n`);
      noHours++;

      // Mark as attempted
      const idx = allToilets.findIndex(t => t.id === station.id);
      if (idx >= 0) allToilets[idx].gplace_id = bestMatch.id;
      continue;
    }

    // Update the station
    const idx = allToilets.findIndex(t => t.id === station.id);
    if (idx >= 0) {
      allToilets[idx].opening_hours = hours;
      allToilets[idx].gplace_id = bestMatch.id;
      enriched++;

      const hoursPreview = hours.length > 20 ? hours.substring(0, 20) + '...' : hours;
      process.stdout.write(`✓ ${hoursPreview} (${Math.round(bestDistance)}m)\n`);
    }

    // Rate limiting
    await new Promise(r => setTimeout(r, 100));

    // Save progress every 100
    if ((i + 1) % 100 === 0) {
      fs.writeFileSync(toiletsPath, JSON.stringify(data, null, 2));
      console.log(`\n  💾 Saved progress: ${i + 1}/${fuelStations.length}`);
      console.log(`     Enriched: ${enriched} | Not found: ${notFound} | No hours: ${noHours}`);
      console.log(`     Cost so far: $${(apiCalls * 0.017).toFixed(2)}\n`);
    }
  }

  // Final save
  fs.writeFileSync(toiletsPath, JSON.stringify(data, null, 2));

  console.log('\n✅ Done!');
  console.log(`  API calls: ${apiCalls}`);
  console.log(`  Enriched: ${enriched}`);
  console.log(`  Not found: ${notFound}`);
  console.log(`  Found but no hours: ${noHours}`);
  console.log(`  Total cost: $${(apiCalls * 0.017).toFixed(2)}`);

  const newCoverage = ((allToilets.filter(t => t.opening_hours).length / allToilets.length) * 100).toFixed(1);
  console.log(`\n📊 New coverage: ${newCoverage}%`);

  console.log('\n📋 Next steps:');
  console.log('   npx tsx scripts/split-tiles.ts');
  console.log('   npx tsx scripts/gen-tile-loader.ts');
}

main().catch(console.error);
