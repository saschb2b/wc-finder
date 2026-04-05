/**
 * Fetches wheelchair-accessible toilet data from toilettenhero.de for all German cities,
 * then enriches with OpenStreetMap data (opening_hours, operator, access type) via Overpass API.
 *
 * Classifies toilets into categories:
 *   - "public_24h"  — standalone public toilet, likely EU key, 24/7 (highest value)
 *   - "station"     — train station / sanifair toilets
 *   - "gastro"      — inside a café / restaurant (business hours only)
 *   - "other"       — shopping centers, parks, etc.
 *
 * Usage: npx tsx scripts/fetch-toilets.ts
 */

type ToiletCategory = 'public_24h' | 'station' | 'gastro' | 'other';

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

interface CityData {
  s: { n: string; t: number; lat: number; lon: number };
  d: [number, number, string, string, string, string][];
}

// --- Classification from name ---

const PUBLIC_PATTERNS = [
  /^öffentliche\s+toilette/i,
  /^public\s+toilet/i,
  /^wc\s*$/i,
  /^toilette\s*$/i,
  /^behinderten-?wc/i,
  /^behinderten-?toilette/i,
  /^city\s*toilette/i,
  /^city\s*wc/i,
  /nette\s+toilette/i,
];

const STATION_PATTERNS = [
  /sanifair/i,
  /^db\s/i,
  /bahnhof/i,
  /hbf/i,
  /hauptbahnhof/i,
  /^s-bahn/i,
  /^u-bahn/i,
  /busbahnhof/i,
  /raststätte/i,
  /rastplatz/i,
  /autohof/i,
  /tankstelle/i,
];

const GASTRO_PATTERNS = [
  /café|cafe/i,
  /restaurant/i,
  /gaststätte/i,
  /bistro/i,
  /bäckerei/i,
  /konditorei/i,
  /pizzeria/i,
  /imbiss/i,
  /döner|kebab/i,
  /burger/i,
  /mcdonald/i,
  /starbucks/i,
  /subway/i,
  /kfc/i,
  /eiscafé|eisdiele/i,
  /biergarten/i,
  /kneipe/i,
  /bar\s*$/i,
  /pub\s*$/i,
  /wirtshaus/i,
  /brauhaus/i,
];

function classifyByName(name: string): ToiletCategory {
  if (PUBLIC_PATTERNS.some((p) => p.test(name))) return 'public_24h';
  if (STATION_PATTERNS.some((p) => p.test(name))) return 'station';
  if (GASTRO_PATTERNS.some((p) => p.test(name))) return 'gastro';
  return 'other';
}

// --- Overpass enrichment ---

// Use alternative Overpass instances if main one is overloaded
const OVERPASS_URLS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
];

interface OverpassElement {
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}

async function fetchOverpassToilets(): Promise<Map<string, OverpassElement>> {
  console.log('Fetching enrichment data from Overpass API (in chunks)...');

  const map = new Map<string, OverpassElement>();

  // Split into latitude bands (~3° each) to avoid timeouts
  // DACH region: lat 45.8-55.0, lon 5.9-17.2
  const bands = [
    { label: 'South (45-48)',  bbox: '45.0,5.5,48.0,17.5' },
    { label: 'Middle (48-51)', bbox: '48.0,5.5,51.0,17.5' },
    { label: 'North (51-55)',  bbox: '51.0,5.5,55.5,17.5' },
  ];

  for (const { label, bbox } of bands) {
    const query = `
      [out:json][timeout:90];
      (
        node["amenity"="toilets"]["wheelchair"="yes"](${bbox});
        node["amenity"="toilets"]["toilets:wheelchair"="yes"](${bbox});
      );
      out body;
    `;

    let fetched = false;
    for (const url of OVERPASS_URLS) {
      try {
        console.log(`  Fetching ${label} from ${new URL(url).host}...`);
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
        });

        if (!res.ok) {
          console.warn(`    ${res.status}, trying next...`);
          continue;
        }

        const data = await res.json();
        let count = 0;
        for (const el of data.elements) {
          const key = `${el.lat.toFixed(4)},${el.lon.toFixed(4)}`;
          map.set(key, el);
          count++;
        }
        console.log(`    ${count} toilets`);
        fetched = true;
        break;
      } catch (err) {
        console.warn(`    fetch failed, trying next...`);
      }
    }

    if (!fetched) console.warn(`  ${label}: all endpoints failed, skipping`);

    await sleep(3000);
  }

  console.log(`  Total OSM enrichment: ${map.size} unique locations`);
  return map;
}

function enrichFromOsm(toilet: ToiletEntry, osm: OverpassElement): void {
  const tags = osm.tags || {};

  if (tags.opening_hours) {
    toilet.opening_hours = tags.opening_hours;

    // Refine category based on actual opening_hours
    if (tags.opening_hours === '24/7') {
      if (toilet.category !== 'station') {
        toilet.category = 'public_24h';
      }
    }
  }

  if (tags.operator) toilet.operator = tags.operator;
  if (tags.fee) toilet.fee = tags.fee;

  // Refine category from OSM tags
  if (tags.access === 'yes' || tags.access === 'public') {
    if (!toilet.opening_hours || toilet.opening_hours === '24/7') {
      toilet.category = 'public_24h';
    }
  }

  if (tags.eurokey === 'yes' || tags.centralkey === 'yes') {
    toilet.tags.push('eurokey');
    if (!toilet.opening_hours || toilet.opening_hours === '24/7') {
      toilet.category = 'public_24h';
    }
  }
}

// --- Toilettenhero scraping ---

const CITIES_URL = 'https://toilettenhero.de/sitemap.xml';
const DATA_URL = (slug: string) => `https://toilettenhero.de/generated/data/${slug}.json`;

async function fetchCitySlugs(): Promise<string[]> {
  const res = await fetch(CITIES_URL);
  const xml = await res.text();
  const matches = xml.matchAll(/<loc>https:\/\/toilettenhero\.de\/([a-z0-9-]+)\/<\/loc>/g);
  return [...matches].map((m) => m[1]);
}

async function fetchCityData(slug: string): Promise<CityData | null> {
  try {
    const res = await fetch(DATA_URL(slug), {
      headers: { 'User-Agent': 'WC-Finder/1.0 (open-source toilet finder for wheelchair users)' },
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Main ---

async function main() {
  // Step 1: Fetch OSM enrichment data
  const osmMap = await fetchOverpassToilets();

  // Step 2: Scrape toilettenhero
  console.log('\nFetching city list from sitemap...');
  const slugs = await fetchCitySlugs();
  console.log(`Found ${slugs.length} cities`);

  const allToilets: ToiletEntry[] = [];
  const seenCoords = new Set<string>();
  let processed = 0;
  let enriched = 0;

  for (const slug of slugs) {
    const data = await fetchCityData(slug);
    processed++;

    if (!data?.d) continue;

    for (const entry of data.d) {
      const [lat, lon, name, type, _street, tagsStr] = entry;

      if (type !== 't') continue;

      const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
      if (!tags.includes('barrierefrei')) continue;

      const coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      const toilet: ToiletEntry = {
        id: `th_${coordKey.replace(',', '_')}`,
        lat,
        lon,
        name: name || 'Barrierefreie Toilette',
        city: data.s.n,
        category: classifyByName(name || ''),
        tags,
      };

      // Try to enrich from OSM (fuzzy match on 4 decimal places ~11m)
      const osmKey = `${lat.toFixed(4)},${lon.toFixed(4)}`;
      const osmData = osmMap.get(osmKey);
      if (osmData) {
        enrichFromOsm(toilet, osmData);
        enriched++;
      }

      allToilets.push(toilet);
    }

    if (processed % 50 === 0) {
      console.log(`  ${processed}/${slugs.length} cities, ${allToilets.length} toilets so far...`);
    }

    await sleep(50);
  }

  // Stats
  const categories = { public_24h: 0, station: 0, gastro: 0, other: 0 };
  for (const t of allToilets) categories[t.category]++;

  console.log(`\n--- Results ---`);
  console.log(`Total: ${allToilets.length} toilets`);
  console.log(`Enriched from OSM: ${enriched}`);
  console.log(`Categories:`);
  console.log(`  public_24h: ${categories.public_24h} (EU key, 24/7)`);
  console.log(`  station:    ${categories.station} (train stations, sanifair)`);
  console.log(`  gastro:     ${categories.gastro} (cafés, restaurants)`);
  console.log(`  other:      ${categories.other} (other/unclassified)`);

  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'toilettenhero.de + OpenStreetMap enrichment',
    count: allToilets.length,
    toilets: allToilets,
  };

  const fs = await import('fs');
  const path = await import('path');
  const { fileURLToPath } = await import('url');
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const outDir = path.join(__dirname, '..', 'src', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'toilets.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`\nSaved to src/data/toilets.json`);
}

main().catch(console.error);
