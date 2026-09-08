import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemedStyles, type Colors } from "../theme";

/** One chip style for every fact about a toilet: features and care equipment alike. */
export function Chip({ icon, label, tone = "default" }: { icon?: string; label: string; tone?: "default" | "good" | "muted" }) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={[styles.chip, tone === "good" && styles.good, tone === "muted" && styles.muted]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, tone === "good" && styles.goodLabel, tone === "muted" && styles.mutedLabel]}>{label}</Text>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: c.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  good: { backgroundColor: c.successSoft },
  muted: { backgroundColor: c.surfaceMuted },
  icon: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: "600", color: c.textSecondary },
  goodLabel: { color: c.successText },
  mutedLabel: { color: c.textMuted, fontWeight: "500" },
});
