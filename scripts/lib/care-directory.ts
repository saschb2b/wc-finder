import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import type { Toilet, EquipmentStatus } from "../../src/types/toilet";
import type { StandardizedHours } from "../../src/types/opening-hours";
import { normalizeOpeningHours } from "../../src/utils/normalize-hours";

export const NATIONAL_URL = "https://www.toiletten-fuer-alle.de/wo-wie.html";
export const REGIONAL_URL = "https://toiletten-fuer-alle-niedersachsen.de/standorte/";
export type CareEntry = Toilet & { city: string; tags: string[]; care: NonNullable<Toilet["care"]> };
export const clean = (text: string) => text.replace(/\u00ad/g, "").replace(/\s+/g, " ").trim();
const text = (element: Element | null) => {
  const copy = element?.cloneNode(true) as Element | undefined;
  copy?.querySelectorAll("br, p, li, div").forEach(e => e.append(" "));
  return clean(copy?.textContent || "");
};
const dom = (html: string) => new JSDOM(html).window.document;

export function parseIndex(html: string) {
  const entries = [...dom(html).querySelectorAll("li.partner")].map(li => {
    const link = li.querySelector<HTMLAnchorElement>(".title a")!;
    const url = new URL(link.getAttribute("href")!, NATIONAL_URL);
    const id = url.searchParams.get("tx_datamintspartnerlist_list[partner]");
    assert(id && /^\d+$/.test(id), "National directory identity missing");
    return { id, url: url.href };
  });
  assert(entries.length > 0, "National directory is empty or changed format");
  return [...new Map(entries.map(e => [e.id, e])).values()];
}

export function equipment(text: string, kind: "bed" | "hoist"): EquipmentStatus {
  const term = kind === "bed" ? "(?:Pflege)?liege" : "(?:Personen|Stand|Decken)?lifter";
  if (new RegExp(`${term}[^.!?]{0,60}(?:außer Betrieb|defekt|nicht nutzbar)`, "i").test(text)) return "unavailable";
  if (new RegExp(`(?:ohne|kein(?:en|e)?)\\s+(?:(?:einen?|mobilen?|festen?|höhenverstellbaren?)\\s+){0,2}${term}`, "i").test(text)) return "absent";
  return new RegExp(term, "i").test(text) ? "available" : "unknown";
}

export function eurokey(text: string): boolean | null {
  if (/ohne (?:Euro.?WC.Schlüssel|Euro.?Schlüssel|speziellen Schlüssel)|kein.*Euro.*Schlüssel/i.test(text)) return false;
  return /Euro.?WC.Schlüssel|Euro.?Schlüssel|Euroschlüssel/i.test(text) ? true : null;
}

/** Only normalize explicit schedules; venue/event-dependent access stays unknown. */
export function careHours(raw: string): StandardizedHours {
  const unknown = { type: "unknown" as const, original: raw || undefined };
  if (/Veranstaltung|Spieltage|nach (?:Vereinbarung|Absprache)|Voranmeldung|außer Betrieb|geschlossen|nicht nutzbar|Schulferien|Rezeption/i.test(raw)) return unknown;
  if (/24\s*(?:Std\.?|Stunden)|rund um die Uhr|24\/7/i.test(raw)) return { type: "24_7" as const };
  let schedule = raw
    .replace(/Montag/gi, "Mo").replace(/Dienstag/gi, "Di").replace(/Mittwoch/gi, "Mi")
    .replace(/Donnerstag/gi, "Do").replace(/Freitag/gi, "Fr").replace(/Samstag/gi, "Sa")
    .replace(/Sonntag/gi, "So").replace(/Sonn-/gi, "So").replace(/Feiertage[n]?/gi, "PH")
    .replace(/(Mo|Di|Mi|Do|Fr|Sa|So)\./g, "$1").replace(/[–—]/g, "-")
    .replace(/(\d)\.(\d{2})/g, "$1:$2").replace(/\s+bis\s+/gi, "-")
    .replace(/\b(\d{1,2})\s*-\s*(\d{1,2})(?![:\d])/g, "$1:00-$2:00")
    .replace(/\s*Uhr\s*/gi, " ");
  const ranges = schedule.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g);
  if (!ranges?.length || /Apr|Mai|Jun|Jul|Aug|Sep|Okt|Nov|Dez|Jan|Feb|Mär|Sommer|Winter|Saison/i.test(schedule)) return unknown;
  if (!/\b(Mo|Di|Mi|Do|Fr|Sa|So)\b/.test(schedule)) {
    if (!/täglich|jeden Tag/i.test(schedule) && !/^\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*$/.test(schedule)) return unknown;
    schedule = `Mo-So ${ranges.join(",")}`;
  } else {
    // Extract day/schedule groups, excluding prose about building access.
    const groups = schedule.match(/(?:Mo|Di|Mi|Do|Fr|Sa|So)(?:\s*[-,+]\s*(?:Mo|Di|Mi|Do|Fr|Sa|So))*(?:\s*[:.]?\s*)\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})*/g);
    if (!groups || groups.reduce((n, g) => n + (g.match(/\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}/g)?.length || 0), 0) !== ranges.length) return unknown;
    schedule = groups.join("; ").replace(/(Mo|Di|Mi|Do|Fr|Sa|So)\s*:\s*/g, "$1 ").replace(/\+/g, ",");
  }
  return { ...normalizeOpeningHours(schedule), original: raw };
}

function sections(element: Element, headingSelector: string) {
  const result: Record<string, string> = {};
  let current = "";
  for (const child of element.children) {
    const value = text(child).replace(/:$/, "");
    if (child.matches(headingSelector) || /^(Öffnungszeiten|Zugang|Details)$/.test(value)) {
      current = value;
      result[current] = "";
    } else if (current) result[current] = clean(`${result[current]} ${text(child)}`);
  }
  return result;
}

export function makeCareEntry(input: {
  id: string; name: string; address: string; lat: number; lon: number;
  hours: string; access: string; details: string; sourceUrls: string[]; checkedAt: string;
}): CareEntry {
  assert(input.name && input.lat >= 45 && input.lat <= 56 && input.lon >= 2 && input.lon <= 17, `Invalid care location: ${input.id}`);
  const all = `${input.access} ${input.details}`;
  const bed = equipment(input.details, "bed");
  const hoist = equipment(`${input.name} ${input.details}`, "hoist");
  const key = eurokey(all);
  const hours = careHours(input.hours);
  const closed = /(?:derzeit|zur Zeit|vorübergehend).*(?:geschlossen|außer Betrieb|nicht nutzbar)/i.test(`${input.name} ${input.hours}`)
    && !/lifter/i.test(input.name);
  return {
    id: input.id, name: input.name, lat: input.lat, lon: input.lon,
    city: input.address.match(/\b\d{5}\s+(.+)$/)?.[1] || "",
    category: hours.type === "24_7" && !closed ? "public_24h" : "other",
    tags: ["barrierefrei", ...(hoist === "absent" ? ["pflegetoilette"] : ["toilette-fuer-alle"]),
      ...(bed === "available" ? ["pflegeliege"] : []), ...(key ? ["eurokey"] : [])],
    hours, opening_hours: hours.type === "24_7" ? "24/7" : input.hours,
    care: { bed, hoist, eurokey: key, access: input.access, hoursNote: input.hours,
      sourceId: input.id, sourceUrls: input.sourceUrls, checkedAt: input.checkedAt },
    ...(closed ? { availability: { status: "unavailable" as const, note: "Laut Verzeichnis derzeit nicht nutzbar" } } : {}),
  };
}

export function parseNational(html: string, id: string, url: string, checkedAt: string): CareEntry | null {
  const root = dom(html).querySelector(".showPartnerlist");
  assert(root, `Missing national profile ${id}`);
  const info = root.querySelector(".additionalcontent");
  assert(info, `Missing national profile details ${id}`);
  const s = sections(info, "h3");
  const [lat, lon] = text(root.querySelector(".coords")).split(";").map(Number);
  // Rental containers are directory contacts, not permanently usable map locations.
  if ((!lat && !lon) || /mobil.*(?:Container|Toilette)|(?:Container|Toilette).*mobil/i.test(text(root.querySelector("h1")))) return null;
  return makeCareEntry({ id: `tfa_de_${id}`, name: text(root.querySelector("h1")),
    address: text(root.querySelector(".address")), lat, lon, hours: s["Öffnungszeiten"] || "",
    access: s["Zugang"] || "", details: s["Details"] || "", sourceUrls: [url], checkedAt });
}

export function parseRegional(html: string) {
  return [...dom(html).querySelectorAll("table tr")].map(row => {
    const cells = row.querySelectorAll("td");
    assert(cells.length === 3, "Regional directory table changed");
    const fields: Record<string, string> = {};
    let current = "";
    // Headings appear both in paragraphs and as bare strong elements.
    for (const child of cells[2].children) {
      const heading = child.matches("strong") ? child : child.querySelector("strong");
      if (heading && /Öffnungszeiten|Lage|Ausstattung/.test(text(heading))) {
        current = text(heading).replace(/:$/, "");
        fields[current] = text(child).replace(text(heading), "").trim();
      } else if (current) fields[current] += ` ${text(child)}`;
    }
    return { name: text(cells[0].querySelector(".tfa-name")), address: text(cells[0]),
      hours: clean(fields["Öffnungszeiten"] || ""), access: clean(fields["Lage / Erreichbarkeit"] || ""),
      details: clean(fields["Ausstattung"] || "") };
  });
}

export function parseRegionalCoordinates(kml: string) {
  const doc = new JSDOM(kml, { contentType: "text/xml" }).window.document;
  return [...doc.querySelectorAll("Placemark")].map(p => {
    const [lon, lat] = text(p.querySelector("coordinates")).split(",").map(Number);
    return { name: text(p.querySelector("name")), lat, lon };
  });
}
