import { test } from "node:test";
import assert from "node:assert/strict";
import { osmToilet, accessibleToiletQuery, type OsmElement } from "./osm-toilets";
import { splitBbox } from "./osm-regions";
import { importHours } from "./import-hours";
import { municipalSources, parseMunicipal } from "./municipal";
import { parseNette } from "./nette-toilets";
import { parsePartnerExport, type PartnerExport } from "./partner-import";
import { mergeImported, canonicalOsmId, sameVenue } from "./merge-osm";
import type { Toilet } from "../../src/types/toilet";

const date = "2026-09-06T12:00:00Z";
const element = (tags: Record<string, string>, overrides: Partial<OsmElement> = {}): OsmElement => ({
  type: "node", id: 42, lat: 52, lon: 10, tags, ...overrides,
});
test("fetches typed geometry and venue WCs without inferring restroom access from entrances", () => {
  assert.match(accessibleToiletQuery("50,9,51,10"), /nwr\["toilets:wheelchair"="yes"\]/);
  assert.equal(osmToilet(element({ amenity: "library", wheelchair: "yes" }), date, date), undefined);
  const toilet = osmToilet(element({ amenity: "library", name: "Library", "toilets:wheelchair": "yes" },
    { type: "way", center: { lat: 52.1, lon: 10.1 } }), date, date)!;
  assert.equal(toilet.id, "osm_way_42");
  assert.equal(toilet.lat, 52.1);
  assert(toilet.locationNote && toilet.accessNote && toilet.sources?.[0].license);
  assert.equal(osmToilet(element({ "toilets:wheelchair": "yes" },
    { type: "way", center: { lat: 44.999, lon: 10 } }), date, date), undefined);
});
test("keeps restricted, unavailable and non-public venue bathrooms out", () => {
  const cases: Record<string, string>[] = [
    { access: "private" }, { "toilets:access": "employees" }, { toilets: "no" },
    { "toilets:wheelchair": "no" }, { "disused:amenity": "toilets" },
    { amenity: "school" }, { tourism: "hotel" }, { healthcare: "doctor" }, { type: "route", route: "train" },
  ];
  for (const tags of cases) assert.equal(osmToilet(element({ "toilets:wheelchair": "yes", ...tags }), date, date), undefined);
  const keyOnly = osmToilet(element({ amenity: "toilets", centralkey: "eurokey" }), date, date)!;
  assert.deepEqual(keyOnly.tags, ["eurokey"]);
  assert.equal(osmToilet(element({ amenity: "parking", centralkey: "eurokey" }), date, date), undefined);
});
test("preserves customer access and does not claim venue admission is a toilet fee", () => {
  const t = osmToilet(element({ amenity: "restaurant", "toilets:wheelchair": "yes", access: "customers", fee: "no", opening_hours: "24/7" }), date, date)!;
  assert.equal(t.fee, undefined);
  assert.equal(t.category, "gastro");
  assert.match(t.accessNote!, /Kunden/);
});
test("seasonal, holiday exceptions and event-only hours never become false open-now schedules", () => {
  for (const hours of [undefined, "Juni-Sep: 24/7", "Apr-Sep 08:00-20:00", "bei Veranstaltungen", "Mo-Fr 08:00-18:00; PH off", "Mo 08:00-12:00 garbage"])
    assert.equal(importHours(hours).type, "unknown");
  assert.equal(importHours("24h").type, "24_7");
  assert.equal(importHours("Mo-Fr 08:00-18:00\nSa 09:00-12:00").type, "weekly");
});
const feature = (properties: Record<string, unknown>, id = 1) => ({ type: "Feature", id,
  geometry: { type: "Point", coordinates: [13.4, 52.5] }, properties });
test("municipal imports require explicit accessibility and complete WGS84 feeds", () => {
  const data = { type: "FeatureCollection", features: [feature({ barrierefrei: "ja", standort: "WC", oeffnungszeiten: "24h", nutzungsentgelt: 0 }),
    feature({ barrierearm: "ja", barrierefrei: "nein" }, 2), feature({ standort: "Unknown" }, 3)] };
  const rows = parseMunicipal(data, municipalSources[0], date);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hours?.type, "24_7");
  assert(rows[0].tags?.includes("kostenlos"));
  assert.throws(() => parseMunicipal({ ...data, numberMatched: 5 }, municipalSources[0], date), /incomplete/);
  assert.throws(() => parseMunicipal({ ...data, links: [{ rel: "next" }] }, municipalSources[0], date), /paginated/);
  assert.throws(() => parseMunicipal({ ...data, features: [{ ...data.features[0], geometry: { type: "Point", coordinates: [565400, 5937800] } }] }, municipalSources[0], date), /WGS84/);
});
test("Oldenburg stable identities survive source row renumbering; free access is not assumed", () => {
  const p = { barrierefrei: "ja", standort: "Library", adresse: "Street 1" };
  const parse = (id: number) => parseMunicipal({ type: "FeatureCollection", features: [feature(p, id)] }, municipalSources[3], date)[0];
  assert.equal(parse(1).id, parse(99).id);
  assert.equal(parse(1).fee, undefined);
});

test("Münster requires an affirmative WC flag and preserves unspecified weekdays", () => {
  const p = { LFDNR: 1, NAME: "Public WC", BARRIEREFREI: "J", MONTAG: "9:00 - 18:30",
    DIENSTAG: "9:00-18:30", MITTWOCH: "9:00-18:30", DONNERSTAG: "9:00-18:30",
    FREITAG: "9:00-18:30", SAMSTAG: "9:00-18:30", SONNTAG: "9:00-18:30" };
  const parse = (properties: Record<string, unknown>) => parseMunicipal({ type: "FeatureCollection", features: [feature(properties)] }, municipalSources[4], date)[0];
  assert.equal(parse(p).hours?.type, "weekly");
  assert.equal(parse({ ...p, SONNTAG: "" }).hours?.type, "unknown");
  assert.match(parse({ ...p, SONNTAG: "-" }).hours?.original || "", /So keine Angabe/);
  assert.throws(() => parse({ ...p, BARRIEREFREI: "N" }), /no accessible/);
});
test("Nette review uses the actual accessibility flag and marks stale names", () => {
  const rows = parseNette([{ i: 1, oid: 1, b: "Ehemalige Toilette", z: "1", lat: "52", lng: "10" },
    { i: 2, oid: 1, b: "No flag", z: "0" }], [{ oid: 1, n: "City" }]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].needsStatusReview, true);
  assert.equal(rows[0].country, "unverified");
});
test("partner exports require reuse evidence and WC-specific accessibility", () => {
  const data: PartnerExport = { source: { id: "network", name: "Network", url: "https://example.org", license: "CC0-1.0",
    permissionReference: "https://example.org/license", retrievedAt: date },
  toilets: [{ id: "1", name: "WC", lat: 52, lon: 10, country: "DE", wheelchairToilet: true, access: "public", bed: true }] };
  const rows = parsePartnerExport(data);
  assert.equal(rows[0].care?.hoist, "unknown");
  assert.equal(rows[0].care?.eurokey, null);
  assert.throws(() => parsePartnerExport({ ...data, source: { ...data.source, permissionReference: "" } }));
  assert.deepEqual(parsePartnerExport({ ...data, toilets: [{ ...data.toilets[0], access: "private" }] }), []);
});
test("distinct neighbouring venues survive; matched source identity preserves favourites on refresh", () => {
  const old: Toilet = { id: "favorite", name: "Library", lat: 52, lon: 10, category: "other" };
  const incoming = (id: string, name: string): Toilet => ({ ...old, id, name, sources: [{ id, name: "Source", url: "https://example.org", license: "CC0", retrievedAt: date }] });
  const result = mergeImported([old], [incoming("partner_a", "Library"), incoming("partner_b", "Museum")]);
  assert.deepEqual(result.map(t => t.id), ["favorite", "partner_b"]);
  assert.equal(old.sources, undefined);
  const refreshed = mergeImported(result, [{ ...incoming("partner_a", "New library name"), opening_hours: "24/7" }]);
  assert.equal(refreshed[0].id, "favorite");
  assert.equal(refreshed[0].name, "Library");
  assert.equal(refreshed[0].hours, undefined);
  assert.equal(refreshed.length, result.length);
});
test("bbox subdivision covers the full parent with shared boundaries", () => {
  assert.deepEqual(splitBbox("50,5,52,15"), ["50,5,52,10", "50,10,52,15"]);
  assert.deepEqual(splitBbox("50,9,54,10"), ["50,9,52,10", "52,9,54,10"]);
});

test("multiple source aliases stay attached to one curated favourite across repeat imports", () => {
  const favorite: Toilet = { id: "saved-library", name: "Library", lat: 52, lon: 10, category: "other" };
  const fresh = ["osm_node_1", "osm_way_2"].map((id, index): Toilet => ({ ...favorite, id, lat: 52 + index * .0002,
    sources: [{ id, name: "OpenStreetMap", url: "https://www.openstreetmap.org", license: "ODbL-1.0", retrievedAt: date }] }));
  const first = mergeImported([favorite], fresh);
  assert.equal(first.length, 1);
  assert.equal(first[0].sources?.length, 2);
  assert.deepEqual(mergeImported(first, fresh), first);
  assert.equal(mergeImported(first, fresh.map(t => ({ ...t, name: "Renamed library" }))).length, 1);
});

test("legacy source identities reconcile even if names or coordinates changed", () => {
  for (const id of ["sanifair_node_42", "station_node_42", "fuel_42", "hbiz_42", "biz_42", "osm_fuel_42", "osm_mall_42"])
    assert.equal(canonicalOsmId(id), "osm_node_42");
  assert.equal(canonicalOsmId("station_way_42"), "osm_way_42");
  assert.equal(canonicalOsmId("mall_42"), "mall_42");
  const old: Toilet = { id: "sanifair_node_42", name: "Sanifair WC", lat: 52, lon: 10, category: "station" };
  const fresh: Toilet = { ...old, id: "osm_node_42", name: "WC", lat: 52.001 };
  const result = mergeImported([old], [fresh]);
  assert.equal(result.length, 1);
  assert.equal(result[0].id, old.id);
  assert.equal(result[0].lat, fresh.lat);
  assert.deepEqual(mergeImported(result, [fresh]), result);
});

test("city suffixes match only very close venues without conflicting addresses", () => {
  const a: Toilet = { id: "a", name: "Katzentempel", city: "Bremen", lat: 53, lon: 8, category: "gastro" };
  assert(sameVenue(a, { ...a, id: "b", name: "Katzentempel Bremen", lat: 53.00002 }));
  assert(!sameVenue(a, { ...a, name: "Katzentempel Bremen", lat: 53.001 }));
  assert(!sameVenue({ ...a, address: "Street 1" }, { ...a, name: "Katzentempel Bremen", address: "Street 2" }));
  assert(!sameVenue(a, { ...a, name: "Katzentempel Bistro Bremen" }));
  assert(!sameVenue({ ...a, name: "Toilette" }, { ...a, name: "Toilette Bremen" }));
  assert(!sameVenue({ ...a, name: "Barrierefreie Toilette" }, { ...a, name: "Barrierefreie Toilette" }));
});

test("a conflicting secondary source reference cannot collapse distinct OSM toilets", () => {
  const source = (id: number) => ({ id: `osm/node/${id}`, name: "OpenStreetMap", url: `https://www.openstreetmap.org/node/${id}`, license: "ODbL-1.0", retrievedAt: date });
  const old: Toilet = { id: "sanifair_node_42", name: "Barrierefreie Toilette", lat: 52, lon: 10, category: "other", sources: [source(42)] };
  const fresh: Toilet = { ...old, id: "osm_node_99", sources: [source(99), source(42)] };
  const result = mergeImported([old], [fresh]);
  assert.deepEqual(result.map(t => t.id), ["sanifair_node_42", "osm_node_99"]);
  assert.deepEqual(result[1].sources, [source(99)]);
  assert.deepEqual(mergeImported(result, [fresh]), result);
});
