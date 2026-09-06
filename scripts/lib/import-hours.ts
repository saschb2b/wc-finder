import { normalizeOpeningHours } from "../../src/utils/normalize-hours";
import type { StandardizedHours } from "../../src/types/opening-hours";

/** Only compute open/closed for expressions the app can fully interpret. */
export function importHours(raw?: string): StandardizedHours {
  if (!raw?.trim()) return { type: "unknown" };
  const value = raw.trim().replace(/\r?\n/g, ";");
  if (/^(24\/7|24h|rund um die Uhr)$/.test(value)) return { type: "24_7" };
  const day = "(?:Mo|Tu|We|Th|Fr|Sa|Su|Di|Mi|Do|So)";
  const days = `${day}(?:-${day}|(?:,${day})*)`;
  const time = "(?:[01]\\d|2[0-3]):[0-5]\\d";
  const close = `(?:${time}|24:00)`;
  const period = `${time}-${close}`;
  const rule = new RegExp(`^(?:${days} )?(?:${period})(?:,${period})*$`);
  if (!value.split(";").every(part => rule.test(part.trim()))) return { type: "unknown", original: raw };
  return { ...normalizeOpeningHours(value), original: raw };
}
