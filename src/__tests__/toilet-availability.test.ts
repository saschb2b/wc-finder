import type { Toilet } from "../types/toilet";
import { isWithinAvailability, toiletOpenStatus, availabilityLabel } from "../utils/toilet-availability";
import { filterToilets, type ToiletFilters } from "../utils/filter-toilets";

const toilet: Toilet = { id: "event", name: "Festival", lat: 52.36, lon: 9.73, category: "other",
  hours: { type: "24_7" }, availability: { from: "2026-07-22", through: "2026-08-09", timeZone: "Europe/Berlin" } };
const filters: ToiletFilters = { openNow: false, favoritesOnly: false, favoriteIds: new Set(), eurokey: false, wheelchair: false, bed: false, hoist: false };

test("event dates are inclusive in local time and do not recur next year", () => {
  expect(isWithinAvailability(toilet, new Date("2026-07-21T21:59:59Z"))).toBe(false);
  expect(isWithinAvailability(toilet, new Date("2026-07-21T22:00:00Z"))).toBe(true);
  expect(isWithinAvailability(toilet, new Date("2026-08-09T21:59:59Z"))).toBe(true);
  expect(toiletOpenStatus(toilet, new Date("2026-08-09T22:00:00Z"))).toBe(false);
  expect(toiletOpenStatus(toilet, new Date("2027-07-25T12:00:00Z"))).toBe(false);
  expect(availabilityLabel(toilet, new Date("2026-09-06"))).toContain("22.07.2026–09.08.2026");
});

test("temporary closure overrides 24/7 and unspecified hours stay unknown", () => {
  expect(toiletOpenStatus({ ...toilet, availability: { status: "unavailable" } })).toBe(false);
  expect(toiletOpenStatus({ ...toilet, availability: undefined, hours: { type: "unknown" } })).toBeNull();
  expect(toiletOpenStatus({ ...toilet, availability: undefined })).toBe(true);
});

test("past event is absent from normal results but saved location retains warning", () => {
  const now = new Date("2026-09-06");
  expect(filterToilets([toilet], filters, now)).toEqual([]);
  expect(filterToilets([toilet], { ...filters, favoritesOnly: true, favoriteIds: new Set([toilet.id]) }, now)).toEqual([toilet]);
  expect(filterToilets([toilet], { ...filters, openNow: true }, now)).toEqual([]);
});

test("bed and hoist filters require independent, available equipment", () => {
  const bed: Toilet = { ...toilet, availability: undefined, care: { bed: "available", hoist: "absent", eurokey: false,
    sourceId: "test", sourceUrls: [], checkedAt: "2026-09-06" } };
  expect(filterToilets([bed], { ...filters, bed: true })).toEqual([bed]);
  expect(filterToilets([bed], { ...filters, hoist: true })).toEqual([]);
  expect(filterToilets([{ ...bed, tags: ["eurokey"] }], { ...filters, eurokey: true })).toEqual([]);
  expect(filterToilets([{ ...bed, care: { ...bed.care!, hoist: "unavailable" } }], { ...filters, hoist: true })).toEqual([]);
});
