/**
 * Curated toilet data for major German cities
 * Adds key locations: train stations, hospitals, 24/7 McDonald's, shopping malls
 *
 * Usage: npx tsx scripts/fetch-major-cities.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Major cities with key accessible toilet locations
const MAJOR_CITIES = [
  // BERLIN
  { name: "Berlin Hauptbahnhof", lat: 52.5251, lon: 13.3694, city: "Berlin", category: "station" as const, hours: "24/7" },
  { name: "Berlin Ostbahnhof", lat: 52.5103, lon: 13.4346, city: "Berlin", category: "station" as const, hours: "24/7" },
  { name: "Berlin Südkreuz", lat: 52.4753, lon: 13.3656, city: "Berlin", category: "station" as const, hours: "24/7" },
  { name: "Berlin Gesundbrunnen", lat: 52.5489, lon: 13.3884, city: "Berlin", category: "station" as const, hours: "24/7" },
  { name: "Berlin Zoologischer Garten", lat: 52.5074, lon: 13.3324, city: "Berlin", category: "station" as const, hours: "24/7" },
  { name: "Charité Campus Mitte", lat: 52.5230, lon: 13.3760, city: "Berlin", category: "public_24h" as const, hours: "24/7" },
  { name: "Charité Campus Virchow", lat: 52.5440, lon: 13.3440, city: "Berlin", category: "public_24h" as const, hours: "24/7" },
  { name: "Unfallkrankenhaus Berlin", lat: 52.5580, lon: 13.4940, city: "Berlin", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Berlin Hbf (Eingangsebene)", lat: 52.5255, lon: 13.3690, city: "Berlin", category: "gastro" as const, hours: "24/7" },
  { name: "Alexa (Alexanderplatz)", lat: 52.5190, lon: 13.4140, city: "Berlin", category: "other" as const, hours: "10:00-21:00" },
  { name: "Mall of Berlin (Leipziger Platz)", lat: 52.5100, lon: 13.3760, city: "Berlin", category: "other" as const, hours: "10:00-21:00" },
  { name: "Gesundbrunnen-Center", lat: 52.5490, lon: 13.3900, city: "Berlin", category: "other" as const, hours: "10:00-21:00" },
  { name: "East Side Mall", lat: 52.5010, lon: 13.4420, city: "Berlin", category: "other" as const, hours: "10:00-21:00" },
  { name: "Ring-Center Frankfurter Allee", lat: 52.5150, lon: 13.4520, city: "Berlin", category: "other" as const, hours: "10:00-21:00" },
  { name: "Polizei Berlin Mitte", lat: 52.5200, lon: 13.4050, city: "Berlin", category: "public_24h" as const, hours: "24/7" },

  // HAMBURG
  { name: "Hamburg Hauptbahnhof", lat: 53.5527, lon: 10.0069, city: "Hamburg", category: "station" as const, hours: "24/7" },
  { name: "Hamburg-Altona", lat: 53.5511, lon: 9.9352, city: "Hamburg", category: "station" as const, hours: "24/7" },
  { name: "Hamburg-Harburg", lat: 53.4556, lon: 9.9917, city: "Hamburg", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Hamburg-Eppendorf", lat: 53.5910, lon: 9.9770, city: "Hamburg", category: "public_24h" as const, hours: "24/7" },
  { name: "Asklepios Klinik Altona", lat: 53.5520, lon: 9.9370, city: "Hamburg", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Hamburg Hbf", lat: 53.5530, lon: 10.0060, city: "Hamburg", category: "gastro" as const, hours: "24/7" },
  { name: "McDonald's Reeperbahn", lat: 53.5493, lon: 9.9626, city: "Hamburg", category: "gastro" as const, hours: "24/7" },
  { name: "Europa Passage (Jungfernstieg)", lat: 53.5510, lon: 9.9930, city: "Hamburg", category: "other" as const, hours: "10:00-21:00" },
  { name: "Hanse-Viertel", lat: 53.5570, lon: 9.9900, city: "Hamburg", category: "other" as const, hours: "10:00-20:00" },
  { name: "Phönix-Center Harburg", lat: 53.4600, lon: 9.9800, city: "Hamburg", category: "other" as const, hours: "09:30-20:00" },
  { name: "Polizei Hamburg Davidwache", lat: 52.4900, lon: 13.3870, city: "Hamburg", category: "public_24h" as const, hours: "24/7" },

  // MÜNCHEN
  { name: "München Hauptbahnhof", lat: 48.1402, lon: 11.5610, city: "München", category: "station" as const, hours: "24/7" },
  { name: "München Ostbahnhof", lat: 48.1275, lon: 11.6046, city: "München", category: "station" as const, hours: "24/7" },
  { name: "München Marienplatz (S-Bahn)", lat: 48.1373, lon: 11.5755, city: "München", category: "station" as const, hours: "24/7" },
  { name: "Klinikum München (LMU)", lat: 48.1360, lon: 11.5600, city: "München", category: "public_24h" as const, hours: "24/7" },
  { name: "Klinikum rechts der Isar (TUM)", lat: 48.1365, lon: 11.6000, city: "München", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's München Hbf", lat: 48.1405, lon: 11.5605, city: "München", category: "gastro" as const, hours: "24/7" },
  { name: "McDonald's Stachus", lat: 48.1391, lon: 11.5657, city: "München", category: "gastro" as const, hours: "06:00-24:00" },
  { name: "Olympia-Einkaufszentrum", lat: 48.1820, lon: 11.5300, city: "München", category: "other" as const, hours: "09:30-20:00" },
  { name: "Riem-Arcaden", lat: 48.1370, lon: 11.6900, city: "München", category: "other" as const, hours: "10:00-20:00" },
  { name: "PEP (Einkaufscenter)", lat: 48.1110, lon: 11.5300, city: "München", category: "other" as const, hours: "09:30-20:00" },

  // KÖLN
  { name: "Köln Hauptbahnhof", lat: 50.9430, lon: 6.9583, city: "Köln", category: "station" as const, hours: "24/7" },
  { name: "Köln Messe/Deutz", lat: 50.9410, lon: 6.9750, city: "Köln", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Köln", lat: 50.8780, lon: 6.9880, city: "Köln", category: "public_24h" as const, hours: "24/7" },
  { name: "Köln-Kalk McDonald's", lat: 50.9370, lon: 7.0250, city: "Köln", category: "gastro" as const, hours: "24/7" },
  { name: "McDonald's Köln Hbf", lat: 50.9435, lon: 6.9578, city: "Köln", category: "gastro" as const, hours: "24/7" },
  { name: "Rhein-Center Köln-Weiden", lat: 50.9800, lon: 6.9000, city: "Köln", category: "other" as const, hours: "10:00-20:00" },
  { name: "City-Center Chorweiler", lat: 51.0250, lon: 6.8950, city: "Köln", category: "other" as const, hours: "09:30-20:00" },
  { name: "Neumarkt Galerie", lat: 50.9370, lon: 6.9470, city: "Köln", category: "other" as const, hours: "10:00-20:00" },

  // FRANKFURT
  { name: "Frankfurt Hauptbahnhof", lat: 50.1071, lon: 8.6636, city: "Frankfurt", category: "station" as const, hours: "24/7" },
  { name: "Frankfurt Flughafen Fernbahnhof", lat: 50.0520, lon: 8.5700, city: "Frankfurt", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Frankfurt", lat: 50.0960, lon: 8.6570, city: "Frankfurt", category: "public_24h" as const, hours: "24/7" },
  { name: "Klinikum Frankfurt Höchst", lat: 50.1020, lon: 8.5450, city: "Frankfurt", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Frankfurt Hbf", lat: 50.1075, lon: 8.6630, city: "Frankfurt", category: "gastro" as const, hours: "24/7" },
  { name: "MyZeil (Zeil)", lat: 50.1145, lon: 8.6810, city: "Frankfurt", category: "other" as const, hours: "10:00-20:00" },
  { name: "Skyline Plaza", lat: 50.1100, lon: 8.6450, city: "Frankfurt", category: "other" as const, hours: "10:00-21:00" },
  { name: "Hessen-Center", lat: 50.1240, lon: 8.7180, city: "Frankfurt", category: "other" as const, hours: "09:30-20:00" },

  // STUTTGART
  { name: "Stuttgart Hauptbahnhof", lat: 48.7833, lon: 9.1803, city: "Stuttgart", category: "station" as const, hours: "24/7" },
  { name: "Stuttgart Flughafen/Messe", lat: 48.6900, lon: 9.1930, city: "Stuttgart", category: "station" as const, hours: "24/7" },
  { name: "Klinikum Stuttgart", lat: 48.7650, lon: 9.1710, city: "Stuttgart", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Stuttgart Hbf", lat: 48.7838, lon: 9.1798, city: "Stuttgart", category: "gastro" as const, hours: "24/7" },
  { name: "Milaneo", lat: 48.7910, lon: 9.1800, city: "Stuttgart", category: "other" as const, hours: "10:00-21:00" },
  { name: "Königsbau-Passagen", lat: 48.7790, lon: 9.1770, city: "Stuttgart", category: "other" as const, hours: "10:00-20:00" },
  { name: "Breuninger (Stadtmitte)", lat: 48.7750, lon: 9.1820, city: "Stuttgart", category: "other" as const, hours: "10:00-20:00" },

  // DÜSSELDORF
  { name: "Düsseldorf Hauptbahnhof", lat: 51.2198, lon: 6.7949, city: "Düsseldorf", category: "station" as const, hours: "24/7" },
  { name: "Düsseldorf Flughafen", lat: 51.2890, lon: 6.7660, city: "Düsseldorf", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Düsseldorf", lat: 51.1970, lon: 6.7940, city: "Düsseldorf", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Düsseldorf Hbf", lat: 51.2203, lon: 6.7945, city: "Düsseldorf", category: "gastro" as const, hours: "24/7" },
  { name: "Kö-Galerie", lat: 51.2260, lon: 6.7790, city: "Düsseldorf", category: "other" as const, hours: "10:00-20:00" },
  { name: "Schadow Arkaden", lat: 51.2250, lon: 6.7820, city: "Düsseldorf", category: "other" as const, hours: "10:00-20:00" },
  { name: "Düsseldorf Arcaden", lat: 51.2140, lon: 6.8120, city: "Düsseldorf", category: "other" as const, hours: "10:00-20:00" },

  // LEIPZIG
  { name: "Leipzig Hauptbahnhof", lat: 51.3455, lon: 12.3811, city: "Leipzig", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Leipzig", lat: 51.3260, lon: 12.3890, city: "Leipzig", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Leipzig Hbf", lat: 51.3460, lon: 12.3805, city: "Leipzig", category: "gastro" as const, hours: "24/7" },
  { name: "Paunsdorf-Center", lat: 51.3650, lon: 12.4200, city: "Leipzig", category: "other" as const, hours: "09:30-20:00" },
  { name: "Promenaden Hauptbahnhof", lat: 51.3450, lon: 12.3800, city: "Leipzig", category: "other" as const, hours: "06:00-23:00" },

  // DRESDEN
  { name: "Dresden Hauptbahnhof", lat: 51.0406, lon: 13.7325, city: "Dresden", category: "station" as const, hours: "24/7" },
  { name: "Dresden-Neustadt", lat: 51.0650, lon: 13.7400, city: "Dresden", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Dresden", lat: 51.0590, lon: 13.7810, city: "Dresden", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Dresden Hbf", lat: 51.0410, lon: 13.7320, city: "Dresden", category: "gastro" as const, hours: "24/7" },
  { name: "Centrum-Galerie", lat: 51.0480, lon: 13.7400, city: "Dresden", category: "other" as const, hours: "10:00-21:00" },
  { name: "Altmarkt-Galerie", lat: 51.0500, lon: 13.7350, city: "Dresden", category: "other" as const, hours: "10:00-21:00" },
  { name: "Elbepark", lat: 51.0700, lon: 13.7200, city: "Dresden", category: "other" as const, hours: "10:00-21:00" },

  // NÜRNBERG
  { name: "Nürnberg Hauptbahnhof", lat: 49.4456, lon: 11.0825, city: "Nürnberg", category: "station" as const, hours: "24/7" },
  { name: "Universitätsklinikum Erlangen", lat: 49.5980, lon: 11.0070, city: "Erlangen", category: "public_24h" as const, hours: "24/7" },
  { name: "Klinikum Nürnberg", lat: 49.4300, lon: 11.0800, city: "Nürnberg", category: "public_24h" as const, hours: "24/7" },
  { name: "McDonald's Nürnberg Hbf", lat: 49.4460, lon: 11.0820, city: "Nürnberg", category: "gastro" as const, hours: "24/7" },
  { name: "Nürnberg Arkaden", lat: 49.4490, lon: 11.0770, city: "Nürnberg", category: "other" as const, hours: "10:00-20:00" },
  { name: "Franken-Center", lat: 49.4590, lon: 11.0980, city: "Nürnberg", category: "other" as const, hours: "09:30-20:00" },
];

function main() {
  console.log('Generating major cities curated data...\n');

  const toilets = MAJOR_CITIES.map((loc, idx) => ({
    id: `major_city_${idx}_${loc.city.toLowerCase().substring(0, 3)}`,
    lat: loc.lat,
    lon: loc.lon,
    name: loc.name,
    city: loc.city,
    category: loc.category,
    tags: loc.category === 'public_24h' || loc.category === 'station' ? ['barrierefrei'] : [],
    opening_hours: loc.hours,
    operator: loc.name.split(' ')[0],
    fee: 'no',
  }));

  // Deduplicate by coordinates (50m radius)
  const unique: typeof toilets = [];
  const DEDUP_RADIUS = 0.0005;

  for (const t of toilets) {
    const isDuplicate = unique.some(
      u => Math.abs(u.lat - t.lat) < DEDUP_RADIUS && Math.abs(u.lon - t.lon) < DEDUP_RADIUS
    );
    if (!isDuplicate) {
      unique.push(t);
    }
  }

  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'Manual curation - Major German cities (stations, hospitals, malls)',
    count: unique.length,
    toilets: unique,
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'major-cities.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  // Stats
  const cities = [...new Set(unique.map(t => t.city))].sort();
  console.log(`Generated ${unique.length} locations across ${cities.length} cities:\n`);

  for (const city of cities) {
    const cityToilets = unique.filter(t => t.city === city);
    const public24h = cityToilets.filter(t => t.category === 'public_24h').length;
    const stations = cityToilets.filter(t => t.category === 'station').length;
    console.log(`${city}: ${cityToilets.length} (${public24h}×24/7, ${stations}×station)`);
  }

  console.log(`\nSaved to: ${outPath}`);
}

main();
