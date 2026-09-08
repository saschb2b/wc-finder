import React from "react";
import { StyleSheet, Text, View } from "react-native";

/** One chip style for every fact about a toilet: features and care equipment alike. */
export function Chip({ icon, label, tone = "default" }: { icon?: string; label: string; tone?: "default" | "good" | "muted" }) {
  return (
    <View style={[styles.chip, tone === "good" && styles.good, tone === "muted" && styles.muted]}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={[styles.label, tone === "good" && styles.goodLabel, tone === "muted" && styles.mutedLabel]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f0f1f3",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  good: { backgroundColor: "#e5f2e9" },
  muted: { backgroundColor: "#f7f7f7" },
  icon: { fontSize: 14 },
  label: { fontSize: 12, fontWeight: "600", color: "#444" },
  goodLabel: { color: "#236738" },
  mutedLabel: { color: "#8a8a8a", fontWeight: "500" },
});
