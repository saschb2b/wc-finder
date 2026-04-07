/**
 * Fetches wheelchair-accessible toilets for Dortmund from official open data.
 * Sources:
 * - Open Data Dortmund: offentliche-toiletten (Nette Toilette locations)
 * - Open Data Dortmund: offentliche-toiletten-behindertengerecht (accessible toilets)
 *
 * Usage: npx tsx scripts/fetch-dortmund.ts
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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

// Curated high-priority Dortmund locations that might not be in the open data
// or need manual verification
const DORTMUND_CURATED: ToiletEntry[] = [
  // Hauptbahnhof - SANIFAIR (not in "Nette Toilette" dataset as it's a commercial operator)
  {
    id: "do_hbf_sanifair",
    lat: 51.5178,
    lon: 7.4593,
    name: "Dortmund Hauptbahnhof (SANIFAIR)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei", "eurokey", "wickeltisch"],
    opening_hours: "04:30-01:00",
    operator: "SANIFAIR",
    fee: "yes",
  },
  // Wall ECN - verified city public toilet
  {
    id: "do_wall_ecn",
    lat: 51.5141,
    lon: 7.4645,
    name: "Wall ECN Toilette",
    city: "Dortmund",
    category: "public_24h",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "24/7",
    operator: "Stadt Dortmund",
  },
  // Hansaplatz - verified city public toilet
  {
    id: "do_hansaplatz",
    lat: 51.5125,
    lon: 7.4615,
    name: "Hansaplatz WC-Anlage",
    city: "Dortmund",
    category: "public_24h",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "06:00-23:00",
    operator: "Stadt Dortmund",
  },
  // Signal Iduna Park
  {
    id: "do_signal_iduna",
    lat: 51.4926,
    lon: 7.4518,
    name: "Signal Iduna Park (BVB Stadion)",
    city: "Dortmund",
    category: "other",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "match days / events",
    operator: "BVB",
  },

  // === TRUE 24/7 LOCATIONS FOR LATE NIGHT ===

  // Gas stations with 24/7 shops
  {
    id: "do_shell_city",
    lat: 51.5145,
    lon: 7.455,
    name: "Shell (Ruhrallee / City)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "Shell",
  },
  {
    id: "do_aral_westfalenhallen",
    lat: 51.493,
    lon: 7.46,
    name: "Aral (Westfalenhallen)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "Aral",
  },
  {
    id: "do_jet_hoerde",
    lat: 51.485,
    lon: 7.501,
    name: "JET Tankstelle (Hörde)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "JET",
  },
  {
    id: "do_total_mengede",
    lat: 51.572,
    lon: 7.386,
    name: "TotalEnergies (Mengede)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "TotalEnergies",
  },
  {
    id: "do_shell_a45",
    lat: 51.475,
    lon: 7.52,
    name: "Shell (A45 Raststätte Dortmund-Süd)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "24/7",
    operator: "Shell",
  },
  {
    id: "do_aral_a2",
    lat: 51.536,
    lon: 7.425,
    name: "Aral (A2 Raststätte Dortmund-Nord)",
    city: "Dortmund",
    category: "station",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "24/7",
    operator: "Aral",
  },

  // McDonald's (proven late-night spot!)
  {
    id: "do_mcdonalds_hbf",
    lat: 51.518,
    lon: 7.459,
    name: "McDonald's (Hauptbahnhof)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "McDonald's",
  },
  {
    id: "do_mcdonalds_westenhellweg",
    lat: 51.513,
    lon: 7.465,
    name: "McDonald's (Westenhellweg)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "McDonald's",
  },
  {
    id: "do_mcdonalds_hoerde",
    lat: 51.48,
    lon: 7.505,
    name: "McDonald's (Hörde)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "McDonald's",
  },
  {
    id: "do_mcdonalds_a40",
    lat: 51.515,
    lon: 7.38,
    name: "McDonald's (A40 Autobahn)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "McDonald's",
  },

  // Hospitals (always accessible)
  {
    id: "do_klinikum_mitte",
    lat: 51.4953,
    lon: 7.4055,
    name: "Klinikum Dortmund (Mitte)",
    city: "Dortmund",
    category: "other",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "24/7",
    operator: "Klinikum Dortmund",
  },
  {
    id: "do_klinikum_west",
    lat: 51.5118,
    lon: 7.4365,
    name: "Klinikum Dortmund (West)",
    city: "Dortmund",
    category: "other",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "24/7",
    operator: "Klinikum Dortmund",
  },
  {
    id: "do_marienhospital",
    lat: 51.508,
    lon: 7.47,
    name: "Marien-Hospital (Dortmund)",
    city: "Dortmund",
    category: "other",
    tags: ["barrierefrei", "eurokey"],
    opening_hours: "24/7",
    operator: "Marien-Hospital",
  },

  // Police (always open)
  {
    id: "do_polizei_hbf",
    lat: 51.518,
    lon: 7.46,
    name: "Polizeiinspektion (Hauptbahnhof)",
    city: "Dortmund",
    category: "other",
    tags: ["barrierefrei"],
    opening_hours: "24/7",
    operator: "Polizei",
  },

  // Late night clubs/bars (weekend hours)
  {
    id: "do_nightrooms",
    lat: 51.515,
    lon: 7.465,
    name: "Nightrooms (Club)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 23:00-06:00",
    operator: "Nightrooms",
  },
  {
    id: "do_prisma",
    lat: 51.513,
    lon: 7.468,
    name: "Prisma (Club)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 23:00-06:00",
    operator: "Prisma",
  },
  {
    id: "do_fzw",
    lat: 51.498,
    lon: 7.45,
    name: "FZW (Club & Kulturzentrum)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 22:00-05:00",
    operator: "FZW Dortmund",
  },
  {
    id: "do_ringlokschuppen",
    lat: 51.495,
    lon: 7.455,
    name: "Ringlokschuppen (Biergarten & Club)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 20:00-04:00",
    operator: "Ringlokschuppen",
  },
  {
    id: "do_ole_7",
    lat: 51.514,
    lon: 7.465,
    name: "Öl 7 (Kneipe)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 18:00-03:00",
    operator: "Öl 7",
  },

  // More Dortmund late night bars/clubs
  {
    id: "do_sonic",
    lat: 51.515,
    lon: 7.468,
    name: "Sonic (Club)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 23:00-06:00",
    operator: "Sonic Club",
  },
  {
    id: "do_mogli",
    lat: 51.513,
    lon: 7.467,
    name: "Mogli (Bar)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 18:00-03:00",
    operator: "Mogli",
  },
  {
    id: "do_tournedos",
    lat: 51.514,
    lon: 7.464,
    name: "Tournedos (Bar)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 18:00-03:00",
    operator: "Tournedos",
  },
  {
    id: "do_bierermann",
    lat: 51.513,
    lon: 7.466,
    name: "Biere-Mann (Kneipe)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 17:00-02:00",
    operator: "Biere-Mann",
  },
  {
    id: "do_hovels",
    lat: 51.515,
    lon: 7.463,
    name: "Hövels Hausbrauerei",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 17:00-01:00",
    operator: "Hövels",
  },
  {
    id: "do_pantheon",
    lat: 51.495,
    lon: 7.45,
    name: "Pantheon (Club - Strobelallee)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 22:00-05:00",
    operator: "Pantheon",
  },
  {
    id: "do_bullwinkel",
    lat: 51.487,
    lon: 7.505,
    name: "Bullwinkel (Hörde - Bar)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 18:00-03:00",
    operator: "Bullwinkel",
  },
  {
    id: "do_zum_alten_markt",
    lat: 51.513,
    lon: 7.465,
    name: "Zum Alten Markt (Kneipe)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 16:00-01:00",
    operator: "Zum Alten Markt",
  },
  {
    id: "do_subrosa",
    lat: 51.512,
    lon: 7.468,
    name: "Subrosa (Bar)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Mo-Sa 19:00-03:00",
    operator: "Subrosa",
  },
  {
    id: "do_pilgrim",
    lat: 51.514,
    lon: 7.469,
    name: "Pilgrim (Bar & Club)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 22:00-05:00",
    operator: "Pilgrim",
  },
  {
    id: "do_maximal",
    lat: 51.495,
    lon: 7.452,
    name: "Maximal (Club)",
    city: "Dortmund",
    category: "gastro",
    tags: ["barrierefrei"],
    opening_hours: "Fr-Sa 23:00-06:00",
    operator: "Maximal",
  },
];

async function fetchDortmundOpenData(): Promise<ToiletEntry[]> {
  console.log("Fetching official Dortmund open data...\n");

  const results: ToiletEntry[] = [];
  const seenCoords = new Set<string>();

  // Helper to add toilet if not duplicate
  const addToilet = (t: ToiletEntry) => {
    const key = `${t.lat.toFixed(5)},${t.lon.toFixed(5)}`;
    if (seenCoords.has(key)) return;
    seenCoords.add(key);
    results.push(t);
  };

  // Try to fetch from Open Data Dortmund API
  try {
    // Fetch "Nette Toilette" locations
    console.log("  Fetching Nette Toilette locations...");
    const netteToiletteUrl =
      "https://open-data.dortmund.de/api/explore/v2.1/catalog/datasets/offentliche-toiletten/exports/geojson?limit=200";

    try {
      const response = await fetch(netteToiletteUrl);
      if (response.ok) {
        const data = await response.json();

        for (const feature of data.features || []) {
          const [lon, lat] = feature.geometry.coordinates;
          const props = feature.properties;

          // Only include wheelchair accessible
          const isAccessible =
            props.i_zusinfo?.toLowerCase().includes("rollstuhl") ||
            props.objektzusa?.toLowerCase().includes("nette");

          if (!isAccessible) continue;

          const toilet: ToiletEntry = {
            id: `do_net_${props.uuid?.slice(0, 8) || Math.random().toString(36).slice(2, 10)}`,
            lat,
            lon,
            name: props.objektname || "Öffentliche Toilette",
            city: "Dortmund",
            category: props.objektzusa?.includes("Nette")
              ? "other"
              : "public_24h",
            tags: ["barrierefrei", "nette-toilette"],
            operator: props.objektname,
          };

          addToilet(toilet);
        }
        console.log(`    Added ${results.length} Nette Toilette locations`);
      }
    } catch (err) {
      console.log("    Failed to fetch Nette Toilette data");
    }

    // Fetch accessible toilets
    console.log("  Fetching accessible toilets...");
    const accessibleUrl =
      "https://open-data.dortmund.de/api/explore/v2.1/catalog/datasets/offentliche-toiletten-behindertengerecht/exports/geojson?limit=200";

    const beforeCount = results.length;
    try {
      const response = await fetch(accessibleUrl);
      if (response.ok) {
        const data = await response.json();

        for (const feature of data.features || []) {
          const [lon, lat] = feature.geometry.coordinates;
          const props = feature.properties;

          const toilet: ToiletEntry = {
            id: `do_acc_${props.uuid?.slice(0, 8) || Math.random().toString(36).slice(2, 10)}`,
            lat,
            lon,
            name: props.objektname || "Barrierefreie Toilette",
            city: "Dortmund",
            category: "public_24h",
            tags: ["barrierefrei", "eurokey"],
            operator: props.objektname,
          };

          addToilet(toilet);
        }
        console.log(
          `    Added ${results.length - beforeCount} accessible toilets`,
        );
      }
    } catch (err) {
      console.log("    Failed to fetch accessible toilet data");
    }
  } catch (error) {
    console.error("Error fetching open data:", error);
  }

  return results;
}

async function main() {
  console.log("=== Dortmund Data from Official Open Data ===\n");

  // Fetch from official open data
  const openDataToilets = await fetchDortmundOpenData();

  // Merge with curated high-priority locations
  const all = [...openDataToilets];

  // Add curated locations that aren't duplicates
  const seenCoords = new Set(
    all.map((t) => `${t.lat.toFixed(4)},${t.lon.toFixed(4)}`),
  );

  for (const curated of DORTMUND_CURATED) {
    const key = `${curated.lat.toFixed(4)},${curated.lon.toFixed(4)}`;
    if (!seenCoords.has(key)) {
      all.push(curated);
      seenCoords.add(key);
    }
  }

  // Stats
  const cats = { public_24h: 0, station: 0, gastro: 0, other: 0 };
  for (const t of all) cats[t.category]++;

  console.log(`\n--- Results ---`);
  console.log(`Total: ${all.length} toilets`);
  console.log(`  public_24h: ${cats.public_24h}`);
  console.log(`  station: ${cats.station}`);
  console.log(`  other: ${cats.other}`);
  console.log(
    `  eurokey: ${all.filter((t) => t.tags.includes("eurokey")).length}`,
  );
  console.log(`  with hours: ${all.filter((t) => t.opening_hours).length}`);

  const output = {
    generated: new Date().toISOString().split("T")[0],
    source: "Dortmund Open Data (offentliche-toiletten) + Curated",
    count: all.length,
    toilets: all,
  };

  const outPath = path.join(
    __dirname,
    "..",
    "src",
    "data",
    "dortmund-toilets.json",
  );
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nSaved to src/data/dortmund-toilets.json`);
}

main().catch(console.error);
