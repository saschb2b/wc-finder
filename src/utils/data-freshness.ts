import type { Toilet } from "../types/toilet";
import { t, formatDay } from "../i18n";

/** Strongest evidence first: a person on site beats a directory check beats a source edit beats a download. */
export type CheckKind = "verified" | "checked" | "edited" | "retrieved";
export interface LastChecked { date: string; kind: CheckKind }
export type FreshnessTone = "fresh" | "aging" | "stale";

const validDay = (value?: string) => value && Number.isFinite(Date.parse(value)) ? value.slice(0, 10) : undefined;
const latest = (values: (string | undefined)[]) => values.map(validDay).filter((v): v is string => !!v).sort().at(-1);

export function lastChecked(toilet: Toilet): LastChecked | null {
  const verified = validDay(toilet.verifiedAt);
  if (verified) return { date: verified, kind: "verified" };
  const checked = validDay(toilet.care?.checkedAt);
  if (checked) return { date: checked, kind: "checked" };
  const edited = latest((toilet.sources || []).map(s => s.editedAt));
  if (edited) return { date: edited, kind: "edited" };
  const retrieved = latest((toilet.sources || []).flatMap(s => [s.updatedAt, s.retrievedAt]));
  if (retrieved) return { date: retrieved, kind: "retrieved" };
  return null;
}

export function monthsSince(date: string, now = new Date()): number {
  const then = new Date(date + "T00:00:00Z");
  return (now.getUTCFullYear() - then.getUTCFullYear()) * 12 + now.getUTCMonth() - then.getUTCMonth()
    - (now.getUTCDate() < then.getUTCDate() ? 1 : 0);
}

export function freshnessTone(info: LastChecked | null, now = new Date()): FreshnessTone {
  if (!info) return "stale";
  const months = monthsSince(info.date, now);
  return months < 6 ? "fresh" : months < 18 ? "aging" : "stale";
}

export function relativeAge(date: string, now = new Date()): string {
  const days = Math.floor((now.getTime() - new Date(date + "T00:00:00Z").getTime()) / 86_400_000);
  if (days <= 0) return t("age.today");
  if (days === 1) return t("age.yesterday");
  if (days < 30) return t("age.days", { n: days });
  const months = monthsSince(date, now);
  if (months < 1) return t("age.fourWeeks");
  if (months < 12) return months === 1 ? t("age.month") : t("age.months", { n: months });
  const years = Math.floor(months / 12);
  return years === 1 ? t("age.year") : t("age.years", { n: years });
}

/** Full sentence for the detail card, e.g. "Verzeichnis geprüft: 12.03.2026 (vor 6 Monaten)". */
export function lastCheckedLabel(toilet: Toilet, now = new Date()): string {
  const info = lastChecked(toilet);
  if (!info) return t("freshness.unknown");
  return `${t(`freshness.${info.kind}`)}: ${formatDay(info.date)} (${relativeAge(info.date, now)})`;
}

/** Short form for list rows, e.g. "Geprüft vor 6 Monaten" or "Stand vor 2 Tagen". */
export function lastCheckedShort(toilet: Toilet, now = new Date()): string {
  const info = lastChecked(toilet);
  if (!info) return t("freshness.unknown");
  return t(`freshness.short.${info.kind}`, { age: relativeAge(info.date, now) });
}
