import React from "react";
import { Text, View, StyleSheet } from "react-native";
import type { Toilet } from "../types/toilet";
import { availabilityLabel, isWithinAvailability } from "../utils/toilet-availability";
import { OpeningHoursDisplay } from "./OpeningHoursDisplay";

export function ToiletHours({ toilet, compact = false }: { toilet: Toilet; compact?: boolean }) {
  const availability = availabilityLabel(toilet);
  const available = isWithinAvailability(toilet);
  return <View>
    {availability && <Text style={[styles.note, !available && styles.closed]}>{availability}</Text>}
    {available && (toilet.hours && toilet.hours.type !== "unknown"
      ? <OpeningHoursDisplay hours={toilet.hours} compact />
      : <Text style={styles.note} numberOfLines={compact ? 3 : undefined}>
          {toilet.care?.hoursNote || "Zeiten unbekannt"}
        </Text>)}
  </View>;
}
const styles = StyleSheet.create({
  note: { color: "#666", fontSize: 12, lineHeight: 17 },
  closed: { color: "#a33b25" },
});
