/**
 * Fetches places with restrooms from Google Places API for smaller cities (20k-100k).
 * Complements fetch-google-places-germany.ts which covers 100k+ cities.
 *
 * Usage: npx tsx scripts/fetch-google-places-small-cities.ts [--dry-run]
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  const match = envContent.match(/GOOGLE_PLACES_API_KEY=(.+)/);
  if (match) process.env.GOOGLE_PLACES_API_KEY = match[1].trim();
}

const API_KEY = process.env.GOOGLE_PLACES_API_KEY;
if (!API_KEY) {
  console.error("GOOGLE_PLACES_API_KEY not found in .env");
  process.exit(1);
}

type ToiletCategory =
  | "public_24h"
  | "station"
  | "tankstelle"
  | "gastro"
  | "other";

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
}

// German cities 20k-100k + smaller AT/CH cities
// r = radius in km (1-2km for smaller towns)
const CITIES: Array<{ name: string; lat: number; lon: number; r: number }> = [
  // Niedersachsen
  { name: "Wennigsen", lat: 52.271, lon: 9.573, r: 1.5 },
  { name: "Barsinghausen", lat: 52.304, lon: 9.459, r: 1.5 },
  { name: "Garbsen", lat: 52.418, lon: 9.598, r: 2 },
  { name: "Langenhagen", lat: 52.438, lon: 9.738, r: 2 },
  { name: "Laatzen", lat: 52.315, lon: 9.799, r: 2 },
  { name: "Lehrte", lat: 52.372, lon: 9.979, r: 1.5 },
  { name: "Burgdorf", lat: 52.446, lon: 10.007, r: 1.5 },
  { name: "Springe", lat: 52.208, lon: 9.555, r: 1.5 },
  { name: "Neustadt am Rübenberge", lat: 52.504, lon: 9.462, r: 1.5 },
  { name: "Celle", lat: 52.624, lon: 10.081, r: 2 },
  { name: "Hameln", lat: 52.104, lon: 9.358, r: 2 },
  { name: "Goslar", lat: 51.907, lon: 10.429, r: 2 },
  { name: "Peine", lat: 52.321, lon: 10.236, r: 1.5 },
  { name: "Gifhorn", lat: 52.488, lon: 10.547, r: 1.5 },
  { name: "Cuxhaven", lat: 53.864, lon: 8.694, r: 2 },
  { name: "Emden", lat: 53.367, lon: 7.206, r: 2 },
  { name: "Lingen", lat: 52.522, lon: 7.322, r: 1.5 },
  { name: "Nordhorn", lat: 52.432, lon: 7.068, r: 1.5 },
  { name: "Wilhelmshaven", lat: 53.522, lon: 8.117, r: 2 },
  { name: "Delmenhorst", lat: 53.050, lon: 8.631, r: 2 },
  { name: "Stade", lat: 53.598, lon: 9.476, r: 1.5 },
  { name: "Lüneburg", lat: 53.249, lon: 10.412, r: 2 },
  { name: "Uelzen", lat: 52.966, lon: 10.559, r: 1.5 },
  { name: "Nienburg", lat: 52.641, lon: 9.221, r: 1.5 },
  { name: "Verden", lat: 52.923, lon: 9.232, r: 1.5 },
  { name: "Buxtehude", lat: 53.468, lon: 9.694, r: 1.5 },
  // NRW (smaller)
  { name: "Iserlohn", lat: 51.375, lon: 7.695, r: 2 },
  { name: "Lüdenscheid", lat: 51.220, lon: 7.631, r: 1.5 },
  { name: "Gütersloh", lat: 51.907, lon: 8.378, r: 2 },
  { name: "Minden", lat: 52.288, lon: 8.917, r: 2 },
  { name: "Herford", lat: 52.118, lon: 8.672, r: 1.5 },
  { name: "Arnsberg", lat: 51.397, lon: 8.064, r: 1.5 },
  { name: "Detmold", lat: 51.936, lon: 8.879, r: 1.5 },
  { name: "Lippstadt", lat: 51.673, lon: 8.345, r: 1.5 },
  { name: "Rheine", lat: 52.281, lon: 7.435, r: 1.5 },
  { name: "Paderborn", lat: 51.719, lon: 8.754, r: 2 },
  { name: "Witten", lat: 51.444, lon: 7.340, r: 2 },
  { name: "Velbert", lat: 51.339, lon: 7.047, r: 1.5 },
  { name: "Ratingen", lat: 51.297, lon: 6.849, r: 1.5 },
  { name: "Marl", lat: 51.657, lon: 7.093, r: 1.5 },
  { name: "Dorsten", lat: 51.661, lon: 6.965, r: 1.5 },
  { name: "Lünen", lat: 51.617, lon: 7.528, r: 1.5 },
  { name: "Unna", lat: 51.537, lon: 7.689, r: 1.5 },
  { name: "Neuss", lat: 51.198, lon: 6.692, r: 2 },
  { name: "Troisdorf", lat: 50.816, lon: 7.155, r: 1.5 },
  { name: "Bergisch Gladbach", lat: 50.992, lon: 7.132, r: 2 },
  { name: "Kerpen", lat: 50.870, lon: 6.696, r: 1.5 },
  { name: "Euskirchen", lat: 50.662, lon: 6.787, r: 1.5 },
  { name: "Düren", lat: 50.803, lon: 6.483, r: 1.5 },
  { name: "Stolberg", lat: 50.771, lon: 6.226, r: 1.5 },
  // Hessen
  { name: "Fulda", lat: 50.551, lon: 9.675, r: 2 },
  { name: "Marburg", lat: 50.810, lon: 8.771, r: 2 },
  { name: "Gießen", lat: 50.584, lon: 8.677, r: 2 },
  { name: "Limburg", lat: 50.389, lon: 8.068, r: 1.5 },
  { name: "Bad Homburg", lat: 50.227, lon: 8.618, r: 1.5 },
  { name: "Offenbach", lat: 50.101, lon: 8.762, r: 2 },
  { name: "Hanau", lat: 50.133, lon: 8.917, r: 2 },
  { name: "Rüsselsheim", lat: 49.995, lon: 8.417, r: 1.5 },
  { name: "Bad Vilbel", lat: 50.178, lon: 8.738, r: 1.5 },
  // Bayern (smaller)
  { name: "Bamberg", lat: 49.891, lon: 10.887, r: 2 },
  { name: "Bayreuth", lat: 49.946, lon: 11.578, r: 2 },
  { name: "Aschaffenburg", lat: 49.977, lon: 9.150, r: 2 },
  { name: "Schweinfurt", lat: 50.049, lon: 10.230, r: 1.5 },
  { name: "Landshut", lat: 48.536, lon: 12.152, r: 2 },
  { name: "Passau", lat: 48.574, lon: 13.463, r: 2 },
  { name: "Rosenheim", lat: 47.857, lon: 12.128, r: 2 },
  { name: "Kempten", lat: 47.726, lon: 10.315, r: 1.5 },
  { name: "Kaufbeuren", lat: 47.880, lon: 10.623, r: 1.5 },
  { name: "Neu-Ulm", lat: 48.393, lon: 10.012, r: 1.5 },
  { name: "Freising", lat: 48.402, lon: 11.749, r: 1.5 },
  { name: "Straubing", lat: 48.882, lon: 12.572, r: 1.5 },
  { name: "Deggendorf", lat: 48.832, lon: 12.960, r: 1.5 },
  { name: "Weiden", lat: 49.677, lon: 12.163, r: 1.5 },
  { name: "Hof", lat: 50.316, lon: 11.912, r: 1.5 },
  { name: "Coburg", lat: 50.259, lon: 10.963, r: 1.5 },
  { name: "Fürth", lat: 49.477, lon: 10.989, r: 2 },
  // Baden-Württemberg (smaller)
  { name: "Tübingen", lat: 48.521, lon: 9.057, r: 2 },
  { name: "Offenburg", lat: 48.473, lon: 7.944, r: 1.5 },
  { name: "Villingen-Schwenningen", lat: 48.062, lon: 8.454, r: 2 },
  { name: "Friedrichshafen", lat: 47.651, lon: 9.480, r: 2 },
  { name: "Ravensburg", lat: 47.782, lon: 9.612, r: 1.5 },
  { name: "Singen", lat: 47.760, lon: 8.840, r: 1.5 },
  { name: "Lörrach", lat: 47.615, lon: 7.661, r: 1.5 },
  { name: "Göppingen", lat: 48.703, lon: 9.652, r: 1.5 },
  { name: "Esslingen", lat: 48.740, lon: 9.305, r: 2 },
  { name: "Ludwigsburg", lat: 48.894, lon: 9.192, r: 2 },
  { name: "Waiblingen", lat: 48.831, lon: 9.317, r: 1.5 },
  { name: "Böblingen", lat: 48.686, lon: 9.015, r: 1.5 },
  { name: "Sindelfingen", lat: 48.713, lon: 9.003, r: 1.5 },
  { name: "Schwäbisch Hall", lat: 49.112, lon: 9.736, r: 1.5 },
  { name: "Schwäbisch Gmünd", lat: 48.800, lon: 9.798, r: 1.5 },
  { name: "Aalen", lat: 48.837, lon: 10.094, r: 1.5 },
  { name: "Heidenheim", lat: 48.677, lon: 10.154, r: 1.5 },
  // Rheinland-Pfalz
  { name: "Kaiserslautern", lat: 49.445, lon: 7.769, r: 2 },
  { name: "Ludwigshafen", lat: 49.477, lon: 8.445, r: 2 },
  { name: "Neustadt Weinstraße", lat: 49.350, lon: 8.140, r: 1.5 },
  { name: "Speyer", lat: 49.318, lon: 8.432, r: 1.5 },
  { name: "Worms", lat: 49.633, lon: 8.362, r: 1.5 },
  { name: "Bad Kreuznach", lat: 49.843, lon: 7.866, r: 1.5 },
  { name: "Andernach", lat: 50.441, lon: 7.404, r: 1.5 },
  { name: "Neuwied", lat: 50.432, lon: 7.462, r: 1.5 },
  // Saarland
  { name: "Neunkirchen", lat: 49.347, lon: 7.178, r: 1.5 },
  { name: "Homburg", lat: 49.323, lon: 7.339, r: 1.5 },
  { name: "Völklingen", lat: 49.253, lon: 6.857, r: 1.5 },
  // Schleswig-Holstein
  { name: "Flensburg", lat: 54.785, lon: 9.436, r: 2 },
  { name: "Neumünster", lat: 54.073, lon: 9.984, r: 2 },
  { name: "Norderstedt", lat: 53.707, lon: 10.000, r: 2 },
  { name: "Elmshorn", lat: 53.754, lon: 9.653, r: 1.5 },
  { name: "Itzehoe", lat: 53.925, lon: 9.514, r: 1.5 },
  { name: "Rendsburg", lat: 54.306, lon: 9.664, r: 1.5 },
  { name: "Husum", lat: 54.486, lon: 9.052, r: 1.5 },
  // Mecklenburg-Vorpommern
  { name: "Wismar", lat: 53.893, lon: 11.465, r: 1.5 },
  { name: "Stralsund", lat: 54.310, lon: 13.089, r: 2 },
  { name: "Greifswald", lat: 54.096, lon: 13.387, r: 2 },
  { name: "Neubrandenburg", lat: 53.559, lon: 13.261, r: 2 },
  { name: "Güstrow", lat: 53.798, lon: 12.177, r: 1.5 },
  // Brandenburg
  { name: "Brandenburg an der Havel", lat: 52.409, lon: 12.556, r: 2 },
  { name: "Frankfurt (Oder)", lat: 52.347, lon: 14.552, r: 2 },
  { name: "Eberswalde", lat: 52.834, lon: 13.822, r: 1.5 },
  { name: "Oranienburg", lat: 52.756, lon: 13.242, r: 1.5 },
  { name: "Falkensee", lat: 52.560, lon: 13.093, r: 1.5 },
  // Sachsen
  { name: "Zwickau", lat: 50.718, lon: 12.496, r: 2 },
  { name: "Plauen", lat: 50.495, lon: 12.134, r: 1.5 },
  { name: "Görlitz", lat: 51.153, lon: 14.988, r: 1.5 },
  { name: "Bautzen", lat: 51.181, lon: 14.424, r: 1.5 },
  { name: "Freiberg", lat: 50.919, lon: 13.343, r: 1.5 },
  { name: "Meißen", lat: 51.163, lon: 13.474, r: 1.5 },
  { name: "Pirna", lat: 50.962, lon: 13.939, r: 1.5 },
  // Sachsen-Anhalt
  { name: "Dessau-Roßlau", lat: 51.836, lon: 12.247, r: 2 },
  { name: "Wittenberg", lat: 51.866, lon: 12.649, r: 1.5 },
  { name: "Stendal", lat: 52.606, lon: 11.859, r: 1.5 },
  { name: "Wernigerode", lat: 51.835, lon: 10.785, r: 1.5 },
  { name: "Halberstadt", lat: 51.896, lon: 11.050, r: 1.5 },
  { name: "Bernburg", lat: 51.795, lon: 11.739, r: 1.5 },
  { name: "Quedlinburg", lat: 51.789, lon: 11.148, r: 1.5 },
  // Thüringen
  { name: "Gera", lat: 50.878, lon: 12.084, r: 2 },
  { name: "Weimar", lat: 50.979, lon: 11.330, r: 2 },
  { name: "Gotha", lat: 50.949, lon: 10.704, r: 1.5 },
  { name: "Eisenach", lat: 50.976, lon: 10.320, r: 1.5 },
  { name: "Suhl", lat: 50.609, lon: 10.693, r: 1.5 },
  { name: "Nordhausen", lat: 51.505, lon: 10.791, r: 1.5 },
  { name: "Mühlhausen", lat: 51.208, lon: 10.453, r: 1.5 },
  { name: "Altenburg", lat: 50.986, lon: 12.437, r: 1.5 },
  // Austria (smaller)
  { name: "Klagenfurt", lat: 46.624, lon: 14.308, r: 2 },
  { name: "Villach", lat: 46.613, lon: 13.849, r: 2 },
  { name: "Wels", lat: 48.159, lon: 14.029, r: 2 },
  { name: "St. Pölten", lat: 48.205, lon: 15.627, r: 2 },
  { name: "Dornbirn", lat: 47.414, lon: 9.744, r: 1.5 },
  { name: "Wiener Neustadt", lat: 47.815, lon: 16.246, r: 2 },
  { name: "Steyr", lat: 48.039, lon: 14.421, r: 1.5 },
  { name: "Feldkirch", lat: 47.240, lon: 9.600, r: 1.5 },
  { name: "Bregenz", lat: 47.503, lon: 9.747, r: 1.5 },
  { name: "Leonding", lat: 48.260, lon: 14.253, r: 1.5 },
  { name: "Klosterneuburg", lat: 48.305, lon: 16.327, r: 1.5 },
  { name: "Baden bei Wien", lat: 48.006, lon: 16.231, r: 1.5 },
  { name: "Leoben", lat: 47.382, lon: 15.091, r: 1.5 },
  { name: "Krems", lat: 48.410, lon: 15.614, r: 1.5 },
  // Switzerland (smaller)
  { name: "St. Gallen", lat: 47.424, lon: 9.376, r: 2 },
  { name: "Winterthur", lat: 47.500, lon: 8.724, r: 2 },
  { name: "Biel/Bienne", lat: 47.137, lon: 7.247, r: 1.5 },
  { name: "Thun", lat: 46.758, lon: 7.629, r: 1.5 },
  { name: "Aarau", lat: 47.391, lon: 8.045, r: 1.5 },
  { name: "Lausanne", lat: 46.520, lon: 6.634, r: 2 },
  { name: "Fribourg", lat: 46.806, lon: 7.162, r: 1.5 },
  { name: "Schaffhausen", lat: 47.697, lon: 8.634, r: 1.5 },
  { name: "Chur", lat: 46.851, lon: 9.532, r: 1.5 },
  { name: "Lugano", lat: 46.005, lon: 8.953, r: 2 },
  { name: "Olten", lat: 47.350, lon: 7.907, r: 1.5 },
  { name: "Solothurn", lat: 47.208, lon: 7.537, r: 1.5 },
  { name: "Zug", lat: 47.173, lon: 8.516, r: 1.5 },
  { name: "Rapperswil-Jona", lat: 47.227, lon: 8.818, r: 1.5 },
];

function generateGrid(
  lat: number,
  lon: number,
  radiusKm: number,
  spacingM: number,
): Array<{ lat: number; lon: number }> {
  const points: Array<{ lat: number; lon: number }> = [];
  const spacingDeg = spacingM / 111000;
  const steps = Math.ceil((radiusKm * 1000) / spacingM);
  for (let x = -steps; x <= steps; x++) {
    for (let y = -steps; y <= steps; y++) {
      const pLat = lat + y * spacingDeg;
      const pLon = lon + x * spacingDeg;
      const distKm = Math.sqrt(
        Math.pow((pLat - lat) * 111, 2) +
          Math.pow((pLon - lon) * 111 * Math.cos((lat * Math.PI) / 180), 2),
      );
      if (distKm <= radiusKm) points.push({ lat: pLat, lon: pLon });
    }
  }
  return points;
}

async function fetchPlaces(
  lat: number,
  lon: number,
  radius: number,
): Promise<GooglePlace[]> {
  const res = await fetch(
    "https://places.googleapis.com/v1/places:searchNearby",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": API_KEY!,
        "X-Goog-FieldMask":
          "places.id,places.displayName,places.location,places.accessibilityOptions,places.restroom,places.primaryType,places.types",
      },
      body: JSON.stringify({
        locationRestriction: {
          circle: { center: { latitude: lat, longitude: lon }, radius },
        },
        includedTypes: [
          "restaurant", "cafe", "fast_food_restaurant", "gym",
          "shopping_mall", "department_store", "supermarket",
          "convenience_store", "gas_station", "bar", "bakery",
        ],
        maxResultCount: 20,
      }),
    },
  );
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`API ${res.status}: ${err.slice(0, 200)}`);
  }
  const data = await res.json();
  return data.places || [];
}

function convert(place: GooglePlace, city: string): ToiletEntry | null {
  if (place.restroom !== true) return null;
  const types = place.types || [];
  const pt = place.primaryType || "";

  let category: ToiletCategory = "other";
  if (
    types.includes("restaurant") || types.includes("cafe") ||
    types.includes("fast_food_restaurant") || types.includes("bar") ||
    types.includes("bakery") || pt.includes("restaurant") ||
    pt.includes("cafe") || pt.includes("bakery")
  ) {
    category = "gastro";
  } else if (types.includes("gas_station") || pt.includes("gas_station")) {
    category = "tankstelle";
  }

  const tags: string[] = [];
  if (place.accessibilityOptions?.wheelchairAccessibleRestroom) {
    tags.push("barrierefrei", "google_wc_accessible");
  } else if (place.accessibilityOptions?.wheelchairAccessibleEntrance) {
    tags.push("barrierefrei", "google_entrance_accessible");
  } else {
    tags.push("google_has_restroom");
  }

  return {
    id: `gplace_${place.id}`,
    lat: place.location.latitude,
    lon: place.location.longitude,
    name: place.displayName?.text || "Unnamed",
    city,
    category,
    tags,
  };
}

function distM(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const SPACING = 1500;

  console.log(`\n🏘️  Google Places - Small Cities`);
  console.log(`=================================\n`);
  console.log(`Cities: ${CITIES.length}`);

  let totalCalls = 0;
  for (const c of CITIES) {
    totalCalls += generateGrid(c.lat, c.lon, c.r, SPACING).length;
  }
  console.log(`Total API calls: ${totalCalls}`);
  console.log(`Cost: ${totalCalls <= 5000 ? "FREE" : `~$${((totalCalls / 1000) * 17).toFixed(0)}`}\n`);

  if (dryRun) {
    for (const c of CITIES) {
      const pts = generateGrid(c.lat, c.lon, c.r, SPACING).length;
      console.log(`  ${c.name.padEnd(28)} ${c.r}km → ${pts} calls`);
    }
    return;
  }

  const outPath = path.join(__dirname, "..", "src", "data", "google-places.json");
  let existing: ToiletEntry[] = [];
  if (fs.existsSync(outPath)) {
    const data = JSON.parse(fs.readFileSync(outPath, "utf-8"));
    existing = data.toilets || [];
    console.log(`Loaded ${existing.length} existing places\n`);
  }

  const allNew: ToiletEntry[] = [];
  let totalApiCalls = 0;

  for (let ci = 0; ci < CITIES.length; ci++) {
    const city = CITIES[ci];
    const grid = generateGrid(city.lat, city.lon, city.r, SPACING);
    process.stdout.write(
      `[${ci + 1}/${CITIES.length}] ${city.name.padEnd(28)} (${grid.length} pts) `,
    );

    let cityFound = 0;
    for (const pt of grid) {
      try {
        const places = await fetchPlaces(pt.lat, pt.lon, SPACING * 0.8);
        totalApiCalls++;
        for (const p of places) {
          const t = convert(p, city.name);
          if (t) { allNew.push(t); cityFound++; }
        }
        await new Promise((r) => setTimeout(r, 80));
      } catch (err: any) {
        process.stdout.write("E ");
        if (err.message?.includes("429")) await new Promise((r) => setTimeout(r, 5000));
      }
    }
    console.log(`→ ${cityFound}`);
  }

  // Deduplicate new
  const unique: ToiletEntry[] = [];
  for (const t of allNew) {
    if (!unique.some((u) => distM(u.lat, u.lon, t.lat, t.lon) < 30)) unique.push(t);
  }

  // Merge with existing
  const merged = [...existing];
  let added = 0;
  for (const t of unique) {
    if (!merged.some((e) => distM(e.lat, e.lon, t.lat, t.lon) < 30)) {
      merged.push(t);
      added++;
    }
  }

  console.log(`\n--- Summary ---`);
  console.log(`API calls: ${totalApiCalls}`);
  console.log(`New unique: ${unique.length}`);
  console.log(`Added: ${added} (${merged.length} total)`);
  console.log(`  Gastro: ${merged.filter((t) => t.category === "gastro").length}`);
  console.log(`  Accessible: ${merged.filter((t) => t.tags.includes("barrierefrei")).length}`);

  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: `Google Places API - ${CITIES.length} small cities + existing`,
    count: merged.length,
    toilets: merged,
  };
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nSaved to: ${outPath}`);
}

main().catch(console.error);
