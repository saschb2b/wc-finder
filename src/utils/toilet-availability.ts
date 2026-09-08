import type { Toilet } from "../types/toilet";
import { isOpenNow } from "../types/opening-hours";
import { t, formatDay } from "../i18n";

export function isWithinAvailability(toilet: Toilet, now = new Date()): boolean {
  const availability = toilet.availability;
  if (!availability) return true;
  if (availability.status === "unavailable") return false;
  if (!availability.from && !availability.through) return true;
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: availability.timeZone || "Europe/Berlin",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find(p => p.type === type)!.value;
  const day = `${part("year")}-${part("month")}-${part("day")}`;
  return (!availability.from || day >= availability.from)
    && (!availability.through || day <= availability.through);
}

/** Unknown hours are not the same as a confirmed closure. */
export function toiletOpenStatus(toilet: Toilet, now = new Date()): boolean | null {
  if (!isWithinAvailability(toilet, now)) return false;
  if (!toilet.hours || toilet.hours.type === "unknown") return null;
  return isOpenNow(toilet.hours, now);
}

export function availabilityLabel(toilet: Toilet, now = new Date()): string | null {
  const a = toilet.availability;
  if (!a) return null;
  if (a.status === "unavailable") return a.note || t("availability.unavailable");
  if (a.from && a.through) {
    const range = { from: formatDay(a.from), through: formatDay(a.through) };
    return t(isWithinAvailability(toilet, now) ? "availability.only" : "availability.notAvailable", range);
  }
  return a.note || null;
}
