/**
 * Fetches wheelchair-accessible toilet data from toilettenhero.de for all German cities.
 * Filters for "barrierefrei" (wheelchair accessible) toilets - these are the ones
 * that can be opened with a Euroschlüssel.
 *
 * Usage: npx tsx scripts/fetch-toilets.ts
 */

interface CityData {
  s: { n: string; t: number; lat: number; lon: number };
  d: [number, number, string, string, string, string][];
}

interface ToiletEntry {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  tags: string[];
}

const CITIES_URL = 'https://toilettenhero.de/sitemap.xml';
const DATA_URL = (slug: string) => `https://toilettenhero.de/generated/data/${slug}.json`;

async function fetchCitySlugs(): Promise<string[]> {
  const res = await fetch(CITIES_URL);
  const xml = await res.text();
  // Extract city slugs from sitemap URLs like https://toilettenhero.de/dortmund/
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

async function main() {
  console.log('Fetching city list from sitemap...');
  const slugs = await fetchCitySlugs();
  console.log(`Found ${slugs.length} cities`);

  const allToilets: ToiletEntry[] = [];
  const seenCoords = new Set<string>();
  let processed = 0;

  for (const slug of slugs) {
    const data = await fetchCityData(slug);
    processed++;

    if (!data?.d) {
      continue;
    }

    for (const entry of data.d) {
      const [lat, lon, name, type, _street, tagsStr] = entry;

      // Only toilets (type "t")
      if (type !== 't') continue;

      // Only wheelchair-accessible
      const tags = tagsStr ? tagsStr.split(',').map((t) => t.trim()).filter(Boolean) : [];
      if (!tags.includes('barrierefrei')) continue;

      // Deduplicate by coordinates (rounded to ~1m precision)
      const coordKey = `${lat.toFixed(5)},${lon.toFixed(5)}`;
      if (seenCoords.has(coordKey)) continue;
      seenCoords.add(coordKey);

      allToilets.push({
        id: `th_${coordKey.replace(',', '_')}`,
        lat,
        lon,
        name: name || 'Barrierefreie Toilette',
        city: data.s.n,
        tags,
      });
    }

    if (processed % 50 === 0) {
      console.log(`  ${processed}/${slugs.length} cities, ${allToilets.length} toilets so far...`);
    }

    // Be polite - small delay between requests
    await sleep(50);
  }

  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'toilettenhero.de (OpenStreetMap data)',
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

  console.log(`\nDone! ${allToilets.length} accessible toilets saved to src/data/toilets.json`);
}

main().catch(console.error);
