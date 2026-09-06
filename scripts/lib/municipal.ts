import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import type { Toilet } from "../../src/types/toilet";
import { importHours } from "./import-hours";

export const municipalSources = [
  { id: "berlin", city: "Berlin", name: "Land Berlin – Öffentliche Toiletten", license: "dl-de-zero-2.0",
    page: "https://daten.berlin.de/datensaetze/offentliche-toiletten-wfs-ad2c0c24",
    url: "https://gdi.berlin.de/services/wfs/toiletten?service=WFS&version=2.0.0&request=GetFeature&typeNames=toiletten:toiletten&outputFormat=application/json&srsName=CRS:84" },
  { id: "hamburg", city: "Hamburg", name: "Freie und Hansestadt Hamburg – WC-Anlagen mit Trinkbrunnen", license: "dl-de-by-2.0",
    page: "https://api.hamburg.de/datasets/v1/wc_mit_trinkbrunnen/collections/wc_mit_trinkbrunnen?f=json",
    url: "https://api.hamburg.de/datasets/v1/wc_mit_trinkbrunnen/collections/wc_mit_trinkbrunnen/items?f=json&limit=1000" },
  { id: "rostock", city: "Rostock", name: "Hanse- und Universitätsstadt Rostock – Toiletten", license: "CC0-1.0",
    page: "https://www.opendata-hro.de/dataset/toiletten",
    url: "https://geo.sv.rostock.de/download/opendata/toiletten/toiletten.json" },
  { id: "oldenburg", city: "Oldenburg", name: "Stadt Oldenburg (Oldb) – Öffentliche Toiletten", license: "dl-de-by-2.0",
    page: "https://opendata.oldenburg.de/dataset/%C3%B6ffentliche-toiletten",
    url: "https://opendata.oldenburg.de/sites/default/files/E0504_oeffentliche-toiletten-oldenburg_0.geojson" },
  { id: "muenster", city: "Münster", name: "Stadt Münster – Öffentliche Toiletten", license: "dl-de-by-2.0",
    page: "https://opendata.stadt-muenster.de/dataset/%C3%B6ffentliche-toiletten",
    url: "https://www.stadt-muenster.de/ows/mapserv706/poiserv?REQUEST=GetFeature&SERVICE=WFS&VERSION=2.0.0&TYPENAME=ms:Toiletten&OUTPUTFORMAT=GEOJSON&EXCEPTIONS=XML&MAXFEATURES=1000&SRSNAME=EPSG:4326" },
] as const;
export type MunicipalSource = typeof municipalSources[number];
type Feature = { id?: string | number; type: string; properties: Record<string, unknown>; geometry: { type: string; coordinates: number[] } };
const str = (value: unknown) => typeof value === "string" ? value.trim() : "";
const yes = (value: unknown) => value === true || value === "ja";

function muensterHours(p: Record<string, unknown>): string {
  const days = ["MONTAG", "DIENSTAG", "MITTWOCH", "DONNERSTAG", "FREITAG", "SAMSTAG", "SONNTAG"];
  const codes = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
  return days.map((day, i) => {
    const hours = str(p[day]).replace(/(\d)\.(\d\d)/g, "$1:$2").replace(/\s*([-,:])\s*/g, "$1")
      .replace(/(^|\D)(\d):/g, (_match, prefix: string, hour: string) => `${prefix}0${hour}:`);
    return `${codes[i]} ${hours && hours !== "-" ? hours : "keine Angabe"}`;
  }).join("; ");
}

export function parseMunicipal(data: unknown, source: MunicipalSource, retrievedAt: string): Toilet[] {
  const collection = data as { type: string; features: Feature[]; numberMatched?: number; numberReturned?: number; links?: { rel: string }[] };
  assert(collection?.type === "FeatureCollection" && Array.isArray(collection.features) && collection.features.length > 0, `${source.id}: invalid/empty GeoJSON`);
  assert(!collection.links?.some(link => link.rel === "next"), `${source.id}: paginated response; refusing incomplete data`);
  if (collection.numberMatched !== undefined) assert.equal(collection.features.length, collection.numberMatched, `${source.id}: incomplete feature count`);
  if (collection.numberReturned !== undefined) assert.equal(collection.features.length, collection.numberReturned);
  if (source.id === "muenster") assert(collection.features.length < 1000, "Münster: response reached request limit; pagination required");
  const result: Toilet[] = [];
  for (const f of collection.features) {
    assert(f.type === "Feature" && f.properties && f.geometry?.type === "Point", `${source.id}: invalid point feature`);
    const [lon, lat] = f.geometry.coordinates;
    assert(Number.isFinite(lat) && Number.isFinite(lon) && lat > 47 && lat < 55.5 && lon > 5.5 && lon < 15.5, `${source.id}: expected WGS84 German coordinates`);
    const p = f.properties;
    const accessible = source.id === "muenster" ? p.BARRIEREFREI === "J"
      : source.id === "berlin" || source.id === "oldenburg" ? yes(p.barrierefrei) : yes(p.behindertengerecht);
    if (!accessible) continue;
    const rawHours = source.id === "muenster" ? muensterHours(p) : str(p.oeffnungszeiten || p.zeiten);
    if (/bei Veranstaltungen|während Trauerfeiern|nur während Betriebsablauf/i.test(rawHours)) continue;
    const hours = importHours(rawHours);
    const name = str(p.standort || p.NAME) || `Öffentliche Toilette (${str(p.art) || source.city})`;
    const address = str(p.adresse);
    // Oldenburg's row numbers are not durable IDs; use the venue/address instead.
    const id = source.id === "oldenburg" ? createHash("sha256").update(name + "|" + address).digest("hex").slice(0, 20)
      : p.uuid || p.LFDNR || f.id;
    assert(typeof id === "string" || typeof id === "number", `${source.id}: missing source ID`);
    const fee = source.id === "berlin" && typeof p.nutzungsentgelt === "number" ? p.nutzungsentgelt === 0 ? "no" : `${p.nutzungsentgelt} EUR`
      : source.id === "hamburg" ? yes(p.kostenlos) ? "no" : p.kostenlos === "nein" ? "yes" : undefined : undefined;
    const note = str(p.hinweis);
    result.push({ id: `municipal_${source.id}_${id}`, lat, lon, name, city: source.city, address: address || undefined,
      category: hours.type === "24_7" ? "public_24h" : "other", hours, opening_hours: rawHours || undefined,
      tags: ["barrierefrei", ...(fee === "no" ? ["kostenlos"] : []), ...(/Euroschl(uessel|üssel)/i.test(note) ? ["eurokey"] : [])],
      fee, operator: str(p.betreiber || p.bewirtschafter) || undefined, accessNote: note || undefined,
      sources: [{ id: `${source.id}/${id}`, name: source.name, url: source.page, license: source.license, retrievedAt }],
    });
  }
  assert(result.length > 0, `${source.id}: no accessible toilets; inspect schema before publishing`);
  assert(new Set(result.map(t => t.id)).size === result.length, `${source.id}: duplicate identities`);
  return result;
}
