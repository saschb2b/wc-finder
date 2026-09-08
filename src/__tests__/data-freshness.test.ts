import type { Toilet } from "../types/toilet";
import { lastChecked, lastCheckedLabel, lastCheckedShort, freshnessTone, relativeAge, UNKNOWN_LABEL } from "../utils/data-freshness";

const now = new Date("2026-09-08T10:00:00Z");
const base: Toilet = { id: "t", name: "WC", lat: 52, lon: 9, category: "other" };
const osm = { id: "osm/node/1", name: "OpenStreetMap", url: "https://osm.org/node/1", license: "ODbL-1.0",
  retrievedAt: "2026-09-06T14:51:45Z", updatedAt: "2026-09-06T14:49:01Z" };

test("prefers on-site confirmation over directory checks, source edits and downloads", () => {
  const care: Toilet["care"] = { bed: "available", hoist: "absent", eurokey: null, sourceId: "x", sourceUrls: [], checkedAt: "2026-03-12" };
  expect(lastChecked({ ...base, verifiedAt: "2026-08-01", care, sources: [osm] })).toEqual({ date: "2026-08-01", kind: "verified" });
  expect(lastChecked({ ...base, care, sources: [osm] })).toEqual({ date: "2026-03-12", kind: "checked" });
  expect(lastChecked({ ...base, sources: [{ ...osm, editedAt: "2024-11-20T08:00:00Z" }] })).toEqual({ date: "2024-11-20", kind: "edited" });
  expect(lastChecked({ ...base, sources: [osm] })).toEqual({ date: "2026-09-06", kind: "retrieved" });
  expect(lastChecked(base)).toBeNull();
});

test("a database snapshot time is never presented as a check", () => {
  expect(lastCheckedLabel({ ...base, sources: [osm] }, now)).toBe("Datenstand: 06.09.2026 (vor 2 Tagen)");
  expect(lastCheckedLabel({ ...base, sources: [{ ...osm, editedAt: "2024-11-20T08:00:00Z" }] }, now))
    .toBe("In OpenStreetMap bearbeitet: 20.11.2024 (vor 1 Jahr)");
  expect(lastCheckedLabel({ ...base, verifiedAt: "2026-09-08" }, now)).toBe("Vor Ort bestätigt: 08.09.2026 (heute)");
  expect(lastCheckedLabel(base, now)).toBe(UNKNOWN_LABEL);
  expect(lastCheckedShort({ ...base, verifiedAt: "2026-06-01" }, now)).toBe("Bestätigt vor 3 Monaten");
  expect(lastCheckedShort(base, now)).toBe(UNKNOWN_LABEL);
});

test("ignores malformed dates and uses the newest of several sources", () => {
  expect(lastChecked({ ...base, verifiedAt: "soon", sources: [{ ...osm, editedAt: "2023-01-01" }, { ...osm, id: "b", editedAt: "2025-05-05" }] }))
    .toEqual({ date: "2025-05-05", kind: "edited" });
});

test("relative ages and freshness tone", () => {
  expect(relativeAge("2026-09-07", now)).toBe("gestern");
  expect(relativeAge("2026-08-20", now)).toBe("vor 19 Tagen");
  expect(relativeAge("2026-08-07", now)).toBe("vor 1 Monat");
  expect(relativeAge("2026-08-09", now)).toBe("vor 4 Wochen");
  expect(relativeAge("2024-09-09", now)).toBe("vor 1 Jahr");
  expect(relativeAge("2023-02-01", now)).toBe("vor 3 Jahren");
  expect(freshnessTone({ date: "2026-04-01", kind: "checked" }, now)).toBe("fresh");
  expect(freshnessTone({ date: "2025-06-01", kind: "checked" }, now)).toBe("aging");
  expect(freshnessTone({ date: "2024-12-01", kind: "checked" }, now)).toBe("stale");
  expect(freshnessTone(null, now)).toBe("stale");
});
