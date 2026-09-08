import { useSyncExternalStore } from "react";
import { getLocale, subscribe } from "./index";

/** Current UI locale; components that call t() during render re-render when it changes. */
export function useLocale() {
  return useSyncExternalStore(subscribe, getLocale, getLocale);
}
