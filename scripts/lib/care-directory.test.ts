import { test } from "node:test";
import assert from "node:assert/strict";
import { equipment, eurokey, careHours, makeCareEntry, parseNational, parseRegional } from "./care-directory";
import { mergeCare } from "./merge-care";
import { eventToilets, type EventLocation } from "./event-toilets";
import eventData from "../../src/data/event-toilets.json";

test("equipment distinguishes missing hoists from beds without side rails", () => {
  assert.equal(equipment("höhenverstellbare Pflegeliege ohne Seitengitter Standlifter", "hoist"), "available");
  assert.equal(equipment("Pflegeliege Hinweis: ohne Lifter", "hoist"), "absent");
  assert.equal(equipment("Deckenlifter - derzeit defekt", "hoist"), "unavailable");
  assert.equal(equipment("nicht höhenverstellbare Pflegeliege", "bed"), "available");
  assert.equal(equipment("Rollstuhlgerechte Toilette", "bed"), "unknown");
  assert.equal(eurokey("ohne speziellen Schlüssel zugänglich"), false);
  assert.equal(eurokey("Mit Euro-WC-Schlüssel"), true);
  assert.equal(eurokey("Schlüssel beim Personal"), null);
});

test("hours retain uncertainty for events, seasonal exceptions and venue-only schedules", () => {
  assert.equal(careHours("24 Std. täglich ganzjährig").type, "24_7");
  const weekly = careHours("Mo.-Fr.: 8.00–22.30 Uhr Sa.+So.: 10.00–18.00 Uhr");
  assert.equal(weekly.type, "weekly");
  assert.deepEqual(weekly.weekly?.[1].periods, [{ open: 480, close: 1350 }]);
  assert.deepEqual(weekly.weekly?.[0].periods, [{ open: 600, close: 1080 }]);
  for (const raw of ["Während der Spiele und Veranstaltungen", "Während der Öffnungszeiten des Zoos",
    "Mo-Fr 09:00-18:00, in den Schulferien 09:00-14:00", "täglich bis zur Dämmerung", "zur Zeit nicht nutzbar!"]) {
    assert.equal(careHours(raw).type, "unknown", raw);
  }
});

test("profiles support paragraph headings and never map mobile rental contacts", () => {
  const html = `<div class="showPartnerlist"><h1>Testhaus</h1><div class="address">Straße 1<br>30159 Hannover</div>
    <div class="coords">52.37;9.73</div><div class="additionalcontent"><h3>Öffnungszeiten</h3><p>24 Std. täglich</p>
    <p>Zugang</p><p>ohne speziellen Schlüssel</p><p>Details</p><ul><li>Pflegeliege</li><li>Standlifter</li></ul></div></div>`;
  const t = parseNational(html, "1", "https://example.org/1", "2026-09-06")!;
  assert.equal(t.city, "Hannover");
  assert.equal(t.care.hoist, "available");
  assert.equal(t.care.eurokey, false);
  assert.equal(parseNational(html.replace("Testhaus", "Mobile Toilette"), "1", "https://example.org/1", "2026-09-06"), null);
  assert.equal(parseNational(html.replace("52.37;9.73", "0.000000;0.000000"), "1", "https://example.org/1", "2026-09-06"), null);
});

test("regional line breaks keep equipment negation separate", () => {
  const [row] = parseRegional(`<table><tr><td><span class="tfa-name">Zoo</span><br>30159 Hannover</td><td></td>
    <td><p><strong>Öffnungszeiten:</strong><br>Mo-Fr 09:00-17:00</p><p><strong>Lage / Erreichbarkeit:</strong><br>EG</p>
    <p><strong>Ausstattung:</strong><br>Pflegeliege ohne Seitengitter<br>Standlifter</p></td></tr></table>`);
  assert.equal(row.access, "EG");
  assert.equal(equipment(row.details, "hoist"), "available");
});

test("specialist overlay preserves favorites, corrects assumptions and is repeatable", () => {
  const entry = makeCareEntry({ id: "tfa_de_1", name: "Testhaus", address: "30159 Hannover", lat: 52.37, lon: 9.73,
    hours: "Bei Veranstaltungen", access: "ohne speziellen Schlüssel", details: "Pflegeliege, ohne Lifter",
    sourceUrls: ["https://example.org/1"], checkedAt: "2026-09-06" });
  const existing = { ...entry, id: "saved_id", lat: 52.3701, care: undefined, category: "public_24h" as const,
    tags: ["eurokey", "lifter"], hours: { type: "24_7" as const } };
  const nearby = { ...existing, id: "different_venue", name: "Different venue" };
  const merged = mergeCare([existing, nearby], [entry]);
  assert.equal(merged.length, 2);
  assert.equal(merged[0].id, "saved_id");
  assert.equal(merged[0].lat, entry.lat);
  assert.equal(merged[0].hours?.type, "unknown");
  assert.equal(merged[0].tags?.includes("eurokey"), false);
  assert.deepEqual(merged[1], nearby);
  assert.deepEqual(mergeCare(merged, [entry]), merged);
  const secondRoom = { ...entry, id: "tfa_de_2", care: { ...entry.care, sourceId: "tfa_de_2" } };
  assert.equal(mergeCare([entry], [secondRoom]).length, 2, "Different directory profiles can be separate rooms at the same venue");
});

test("festival archive needs verified coordinates and finite dates before appearing on map", () => {
  const events = eventData.events as EventLocation[];
  assert.equal(eventToilets(events).length, 0);
  const located = { ...events[0], coordinates: { lat: 52.36, lon: 9.73 } };
  const [entry] = eventToilets([located]);
  assert.equal(entry.availability?.through, "2026-08-09");
  assert.equal(entry.care?.hoist, "unknown");
  assert.equal(entry.hours?.type, "unknown");
  assert.throws(() => eventToilets([{ ...located, availability: {} }]));
  assert.throws(() => eventToilets([{ ...located, availability: { from: "2026-02-30", through: "2026-08-09" } }]));
});
