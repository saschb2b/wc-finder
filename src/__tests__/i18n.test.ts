import { de, en } from "../i18n/translations";
import { t, setLocale, getLocale, formatDay, dayName, subscribe } from "../i18n";
import { lastCheckedLabel, lastCheckedShort } from "../utils/data-freshness";
import { availabilityLabel } from "../utils/toilet-availability";
import { formatStandardizedHours } from "../types/opening-hours";
import type { Toilet } from "../types/toilet";

afterEach(() => setLocale("de"));

test("English defines exactly the German keys and keeps every placeholder", () => {
  expect(Object.keys(en).sort()).toEqual(Object.keys(de).sort());
  for (const key of Object.keys(de) as (keyof typeof de)[]) {
    const placeholders = (s: string) => (s.match(/\{\w+\}/g) || []).sort();
    expect(placeholders(en[key])).toEqual(placeholders(de[key]));
  }
});

test("notifies subscribers only when the locale actually changes", () => {
  const calls: string[] = [];
  const unsubscribe = subscribe(() => calls.push(getLocale()));
  setLocale("de");
  setLocale("en");
  setLocale("en");
  unsubscribe();
  setLocale("de");
  expect(calls).toEqual(["en"]);
});

test("defaults to German and interpolates", () => {
  expect(getLocale()).toBe("de");
  expect(t("list.toiletsCount", { n: 3 })).toBe("3 Toiletten");
  expect(t("toilet.fee", { fee: "0,50 €" })).toBe("Gebühr: 0,50 €");
});

test("English output for dates, hours and freshness", () => {
  setLocale("en");
  const now = new Date("2026-09-08T10:00:00Z");
  const toilet: Toilet = { id: "t", name: "WC", lat: 52, lon: 9, category: "other", verifiedAt: "2026-06-01" };
  expect(formatDay("2026-03-12")).toBe("2026-03-12");
  expect(dayName(1)).toBe("Monday");
  expect(dayName(6, true)).toBe("Sat");
  expect(lastCheckedLabel(toilet, now)).toBe("Confirmed on site: 2026-06-01 (3 months ago)");
  expect(lastCheckedShort({ ...toilet, verifiedAt: undefined }, now)).toBe("Check date unknown");
  expect(availabilityLabel({ ...toilet, availability: { from: "2026-07-22", through: "2026-08-09" } }, now))
    .toBe("Not available · 2026-07-22–2026-08-09");
  expect(formatStandardizedHours({ type: "24_7" })).toBe("Open 24/7");
  const day = { isOpen: true, periods: [{ open: 540, close: 1020 }] };
  const closed = { isOpen: false, periods: [] };
  expect(formatStandardizedHours({ type: "weekly", weekly: { 0: closed, 1: day, 2: day, 3: day, 4: day, 5: day, 6: closed } }))
    .toBe("Mon 09:00-17:00; Tue 09:00-17:00; Wed 09:00-17:00; Thu 09:00-17:00; Fri 09:00-17:00");
});
