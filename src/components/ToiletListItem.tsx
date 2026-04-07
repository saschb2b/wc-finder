import React, { memo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Toilet, CATEGORY_LABELS, CATEGORY_COLORS } from "../types/toilet";
import { formatDistance } from "../services/overpass";

interface ToiletListItemProps {
  toilet: Toilet;
  isNearest?: boolean;
  isFavorite?: boolean;
  isSelected?: boolean;
  onNavigate: (toilet: Toilet) => void;
  onSelect: (toilet: Toilet) => void;
  onToggleFavorite?: (id: string) => void;
  onReport?: (toilet: Toilet) => void;
}

/**
 * Parse month name to month number (0-11)
 */
function parseMonth(monthStr: string): number | null {
  const months: Record<string, number> = {
    jan: 0,
    january: 0,
    feb: 1,
    february: 1,
    mar: 2,
    march: 2,
    mär: 2,
    apr: 3,
    april: 3,
    may: 4,
    mai: 4,
    jun: 5,
    june: 5,
    jul: 6,
    july: 6,
    aug: 7,
    august: 7,
    sep: 8,
    sept: 8,
    september: 8,
    oct: 9,
    october: 9,
    okt: 9,
    nov: 10,
    november: 10,
    dec: 11,
    december: 11,
    dez: 11,
  };
  return months[monthStr.toLowerCase()] ?? null;
}

/**
 * Check if current month is within a seasonal range.
 * Handles: "Apr-Sep", "Mar-Oct", "Oct-Mar" (wrapping around year end)
 */
function isInSeason(startMonth: string, endMonth: string): boolean {
  const start = parseMonth(startMonth);
  const end = parseMonth(endMonth);
  if (start === null || end === null) return true; // Assume open if can't parse

  const currentMonth = new Date().getMonth(); // 0-11

  if (start <= end) {
    // Normal range: Apr-Sep (3-8)
    return currentMonth >= start && currentMonth <= end;
  } else {
    // Wrapping range: Oct-Mar (9-2)
    return currentMonth >= start || currentMonth <= end;
  }
}

/**
 * Check if a toilet is currently open based on opening_hours.
 * Returns: true (open), false (closed), null (unknown)
 */
export function isCurrentlyOpen(opening_hours?: string): boolean | null {
  if (!opening_hours) return null;

  const now = new Date();
  const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const hour = now.getHours();
  const minute = now.getMinutes();
  const currentTime = hour * 60 + minute;

  // Handle 24/7
  if (opening_hours === "24/7") return true;

  // Handle seasonal + time format: "Apr-Sep 08:00-20:00" or "Apr-Sep: 8:00-19:00"
  const seasonalMatch = opening_hours.match(
    /([a-z]{3,4})\s*[-–]\s*([a-z]{3,4})[:\s]+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );
  if (seasonalMatch) {
    const startMonth = seasonalMatch[1];
    const endMonth = seasonalMatch[2];
    const startHour = parseInt(seasonalMatch[3]);
    const startMin = parseInt(seasonalMatch[4]);
    const endHour = parseInt(seasonalMatch[5]);
    const endMin = parseInt(seasonalMatch[6]);

    // Check if we're in season
    if (!isInSeason(startMonth, endMonth)) {
      return false; // Outside season = closed
    }

    // Check time
    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    return currentTime >= startTime && currentTime <= endTime;
  }

  // Handle simple time range like "06:00-22:00"
  const simpleMatch = opening_hours.match(
    /(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/,
  );
  if (simpleMatch) {
    const startHour = parseInt(simpleMatch[1]);
    const startMin = parseInt(simpleMatch[2]);
    const endHour = parseInt(simpleMatch[3]);
    const endMin = parseInt(simpleMatch[4]);

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;

    return currentTime >= startTime && currentTime <= endTime;
  }

  // Handle day-based ranges like "Mo-Sa 08:00-20:00"
  const dayMatch = opening_hours.match(
    /([a-z,\-]+)\s+(\d{1,2}):(\d{2})\s*[-–]\s*(\d{1,2}):(\d{2})/i,
  );
  if (dayMatch) {
    const daysStr = dayMatch[1];
    const startHour = parseInt(dayMatch[2]);
    const startMin = parseInt(dayMatch[3]);
    const endHour = parseInt(dayMatch[4]);
    const endMin = parseInt(dayMatch[5]);

    // Check if current day matches (simplified)
    const isWeekend = day === 0 || day === 6;
    const isWeekday = !isWeekend;

    const daysLower = daysStr.toLowerCase();
    const matchesWeekend =
      isWeekend &&
      (daysLower.includes("so") ||
        daysLower.includes("sa") ||
        daysLower.includes("weekend"));
    const matchesWeekday =
      isWeekday &&
      (daysLower.includes("mo") ||
        daysLower.includes("di") ||
        daysLower.includes("mi") ||
        daysLower.includes("do") ||
        daysLower.includes("fr") ||
        daysLower.includes("weekday"));

    if (!matchesWeekend && !matchesWeekday) return false;

    const startTime = startHour * 60 + startMin;
    const endTime = endHour * 60 + endMin;
    return currentTime >= startTime && currentTime <= endTime;
  }

  // If we can't parse it, return unknown
  return null;
}

/**
 * Format opening hours for display - simplify complex strings.
 */
function formatOpeningHours(hours?: string): string {
  if (!hours) return "";

  // Keep 24/7 as is
  if (hours === "24/7") return "24/7";

  // Truncate very long strings
  if (hours.length > 40) {
    return hours.substring(0, 37) + "...";
  }

  return hours;
}

export const ToiletListItem = memo(function ToiletListItem({
  toilet,
  isNearest,
  isFavorite,
  isSelected,
  onNavigate,
  onSelect,
  onToggleFavorite,
  onReport,
}: ToiletListItemProps) {
  const displayName = toilet.name || "Barrierefreie Toilette";
  const catColor = CATEGORY_COLORS[toilet.category];
  const isFree = toilet.tags?.includes("kostenlos") || toilet.fee === "no";
  const hasEurokey = toilet.tags?.includes("eurokey");
  const openStatus = isCurrentlyOpen(toilet.opening_hours);
  const formattedHours = formatOpeningHours(toilet.opening_hours);

  const handleFavoritePress = useCallback(
    (e: any) => {
      e.stopPropagation();
      onToggleFavorite?.(toilet.id);
    },
    [onToggleFavorite, toilet.id],
  );

  const handleNavigatePress = useCallback(
    (e: any) => {
      e.stopPropagation();
      onNavigate(toilet);
    },
    [onNavigate, toilet],
  );

  const handleReportPress = useCallback(
    (e: any) => {
      e.stopPropagation();
      onReport?.(toilet);
    },
    [onReport, toilet],
  );

  return (
    <TouchableOpacity
      style={[
        styles.container,
        isNearest && styles.nearestContainer,
        isSelected && styles.selectedContainer,
      ]}
      onPress={() => onSelect(toilet)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${toilet.distance != null ? formatDistance(toilet.distance) : ""}`}
    >
      {/* Left: favorite star */}
      {onToggleFavorite && (
        <TouchableOpacity
          style={styles.favButton}
          onPress={handleFavoritePress}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityRole="button"
          accessibilityLabel={
            isFavorite ? "Aus Favoriten entfernen" : "Zu Favoriten hinzufügen"
          }
        >
          <Text style={[styles.favIcon, isFavorite && styles.favIconActive]}>
            {isFavorite ? "\u2605" : "\u2606"}
          </Text>
        </TouchableOpacity>
      )}

      {/* Center: info */}
      <View style={styles.info}>
        {/* Row 1: name + distance */}
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>
            {displayName}
          </Text>
          {toilet.distance != null && (
            <Text style={styles.distance}>
              {formatDistance(toilet.distance)}
            </Text>
          )}
        </View>

        {/* Row 2: tags */}
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: catColor }]}>
            <Text style={styles.tagText}>
              {CATEGORY_LABELS[toilet.category]}
            </Text>
          </View>
          {hasEurokey && (
            <View style={[styles.tag, styles.tagEurokey]}>
              <Text style={styles.tagText}>Eurokey</Text>
            </View>
          )}
          {isFree && (
            <View style={[styles.tag, styles.tagFree]}>
              <Text style={styles.tagText}>Kostenlos</Text>
            </View>
          )}
          {toilet.opening_hours === "24/7" && (
            <View style={[styles.tag, styles.tag24h]}>
              <Text style={styles.tagText}>24/7</Text>
            </View>
          )}
          {openStatus === true && (
            <View style={[styles.tag, styles.tagOpen]}>
              <Text style={styles.tagText}>Geöffnet</Text>
            </View>
          )}
          {openStatus === false && (
            <View style={[styles.tag, styles.tagClosed]}>
              <Text style={styles.tagText}>Geschlossen</Text>
            </View>
          )}
          {isNearest && (
            <View style={[styles.tag, styles.tagNearest]}>
              <Text style={styles.tagText}>Nächste</Text>
            </View>
          )}
        </View>

        {/* Row 3: city + opening hours - allow wrapping for readability */}
        {toilet.city && (
          <Text style={styles.city} numberOfLines={1}>
            {toilet.city}
          </Text>
        )}
        {formattedHours && formattedHours !== "24/7" && (
          <Text style={styles.hours} numberOfLines={2}>
            {formattedHours}
          </Text>
        )}
      </View>

      {/* Right: actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={handleNavigatePress}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityRole="button"
          accessibilityLabel="Route berechnen"
        >
          <Text style={styles.navButtonText}>Route</Text>
        </TouchableOpacity>
        {onReport && (
          <TouchableOpacity
            onPress={handleReportPress}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.reportBtn}
            accessibilityRole="button"
            accessibilityLabel="Problem melden"
          >
            <Text style={styles.reportText}>Melden</Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e8e8e8",
    backgroundColor: "#fff",
  },
  nearestContainer: {
    backgroundColor: "#f4fbf5",
  },
  selectedContainer: {
    backgroundColor: "#e8f4fd",
  },
  favButton: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 4,
  },
  favIcon: { fontSize: 22, color: "#d0d0d0" },
  favIconActive: { color: "#f5a623" },
  info: { flex: 1, marginRight: 10 },
  row: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  name: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1a1a1a",
    flex: 1,
    marginRight: 8,
  },
  distance: {
    fontSize: 14,
    fontWeight: "600",
    color: "#555",
  },
  tagRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 5,
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: "#e0e0e0",
  },
  tagText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#fff",
  },
  tagEurokey: { backgroundColor: "#1a73e8" },
  tagFree: { backgroundColor: "#6bb77b" },
  tag24h: { backgroundColor: "#34a853" },
  tagOpen: { backgroundColor: "#34a853" },
  tagClosed: { backgroundColor: "#ea4335" },
  tagNearest: { backgroundColor: "#34a853" },
  city: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  hours: {
    fontSize: 12,
    color: "#888",
    marginTop: 2,
    lineHeight: 16,
  },
  actions: {
    alignItems: "center",
    gap: 6,
  },
  navButton: {
    backgroundColor: "#1a73e8",
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
  },
  navButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  reportBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  reportText: {
    fontSize: 11,
    color: "#1a73e8",
    fontWeight: "500",
  },
});
