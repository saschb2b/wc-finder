import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Toilet, CATEGORY_COLORS, CATEGORY_LABELS } from "../types/toilet";
import { formatDistance } from "../services/overpass";
import { isOpenNow } from "../types/opening-hours";

interface ToiletCalloutProps {
  toilet: Toilet;
  onNavigate: () => void;
}

export function ToiletCallout({ toilet, onNavigate }: ToiletCalloutProps) {
  const hasEurokey = toilet.tags?.includes("eurokey");
  const isWheelchair = toilet.tags?.includes("barrierefrei") || hasEurokey;
  const isFree = toilet.tags?.includes("kostenlos") || toilet.fee === "no";
  const is24_7 = toilet.hours?.type === "24_7";
  const isOpen = toilet.hours ? isOpenNow(toilet.hours) : null;

  const catColor = CATEGORY_COLORS[toilet.category];

  // Format hours text
  let hoursText = "Zeiten unbekannt";
  if (is24_7) {
    hoursText = "24/7 geöffnet";
  } else if (toilet.hours?.type === "weekly" && toilet.hours.weekly) {
    const today = new Date().getDay();
    const weekly = toilet.hours.weekly;
    const todaySchedule = weekly[today as keyof typeof weekly];
    if (todaySchedule?.isOpen && todaySchedule.periods.length > 0) {
      const period = todaySchedule.periods[0];
      const open =
        String(Math.floor(period.open / 60)).padStart(2, "0") +
        ":" +
        String(period.open % 60).padStart(2, "0");
      const close =
        period.close === 1440
          ? "00:00"
          : String(Math.floor(period.close / 60)).padStart(2, "0") +
            ":" +
            String(period.close % 60).padStart(2, "0");
      hoursText = `Heute: ${open}-${close}`;
    } else {
      hoursText = "Heute geschlossen";
    }
  }

  return (
    <View style={styles.container}>
      {/* Arrow pointing down to pin */}
      <View style={styles.arrow} />

      <View style={styles.content}>
        {/* Header: Category & Status */}
        <View style={styles.header}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
            <Text style={styles.categoryText}>
              {CATEGORY_LABELS[toilet.category]}
            </Text>
          </View>
          {isOpen !== null && (
            <View
              style={[
                styles.statusBadge,
                isOpen ? styles.openBadge : styles.closedBadge,
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  isOpen ? styles.openText : styles.closedText,
                ]}
              >
                {isOpen ? "Geöffnet" : "Geschlossen"}
              </Text>
            </View>
          )}
        </View>

        {/* Name */}
        <Text style={styles.name} numberOfLines={2}>
          {toilet.name || "Barrierefreie Toilette"}
        </Text>

        {/* Distance & Hours */}
        <View style={styles.infoRow}>
          {toilet.distance != null && (
            <Text style={styles.distance}>
              {formatDistance(toilet.distance)}
            </Text>
          )}
          <Text style={styles.hours} numberOfLines={1}>
            {hoursText}
          </Text>
        </View>

        {/* Feature Icons */}
        <View style={styles.iconsRow}>
          {hasEurokey && <Text style={styles.icon}>🔑</Text>}
          {isWheelchair && <Text style={styles.icon}>♿</Text>}
          {isFree && <Text style={styles.icon}>🆓</Text>}
          {is24_7 && <Text style={styles.icon}>🕐</Text>}
        </View>

        {/* Navigate Button */}
        <TouchableOpacity
          style={styles.button}
          onPress={onNavigate}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonText}>🧭 Route</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: 220,
    alignItems: "center",
  },
  arrow: {
    width: 0,
    height: 0,
    backgroundColor: "transparent",
    borderStyle: "solid",
    borderLeftWidth: 10,
    borderRightWidth: 10,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    borderTopColor: "#fff",
    marginTop: -1, // Fix gap
  },
  content: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
    width: "100%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  categoryText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  openBadge: {
    backgroundColor: "#e6f4ea",
  },
  closedBadge: {
    backgroundColor: "#fce8e8",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  openText: {
    color: "#34a853",
  },
  closedText: {
    color: "#ea4335",
  },
  name: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 4,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 6,
  },
  distance: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1a73e8",
  },
  hours: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  iconsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
  },
  button: {
    backgroundColor: "#1a73e8",
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: "center",
  },
  buttonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
