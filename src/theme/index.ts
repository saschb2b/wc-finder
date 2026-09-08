import { useMemo } from "react";
import { StyleSheet, useColorScheme } from "react-native";
import { light, dark, type Colors } from "./colors";

export { light, dark, type Colors } from "./colors";

export type ColorScheme = "light" | "dark";

/** Follows the system appearance; `userInterfaceStyle: "automatic"` in the app config keeps it live. */
export function useColorSchemeName(): ColorScheme {
  return useColorScheme() === "dark" ? "dark" : "light";
}

export function useTheme(): Colors {
  return useColorSchemeName() === "dark" ? dark : light;
}

/** Build a StyleSheet from the current palette; recomputed only when the scheme flips. */
export function useThemedStyles<T extends StyleSheet.NamedStyles<T>>(factory: (c: Colors) => T): T {
  const colors = useTheme();
  return useMemo(() => factory(colors), [factory, colors]);
}

export const shadow = (c: Colors) => ({
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: c.shadowOpacity,
  shadowRadius: 4,
  elevation: 3,
}) as const;
