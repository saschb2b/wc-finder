/**
 * Fetches nearby places with restrooms from Google Places API.
 * Enriches the local dataset with businesses not in OpenStreetMap.
 *
 * Usage:
 *   1. Set GOOGLE_PLACES_API_KEY in .env file
 *   2. Run: npx tsx scripts/fetch-google-places.ts <lat> <lon> <radius_meters>
 *   Example: npx tsx scripts/fetch-google-places.ts 52.375 9.82 1000
 *
 * Cost: ~$0.017 per 1000 places (Places API New - Nearby Search)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key from .env
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);
  if (match) {
    process.env.GOOGLE_PLACES_API_KEY = match[1].trim();
  }
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error("❌ GOOGLE_PLACES_API_KEY not found in .env file");
  console.error("Create .env file with: GOOGLE_PLACES_API_KEY=your_key_here");
  process.exit(1);
}

type ToiletCategory = "public_24h" | "station" | "gastro" | "other";

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
  nationalPhoneNumber?: string;
  websiteUri?: string;
}

async function fetchNearbyPlaces(
  lat: number,
  lon: number,
  radius: number,
): Promise<GooglePlace[]> {
  console.log(`Fetching places within ${radius}m of ${lat}, ${lon}...`);

  const response = await fetch(
    `https://places.googleapis.com/v1/places:searchNearby`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.accessibilityOptions,places.restroom,places.primaryType,places.types,places.businessStatus",
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: {
            center: { latitude: lat, longitude: lon },
            radius: radius,
          },
        },
        includedTypes: [
          "restaurant",
          "cafe",
          "fast_food_restaurant",
          "gym",
          "shopping_mall",
          "department_store",
          "supermarket",
          "convenience_store",
          "gas_station",
          "bar",
          "bakery",
        ],
        maxResultCount: 20, // Max for Nearby Search (New)
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
  const primaryType = place.primaryType || "";

  // Only include places with restrooms
  if (place.restroom !== true) {
    return null;
  }

  // Determine category
  let category: ToiletCategory = "other";
  if (
    types.includes("restaurant") ||
    types.includes("cafe") ||
    types.includes("fast_food_restaurant") ||
    types.includes("bar") ||
    types.includes("bakery") ||
    primaryType.includes("restaurant") ||
    primaryType.includes("cafe") ||
    primaryType.includes("bakery")
  ) {
    category = "gastro";
  } else if (
    types.includes("gas_station") ||
    primaryType.includes("gas_station")
  ) {
    category = "station";
  }

  // Build tags
  const tags: string[] = [];

  // Mark as wheelchair accessible if Google says so
  const hasAccessibleRestroom =
    place.accessibilityOptions?.wheelchairAccessibleRestroom === true;
  const hasAccessibleEntrance =
    place.accessibilityOptions?.wheelchairAccessibleEntrance === true;

  if (hasAccessibleRestroom) {
    tags.push("barrierefrei");
    tags.push("google_wc_accessible");
  } else if (hasAccessibleEntrance) {
    tags.push("barrierefrei");
    tags.push("google_entrance_accessible");
  } else {
    // Place has restroom but no wheelchair info - still useful
    tags.push("google_has_restroom");
  }

  return {
    id: `gplace_${place.id}`,
    lat: place.location.latitude,
    lon: place.location.longitude,
    name: place.displayName?.text || "Unnamed Location",
    city: "", // Could geocode this if needed
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

  if (args.length < 2) {
    console.log(
      "Usage: npx tsx scripts/fetch-google-places.ts <lat> <lon> [radius_meters]",
    );
    console.log(
      "Example: npx tsx scripts/fetch-google-places.ts 52.375 9.82 1000",
    );
    console.log("");
    console.log("Fetches places with restrooms from Google Places API");
    console.log("and saves them to src/data/google-places.json");
    process.exit(1);
  }

  const lat = parseFloat(args[0]);
  const lon = parseFloat(args[1]);
  const radius = parseInt(args[2] || "1000", 10);

  if (isNaN(lat) || isNaN(lon)) {
    console.error("Invalid coordinates");
    process.exit(1);
  }

  console.log(`\n🚽 WC Finder - Google Places Fetcher`);
  console.log(`=====================================\n`);
  console.log(`Location: ${lat}, ${lon}`);
  console.log(`Radius: ${radius}m\n`);

  try {
    const places = await fetchNearbyPlaces(lat, lon, radius);
    console.log(`Found ${places.length} total places`);

    // Convert and filter
    const toilets: ToiletEntry[] = [];
    for (const place of places) {
      const toilet = convertToToilet(place);
      if (toilet) {
        toilets.push(toilet);
      }
    }

    console.log(`\n✅ ${toilets.length} places have restrooms`);
    console.log(
      `   - Wheelchair accessible restroom: ${toilets.filter((t) => t.tags.includes("google_wc_accessible")).length}`,
    );
    console.log(
      `   - Wheelchair accessible entrance: ${toilets.filter((t) => t.tags.includes("google_entrance_accessible")).length}`,
    );
    console.log(
      `   - Has restroom (unknown accessibility): ${toilets.filter((t) => t.tags.includes("google_has_restroom")).length}`,
    );

    // Show sample
    console.log("\nSample results:");
    toilets.slice(0, 10).forEach((t) => {
      const d = getDistanceMeters(lat, lon, t.lat, t.lon);
      const accessibility = t.tags.includes("google_wc_accessible")
        ? "♿ WC accessible"
        : t.tags.includes("google_entrance_accessible")
          ? "♿ entrance only"
          : "❓ unknown";
      console.log(`  ${Math.round(d)}m: ${t.name} (${accessibility})`);
    });

    // Load existing data if available
    const outPath = path.join(
      __dirname,
      "..",
      "src",
      "data",
      "google-places.json",
    );
    let existing: ToiletEntry[] = [];

    if (fs.existsSync(outPath)) {
      const data = JSON.parse(fs.readFileSync(outPath, "utf-8"));
      existing = data.toilets || [];
      console.log(`\n📁 Loaded ${existing.length} existing places`);
    }

    // Merge and deduplicate
    const merged = [...existing];
    const DEDUP_RADIUS = 30; // meters

    for (const t of toilets) {
      const isDup = merged.some(
        (e) => getDistanceMeters(e.lat, e.lon, t.lat, t.lon) < DEDUP_RADIUS,
      );
      if (!isDup) {
        merged.push(t);
      }
    }

    console.log(`\n📊 Merged dataset: ${merged.length} total places`);
    console.log(`   (added ${merged.length - existing.length} new)`);

    // Save
    const output = {
      generated: new Date().toISOString().split("T")[0],
      source: `Google Places API - fetched ${radius}m around ${lat}, ${lon}`,
      count: merged.length,
      toilets: merged,
    };

    fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
    console.log(`\n💾 Saved to: ${outPath}`);

    // Print usage hint
    console.log("\n📋 Next steps:");
    console.log("   1. Run: npx tsx scripts/merge-sources.ts");
    console.log("   2. Run: npx tsx scripts/split-tiles.ts");
    console.log("   3. Run: npx tsx scripts/gen-tile-loader.ts");
    console.log("   4. Rebuild the app");
  } catch (err) {
    console.error("\n❌ Error:", err instanceof Error ? err.message : err);
    process.exit(1);
  }
}

main();
