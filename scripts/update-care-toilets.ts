/** Refresh specialist directories, then rebuild offline tiles. Use --cached to replay downloads. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";
import { NATIONAL_URL, REGIONAL_URL, parseIndex, parseNational, parseRegional,
  parseRegionalCoordinates, makeCareEntry, type CareEntry } from "./lib/care-directory";
import { mergeCare } from "./lib/merge-care";
import { eventToilets, type EventLocation } from "./lib/event-toilets";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const cache = path.join(root, ".expo/care-toilets");
const dataDir = path.join(root, "src/data");
const cached = process.argv.includes("--cached");
const kmlUrl = "https://www.google.com/maps/d/kml?mid=1zh1bG-niuSnZ6JUZ7LD6yDasxCXvh1OP&forcekml=1";
const checkedAt = new Date().toISOString().slice(0, 10);

async function download(url: string, filename: string) {
  const target = path.join(cache, filename);
  if (cached) return fs.readFileSync(target, "utf8");
  const response = await fetch(url, { signal: AbortSignal.timeout(30000) });
  assert(response.ok, `${url}: HTTP ${response.status}`);
  const body = await response.text();
  fs.writeFileSync(target, body);
  return body;
}

// Explicit cross-directory identities; coordinates from the national toilet profile
// take precedence over regional venue/entrance markers. Names are checked below.
const regionalMapping: [string, string, string, string?][] = [
  ["Jod-Sole-Therme", "192", "Bad Bevensen, Jod-Sole-Therme"],
  ["Kurhaus Bad Nenndorf", "243", "Kurhaus Bad Nenndorf"],
  ["BraWo Park Business Center III", "233", "BraWo Park Braunschweig"],
  ["Modehaus Stackmann", "ni_stackmann", "Buxtehude, Modehaus Stackmann"],
  ["Stadt Celle", "202", "Celle Altstadt, Neue Str. 2"],
  ["Beratungszentrum Inklusion", "63", "Hannover, Beratungszentrum Inklusion", "tfa_hannover_1"],
  ["Erlebnis-Zoo Hannover", "125", "Hannover, Erlebnis-Zoo Hannover", "tfa_hannover_2"],
  ["Ernst-August-Galerie in Hannover", "ni_eag", "Hannover, Ernst-August-Galerie", "tfa_hannover_3"],
  ["Freizeitheim Hannover Vahrenwald", "84", "Hannover, Freizeitheim Vahrenwald", "tfa_hannover_4"],
  ["Heinz von Heiden Arena Hannover", "188", "Hannover, Heinz von Heiden Arena", "tfa_hannover_5"],
  ["Niedersächsischer Landtag", "68", "Hannover, Landtag Niedersachsen", "tfa_hannover_6"],
  ["VGH Versicherung Hannover", "89", "Hannover, VGH Versicherungen", "tfa_hannover_7"],
  ["Messegelände Hannover", "232", "Hannover Messegelände, Halle 19/20", "tfa_hannover_8"],
  ["Kulturhaus Hölderlin eins", "216", "Hannover, Kulturhaus Hölderlin eins", "tfa_hannover_9"],
  ["Haus der Jugend Langenhagen", "221", "Haus der Jugend Langenhagen"],
  ["Rathaus Neustadt a. Rbge.", "211", "Rathaus Neustadt am Rübenberge"],
  ["Tierpark Nordhorn", "133", "Tierpark Nordhorn"],
  ["Schlaues Haus", "33", "Oldenburg, Schlaues Haus Oldenburg gemeinnützige GmbH"],
  ["StadtGalerie Café und Contor", "169", "Osnabrück, StadtGalerie Café und Contor"],
  ["Zoo Osnabrück", "ni_zoo_osnabrueck", "Osnabrück, Zoo Osnabrück"],
  ["Bahnhof Salzgitter-Lebenstedt", "ni_salzgitter", "Salzgitter-Lebenstedt Bahnhofsplatz 1"],
  ["Heide Park Resort", "106", "Soltau, Heide Park Resort"],
  ["Autostadt Wolfsburg", "185", "Autostadt Wolfsburg"],
  ["Wolfsburg Allerpark", "ni_allerpark", "Allerpark Wolfsburg"],
];

async function main() {
  fs.mkdirSync(cache, { recursive: true });
  const index = parseIndex(await download(NATIONAL_URL, "national.html"));
  const entries: CareEntry[] = [];
  const excluded: { id: string; url: string; reason: string }[] = [];
  let next = 0;
  await Promise.all([0, 1].map(async () => {
    while (next < index.length) {
      const profile = index[next++];
      const entry = parseNational(await download(profile.url, `partner-${profile.id}.html`), profile.id, profile.url, checkedAt);
      if (entry) entries.push(entry);
      else excluded.push({ ...profile, reason: "Mobile rental facility or no fixed coordinates" });
      if (!cached) await new Promise(resolve => setTimeout(resolve, 150));
    }
  }));
  const regional = parseRegional(await download(REGIONAL_URL, "niedersachsen.html"));
  const coordinates = parseRegionalCoordinates(await download(kmlUrl, "niedersachsen.kml"));
  assert(regional.length === regionalMapping.length, "Regional locations changed: review identity mapping before publishing");
  for (const [name, nationalId, pointName, legacyId] of regionalMapping) {
    const row = regional.find(r => r.name === name);
    assert(row, `Missing regional location ${name}`);
    const sourceId = nationalId.startsWith("ni_") ? `tfa_${nationalId}` : `tfa_de_${nationalId}`;
    const previous = entries.find(e => e.care.sourceId === sourceId);
    assert(previous || nationalId.startsWith("ni_"), `Missing national match ${name}`);
    const point = previous || coordinates.find(c => c.name === pointName);
    assert(point, `Missing regional coordinates ${pointName}`);
    const entry = makeCareEntry({ ...row, id: sourceId, lat: point.lat, lon: point.lon,
      sourceUrls: [...(previous?.care.sourceUrls || []), REGIONAL_URL], checkedAt });
    if (previous) {
      entry.name = previous.name;
      entry.city = previous.city;
      // A regional omission is not evidence that access no longer needs a key.
      if (entry.care.eurokey === null) entry.care.eurokey = previous.care.eurokey;
      if (!entry.care.access) entry.care.access = previous.care.access;
      if (!entry.availability && previous.availability) entry.availability = previous.availability;
      entries.splice(entries.indexOf(previous), 1);
    } else entry.city = ({ ni_eag: "Hannover", ni_stackmann: "Buxtehude", ni_zoo_osnabrueck: "Osnabrück",
      ni_salzgitter: "Salzgitter-Lebenstedt", ni_allerpark: "Wolfsburg" } as Record<string, string>)[nationalId];
    entry.tags = entry.tags.filter(t => t !== "eurokey");
    if (entry.care.eurokey) entry.tags.push("eurokey");
    if (legacyId) entry.id = legacyId;
    entries.push(entry);
  }
  entries.sort((a, b) => a.id.localeCompare(b.id));
  assert(new Set(entries.map(e => e.id)).size === entries.length);
  const events: { events: EventLocation[] } = JSON.parse(fs.readFileSync(path.join(dataDir, "event-toilets.json"), "utf8"));
  const locatedEvents = eventToilets(events.events);
  const source = { checkedAt, source: [NATIONAL_URL, REGIONAL_URL], nationalProfiles: index.length,
    regionalProfiles: regional.length, excluded: excluded.sort((a, b) => a.id.localeCompare(b.id)),
    pendingEventIds: events.events.filter(e => !e.coordinates).map(e => e.id),
    count: entries.length + locatedEvents.length, toilets: [...entries, ...locatedEvents] };
  const target = path.join(dataDir, "toilets.json");
  const dataset = JSON.parse(fs.readFileSync(target, "utf8"));
  const before = dataset.toilets.length;
  dataset.toilets = mergeCare(dataset.toilets, source.toilets);
  dataset.count = dataset.toilets.length;
  dataset.specialistUpdate = { checkedAt, count: entries.length, source: source.source };
  fs.writeFileSync(path.join(dataDir, "care-toilets.json"), JSON.stringify(source, null, 2));
  fs.writeFileSync(target, JSON.stringify(dataset, null, 2));
  console.log(JSON.stringify({ imported: entries.length, excluded: excluded.length, added: dataset.count - before }, null, 2));
  await import("./split-tiles");
  await import("./gen-tile-loader");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
