import { getLocales } from "expo-localization";
import { SUPPORTED_LOCALES, type Locale } from "./index";

/** First system language we support; anything non-German falls back to English. */
export function detectLocale(): Locale {
  for (const { languageCode } of getLocales()) {
    if (SUPPORTED_LOCALES.includes(languageCode as Locale)) return languageCode as Locale;
  }
  return "en";
}
