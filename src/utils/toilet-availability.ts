import type { Toilet } from "../types/toilet";
import { isOpenNow } from "../types/opening-hours";

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
  if (a.status === "unavailable") return a.note || "Derzeit nicht nutzbar";
  const format = (date: string) => date.split("-").reverse().join(".");
  if (a.from && a.through) {
    return `${isWithinAvailability(toilet, now) ? "Nur" : "Nicht verfügbar ·"} ${format(a.from)}–${format(a.through)}`;
  }
  return a.note || null;
}
