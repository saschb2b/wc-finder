import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  StandardizedHours,
  isOpenNow,
  formatStandardizedHours,
  getNextOpening,
  getDayName,
  formatPeriod,
} from "../types/opening-hours";

interface OpeningHoursDisplayProps {
  hours: StandardizedHours | undefined;
  compact?: boolean; // Compact mode for list items
}

export function OpeningHoursDisplay({
  hours,
  compact = false,
}: OpeningHoursDisplayProps) {
  if (!hours || hours.type === "unknown") {
    return (
      <View style={styles.container}>
        <Text style={styles.unknown}>Zeiten unbekannt</Text>
      </View>
    );
  }

  const currentlyOpen = isOpenNow(hours);
  const nextOpening = hours.type === "weekly" ? getNextOpening(hours) : null;

  if (compact) {
    // Compact view for list items - minimal, no truncation
    if (hours.type === "24_7") {
      return (
        <View style={styles.compactRow}>
          <View style={[styles.dot, styles.openDot]} />
          <Text style={styles.compactText}>24/7 geöffnet</Text>
        </View>
      );
    }

    if (!currentlyOpen && nextOpening) {
      return (
        <View style={styles.compactRow}>
          <View style={[styles.dot, styles.closedDot]} />
          <Text style={styles.compactText}>
            Öffnet {getDayName(nextOpening.day, true)} {nextOpening.time}
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.compactRow}>
        <View
          style={[
            styles.dot,
            currentlyOpen ? styles.openDot : styles.closedDot,
          ]}
        />
        <Text style={styles.compactText}>
          {currentlyOpen ? "Geöffnet" : "Geschlossen"}
        </Text>
      </View>
    );
  }

  // Full view for detail modal
  return (
    <View style={styles.container}>
      {/* Status header */}
      <View style={styles.statusHeader}>
        <View
          style={[
            styles.statusBadgeLarge,
            currentlyOpen ? styles.openBadge : styles.closedBadge,
          ]}
        >
          <Text
            style={[
              styles.statusTextLarge,
              currentlyOpen ? styles.openText : styles.closedText,
            ]}
          >
            {currentlyOpen ? "Jetzt geöffnet" : "Geschlossen"}
          </Text>
        </View>
        {nextOpening && !currentlyOpen && (
          <Text style={styles.nextOpening}>
            Öffnet {getDayName(nextOpening.day)} um {nextOpening.time}
          </Text>
        )}
      </View>

      {/* Weekly schedule */}
      {hours.type === "24_7" ? (
        <Text style={styles.allDayText}>🕐 Rund um die Uhr geöffnet</Text>
      ) : hours.weekly ? (
        <View style={styles.schedule}>
          {[1, 2, 3, 4, 5, 6, 0].map((dayIndex) => {
            const day = hours.weekly![dayIndex as keyof typeof hours.weekly];
            const isToday = new Date().getDay() === dayIndex;

            return (
              <View
                key={dayIndex}
                style={[styles.dayRow, isToday && styles.todayRow]}
              >
                <Text style={[styles.dayName, isToday && styles.todayText]}>
                  {getDayName(dayIndex)}
                </Text>
                <Text style={[styles.dayHours, isToday && styles.todayText]}>
                  {day.isOpen
                    ? day.periods.map(formatPeriod).join(", ")
                    : "Geschlossen"}
                </Text>
              </View>
            );
          })}
        </View>
      ) : hours.original ? (
        <Text style={styles.originalText}>{hours.original}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 4,
  },
  // New ultra-compact row style
  compactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  openDot: {
    backgroundColor: "#34a853",
  },
  closedDot: {
    backgroundColor: "#ea4335",
  },
  compactText: {
    fontSize: 12,
    color: "#666",
  },
  // Legacy styles (kept for full view)
  compactContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusBadgeLarge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  openBadge: {
    backgroundColor: "#e6f4ea",
  },
  closedBadge: {
    backgroundColor: "#fce8e8",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
  },
  statusTextLarge: {
    fontSize: 14,
    fontWeight: "700",
  },
  openText: {
    color: "#34a853",
  },
  closedText: {
    color: "#ea4335",
  },
  hoursText: {
    fontSize: 12,
    color: "#666",
    flex: 1,
  },
  unknown: {
    fontSize: 12,
    color: "#9aa0a6",
    fontStyle: "italic",
  },
  statusHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  nextOpening: {
    fontSize: 13,
    color: "#666",
  },
  allDayText: {
    fontSize: 15,
    color: "#34a853",
    fontWeight: "600",
  },
  schedule: {
    gap: 8,
  },
  dayRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 6,
  },
  todayRow: {
    backgroundColor: "#e8f4fd",
  },
  dayName: {
    fontSize: 14,
    color: "#444",
    width: 100,
  },
  dayHours: {
    fontSize: 14,
    color: "#666",
    flex: 1,
    textAlign: "right",
  },
  todayText: {
    fontWeight: "600",
    color: "#1a73e8",
  },
  originalText: {
    fontSize: 13,
    color: "#666",
    fontStyle: "italic",
  },
});
