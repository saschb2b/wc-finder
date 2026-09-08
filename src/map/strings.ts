import { t, getLocale } from "../i18n";
import type { MapStrings } from "./types";

/** Text handed to the embedded map document in the current UI language. */
export function mapStrings(colorScheme: MapStrings["colorScheme"] = "light"): MapStrings {
  return {
    lang: getLocale(), colorScheme, title: t("map.title"), zoomIn: t("map.zoomIn"), zoomOut: t("map.zoomOut"),
    contributors: t("map.contributors"), tilesUnavailable: t("map.tilesUnavailable"), myLocation: t("map.myLocationMarker"),
  };
}
