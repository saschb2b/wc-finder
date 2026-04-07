/**
 * Fetches opening hours for all Google Places in the dataset.
 * Uses Place Details API (New) which costs $17 per 1,000 requests.
 * With ~1,844 places = ~$31 total cost.
 *
 * Usage: npx tsx scripts/fetch-google-places-details.ts
 * Requires: GOOGLE_PLACES_API_KEY in .env
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load API key
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);
  if (match) process.env.GOOGLE_PLACES_API_KEY = match[1].trim();
}

const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;

if (!GOOGLE_PLACES_API_KEY) {
  console.error("❌ GOOGLE_PLACES_API_KEY not found in .env");
  process.exit(1);
}

interface PlaceDetails {
  id: string;
  restroom?: boolean;
  businessStatus?: string;
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
  };
  currentOpeningHours?: {
    openNow?: boolean;
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions?: string[];
  };
  regularOpeningHours?: {
    periods?: Array<{
      open: { day: number; hour: number; minute: number };
      close?: { day: number; hour: number; minute: number };
    }>;
    weekdayDescriptions?: string[];
  };
}

interface ToiletEntry {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: "public_24h" | "station" | "gastro" | "other";
  tags: string[];
  opening_hours?: string;
  operator?: string;
  fee?: string;
}

// Convert Google Places period format to OSM opening_hours format
function convertToOsmHours(details: PlaceDetails): string | undefined {
  const hours = details.regularOpeningHours || details.currentOpeningHours;
  if (!hours?.periods || hours.periods.length === 0) {
    return undefined;
  }

  // Map Google day numbers to OSM day codes
  const dayMap = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

  // Group periods by day
  const byDay: Record<number, Array<{ open: string; close?: string }>> = {};

  for (const period of hours.periods) {
    const day = period.open.day;
    if (!byDay[day]) byDay[day] = [];

    const openTime = `${String(period.open.hour).padStart(2, "0")}:${String(period.open.minute).padStart(2, "0")}`;
    const closeTime = period.close
      ? `${String(period.close.hour).padStart(2, "0")}:${String(period.close.minute).padStart(2, "0")}`
      : undefined;

    byDay[day].push({ open: openTime, close: closeTime });
  }

  // Build OSM format string
  const parts: string[] = [];
  for (let day = 0; day < 7; day++) {
    const dayPeriods = byDay[day];
    if (!dayPeriods || dayPeriods.length === 0) continue;

    const timeRanges = dayPeriods
      .map((p) => (p.close ? `${p.open}-${p.close}` : `${p.open}+`))
      .join(",");

    parts.push(`${dayMap[day]} ${timeRanges}`);
  }

  if (parts.length === 0) return undefined;

  // Try to combine consecutive days with same hours
  return simplifyHours(parts.join("; "));
}

function simplifyHours(hours: string): string {
  // Very basic simplification - just return as-is for now
  // Could be enhanced to combine Mo-Fr, Sa-Su, etc.
  return hours;
}

async function fetchPlaceDetails(
  placeId: string,
): Promise<PlaceDetails | null> {
  try {
    const response = await fetch(
      `https://places.googleapis.com/v1/places/${placeId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask":
            "id,regularOpeningHours,currentOpeningHours,restroom,accessibilityOptions,businessStatus",
        },
      },
    );

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error(`Error fetching ${placeId}:`, err);
    return null;
  }
}

async function main() {
  const dataPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "google-places.json",
  );

  if (!fs.existsSync(dataPath)) {
    console.error("❌ google-places.json not found");
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const toilets: ToiletEntry[] = data.toilets || [];

  console.log("🚽 Fetching opening hours for Google Places\n");
  console.log(`Total places: ${toilets.length}`);
  console.log(
    `Estimated cost: $${(toilets.length * 0.017).toFixed(2)} (€${(toilets.length * 0.016).toFixed(2)})\n`,
  );

  let withHours = 0;
  let updatedTags = 0;
  let noRestroom = 0;
  let failed = 0;
  let skipped = 0;

  for (let i = 0; i < toilets.length; i++) {
    const toilet = toilets[i];
    const placeId = toilet.id.replace("gplace_", "");

    process.stdout.write(
      `[${i + 1}/${toilets.length}] ${toilet.name.substring(0, 40)} ... `,
    );

    const details = await fetchPlaceDetails(placeId);

    if (details) {
      let updates: string[] = [];

      // Check if place actually has a restroom
      if (details.restroom === false) {
        if (!toilet.tags.includes("no_restroom")) {
          toilet.tags.push("no_restroom");
          updates.push("NO RESTROOM");
        }
        noRestroom++;
      } else if (details.restroom === true) {
        if (!toilet.tags.includes("has_restroom")) {
          toilet.tags.push("has_restroom");
          updates.push("has restroom");
        }
      }

      // Update accessibility info
      if (details.accessibilityOptions) {
        const opts = details.accessibilityOptions;

        if (opts.wheelchairAccessibleRestroom === true) {
          if (!toilet.tags.includes("barrierefrei")) {
            toilet.tags.push("barrierefrei");
            updates.push("accessible WC");
          }
          if (!toilet.tags.includes("google_wc_accessible")) {
            toilet.tags.push("google_wc_accessible");
          }
          // Remove 'unknown' tag if we now know it's accessible
          toilet.tags = toilet.tags.filter((t) => t !== "google_has_restroom");
          updatedTags++;
        }
      }

      // Check business status
      if (details.businessStatus === "CLOSED_PERMANENTLY") {
        if (!toilet.tags.includes("permanently_closed")) {
          toilet.tags.push("permanently_closed");
          updates.push("CLOSED PERMANENTLY");
        }
      }

      // Fetch opening hours if not already present
      if (!toilet.opening_hours) {
        const hours = convertToOsmHours(details);
        if (hours) {
          toilet.opening_hours = hours;
          withHours++;
          updates.push(`hours: ${hours.substring(0, 30)}...`);
        }
      } else {
        skipped++;
      }

      if (updates.length > 0) {
        process.stdout.write(`✓ ${updates.join(", ")}\n`);
      } else {
        process.stdout.write(`✓ (no new info)\n`);
      }
    } else {
      failed++;
      process.stdout.write(`✗ failed\n`);
    }

    // Rate limiting
    await new Promise((r) => setTimeout(r, 100));

    // Save progress every 50 places
    if ((i + 1) % 50 === 0) {
      fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));
      console.log(`  💾 Saved progress (${i + 1}/${toilets.length})\n`);
    }
  }

  // Final save
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

  console.log("\n✅ Done!");
  console.log(`  Opening hours added: ${withHours}`);
  console.log(`  Accessibility updated: ${updatedTags}`);
  console.log(`  No restroom found: ${noRestroom}`);
  console.log(`  Already had hours: ${skipped}`);
  console.log(`  Failed: ${failed}`);
  console.log(
    `  Total with hours now: ${toilets.filter((t) => t.opening_hours).length}`,
  );
  console.log(`\n💾 Saved to: ${dataPath}`);
  console.log("\n📋 Next steps:");
  console.log("   npx tsx scripts/merge-sources.ts");
  console.log("   npx tsx scripts/split-tiles.ts");
  console.log("   npx tsx scripts/gen-tile-loader.ts");
}

main().catch(console.error);
