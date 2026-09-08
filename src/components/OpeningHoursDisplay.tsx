import React from "react";
import { View, Text, StyleSheet } from "react-native";
import {
  StandardizedHours,
  isOpenNow,
  getNextOpening,
  getDayName,
  formatPeriod,
} from "../types/opening-hours";
import { t } from "../i18n";
import { useThemedStyles, type Colors } from "../theme";

interface OpeningHoursDisplayProps {
  hours: StandardizedHours | undefined;
  compact?: boolean; // Compact mode for list items
}

export function OpeningHoursDisplay({
  hours,
  compact = false,
}: OpeningHoursDisplayProps) {
  const styles = useThemedStyles(makeStyles);
  if (!hours || hours.type === "unknown") {
    return (
      <View style={styles.container}>
        <Text style={styles.unknown}>{t("hours.unknown")}</Text>
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
          <Text style={styles.compactText}>{t("hours.open247")}</Text>
        </View>
      );
    }

    if (!currentlyOpen && nextOpening) {
      return (
        <View style={styles.compactRow}>
          <View style={[styles.dot, styles.closedDot]} />
          <Text style={styles.compactText}>
            {t("hours.opensShort", { day: getDayName(nextOpening.day, true), time: nextOpening.time })}
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
          {currentlyOpen ? t("hours.open") : t("hours.closed")}
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
            {currentlyOpen ? t("hours.openNow") : t("hours.closed")}
          </Text>
        </View>
        {nextOpening && !currentlyOpen && (
          <Text style={styles.nextOpening}>
            {t("hours.opensLong", { day: getDayName(nextOpening.day), time: nextOpening.time })}
          </Text>
        )}
      </View>

      {/* Weekly schedule */}
      {hours.type === "24_7" ? (
        <Text style={styles.allDayText}>{t("hours.aroundTheClock")}</Text>
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
                    : t("hours.closed")}
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

const makeStyles = (c: Colors) => StyleSheet.create({
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
    backgroundColor: c.success,
  },
  closedDot: {
    backgroundColor: c.danger,
  },
  compactText: {
    fontSize: 12,
    color: c.textSecondary,
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
    backgroundColor: c.successSoft,
  },
  closedBadge: {
    backgroundColor: c.dangerSoft,
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
    color: c.success,
  },
  closedText: {
    color: c.danger,
  },
  hoursText: {
    fontSize: 12,
    color: c.textSecondary,
    flex: 1,
  },
  unknown: {
    fontSize: 12,
    color: c.textMuted,
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
    color: c.textSecondary,
  },
  allDayText: {
    fontSize: 15,
    color: c.success,
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
    backgroundColor: c.primarySoft,
  },
  dayName: {
    fontSize: 14,
    color: c.textSecondary,
    width: 100,
  },
  dayHours: {
    fontSize: 14,
    color: c.textSecondary,
    flex: 1,
    textAlign: "right",
  },
  todayText: {
    fontWeight: "600",
    color: c.link,
  },
  originalText: {
    fontSize: 13,
    color: c.textSecondary,
    fontStyle: "italic",
  },
});
