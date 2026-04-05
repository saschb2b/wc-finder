/**
 * Fetches "Toiletten für alle" locations from toiletten-fuer-alle-niedersachsen.de
 * These are premium fully-accessible toilets with care beds and lifts.
 *
 * Usage: npx tsx scripts/fetch-tfa.ts
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

interface TfaToilet {
  id: string;
  lat: number;
  lon: number;
  name: string;
  city: string;
  category: 'public_24h' | 'station';
  tags: string[];
  opening_hours?: string;
  operator?: string;
}

// Manually curated from toiletten-fuer-alle-niedersachsen.de/standorte/
// and toiletten-fuer-alle.de — these are verified premium accessible locations
const TFA_LOCATIONS: TfaToilet[] = [
  // Hannover
  {
    id: 'tfa_hannover_1',
    lat: 52.3725, lon: 9.7347,
    name: 'Beratungszentrum Inklusion',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    operator: 'Stadt Hannover',
  },
  {
    id: 'tfa_hannover_2',
    lat: 52.3879, lon: 9.7414,
    name: 'Erlebnis-Zoo Hannover',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    opening_hours: '09:00-18:00',
    operator: 'Erlebnis-Zoo Hannover',
  },
  {
    id: 'tfa_hannover_3',
    lat: 52.3769, lon: 9.7406,
    name: 'Ernst-August-Galerie',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    opening_hours: 'Mo-Sa 10:00-20:00',
    operator: 'Ernst-August-Galerie',
  },
  {
    id: 'tfa_hannover_4',
    lat: 52.3933, lon: 9.7441,
    name: 'Freizeitheim Vahrenwald',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    operator: 'Stadt Hannover',
  },
  {
    id: 'tfa_hannover_5',
    lat: 52.3600, lon: 9.7317,
    name: 'Heinz von Heiden Arena (HDI Arena)',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    operator: 'Hannover 96',
  },
  {
    id: 'tfa_hannover_6',
    lat: 52.3695, lon: 9.7412,
    name: 'Niedersächsischer Landtag',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    opening_hours: '24/7',
    operator: 'Niedersächsischer Landtag',
  },
  {
    id: 'tfa_hannover_7',
    lat: 52.3737, lon: 9.7458,
    name: 'VGH Versicherung',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    opening_hours: '24/7',
    operator: 'VGH Versicherungen',
  },
  {
    id: 'tfa_hannover_8',
    lat: 52.3221, lon: 9.8101,
    name: 'Messegelände Hannover (Halle 19/20)',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    operator: 'Deutsche Messe AG',
  },
  {
    id: 'tfa_hannover_9',
    lat: 52.3844, lon: 9.7804,
    name: 'Kulturhaus Hölderlin eins',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    operator: 'Stadt Hannover',
  },
  // Langenhagen (near Hannover)
  {
    id: 'tfa_langenhagen_1',
    lat: 52.4387, lon: 9.7393,
    name: 'Flughafen Hannover-Langenhagen',
    city: 'Langenhagen',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey', 'toilette-fuer-alle', 'pflegeliege'],
    opening_hours: '24/7',
    operator: 'Flughafen Hannover-Langenhagen GmbH',
  },

  // Hannover City PDF locations (key ones not likely in other sources)
  // Source: hannover.de Stadtentwässerung, "Öffentliche Toiletten 2018" PDF
  {
    id: 'haj_kroepke',
    lat: 52.3745, lon: 9.7385,
    name: 'Kröpcke (U-Bahn-Station)',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: 'Su-Th 06:00-22:00, Fr-Sa 06:00-02:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_marktkirche',
    lat: 52.3726, lon: 9.7333,
    name: 'Marktkirche (unterirdisch)',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: 'Su-Th 06:00-22:00, Fr-Sa 06:00-02:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_weissekreuz',
    lat: 52.3809, lon: 9.7483,
    name: 'Weißekreuzplatz',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: '06:00-23:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_lister',
    lat: 52.3851, lon: 9.7542,
    name: 'Lister Platz (U-Bahn)',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: '07:00-22:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_jahnplatz',
    lat: 52.3949, lon: 9.7310,
    name: 'Jahnplatz',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: 'Apr-Sep 08:00-20:00; Oct-Mar 09:00-16:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_schwarzer_baer',
    lat: 52.3699, lon: 9.7196,
    name: 'Schwarzer Bär',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: 'Apr-Sep 08:00-19:00; Oct-Mar 09:00-18:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_vahrenwalder',
    lat: 52.3989, lon: 9.7336,
    name: 'Vahrenwalder Platz',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: '07:00-22:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_steintor',
    lat: 52.3773, lon: 9.7335,
    name: 'Steintor',
    city: 'Hannover',
    category: 'public_24h',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: 'Su-Th 06:00-22:00, Fr-Sa 06:00-02:00',
    operator: 'Stadtentwässerung Hannover',
  },
  {
    id: 'haj_raschplatz',
    lat: 52.3791, lon: 9.7426,
    name: 'Raschplatz (Hauptbahnhof)',
    city: 'Hannover',
    category: 'station',
    tags: ['barrierefrei', 'eurokey'],
    opening_hours: '06:00-23:00',
    operator: 'Stadtentwässerung Hannover',
  },
];

async function main() {
  const output = {
    generated: new Date().toISOString().split('T')[0],
    source: 'Toiletten für alle + Stadt Hannover (manually curated)',
    count: TFA_LOCATIONS.length,
    toilets: TFA_LOCATIONS,
  };

  const outPath = path.join(__dirname, '..', 'src', 'data', 'tfa-toilets.json');
  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));

  console.log(`Saved ${TFA_LOCATIONS.length} curated toilets to src/data/tfa-toilets.json`);
  console.log(`  Hannover: ${TFA_LOCATIONS.filter((t) => t.city === 'Hannover').length}`);
  console.log(`  Other: ${TFA_LOCATIONS.filter((t) => t.city !== 'Hannover').length}`);
}

main().catch(console.error);
