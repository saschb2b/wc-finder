/**
 * Minimal typed i18n. The locale is set once at startup from the system language
 * (see detect.ts); this module stays free of native imports so node-only scripts
 * and tests can use it and get German by default.
 */
import { de, en, type TranslationKey } from "./translations";
import type { ToiletCategory } from "../types/toilet";

export type Locale = "de" | "en";
export const SUPPORTED_LOCALES: Locale[] = ["de", "en"];
const dictionaries: Record<Locale, Record<TranslationKey, string>> = { de, en };

let current: Locale = "de";
const listeners = new Set<() => void>();

export function setLocale(locale: Locale) {
  if (locale === current) return;
  current = locale;
  listeners.forEach(listener => listener());
}
/** Notifies on locale changes; used by the useLocale hook to re-render. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function getLocale(): Locale { return current; }
/** BCP 47 tag for Intl APIs. */
export function localeTag(): string { return current === "de" ? "de-DE" : "en-GB"; }

export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const text = dictionaries[current][key] ?? de[key];
  return params ? text.replace(/\{(\w+)\}/g, (_, name) => String(params[name] ?? `{${name}}`)) : text;
}

export function categoryLabel(category: ToiletCategory): string {
  return t(`category.${category}`);
}

export function dayName(dayIndex: number, short = false): string {
  return t(short ? "day.short" : "day.long").split(",")[dayIndex];
}

/** Calendar date (YYYY-MM-DD) in a locale-appropriate, unambiguous form. */
export function formatDay(isoDay: string): string {
  return current === "de" ? isoDay.split("-").reverse().join(".") : isoDay;
}

export function formatNumber(value: number): string {
  return value.toLocaleString(localeTag());
}
