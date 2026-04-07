import React, { memo, useCallback } from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { Toilet, CATEGORY_LABELS, CATEGORY_COLORS } from "../types/toilet";
import { formatDistance } from "../services/overpass";
import { OpeningHoursDisplay } from "./OpeningHoursDisplay";
import { isOpenNow } from "../types/opening-hours";

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
  const isWheelchairAccessible =
    toilet.tags?.includes("eurokey") || toilet.tags?.includes("barrierefrei");

  // Use new standardized hours format
  const openStatus = toilet.hours ? isOpenNow(toilet.hours) : null;
  const hasUnknownHours = !toilet.hours || toilet.hours.type === "unknown";

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
          {isWheelchairAccessible && !hasEurokey && (
            <View style={[styles.tag, styles.tagWheelchair]}>
              <Text style={styles.tagText}>♿ Barrierefrei</Text>
            </View>
          )}
          {isFree && (
            <View style={[styles.tag, styles.tagFree]}>
              <Text style={styles.tagText}>Kostenlos</Text>
            </View>
          )}
          {toilet.hours?.type === "24/7" && (
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
          {hasUnknownHours && openStatus !== false && (
            <View style={[styles.tag, styles.tagUnknown]}>
              <Text style={styles.tagText}>Zeiten unbekannt</Text>
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
        {toilet.hours && toilet.hours.type !== "unknown" && (
          <View style={styles.hoursRow}>
            <OpeningHoursDisplay hours={toilet.hours} compact />
          </View>
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
  tagWheelchair: { backgroundColor: "#34a853" },
  tagFree: { backgroundColor: "#6bb77b" },
  tag24h: { backgroundColor: "#34a853" },
  tagOpen: { backgroundColor: "#34a853" },
  tagClosed: { backgroundColor: "#ea4335" },
  tagUnknown: { backgroundColor: "#9aa0a6" },
  tagNearest: { backgroundColor: "#34a853" },
  city: {
    fontSize: 12,
    color: "#666",
    marginTop: 3,
  },
  hoursRow: {
    marginTop: 4,
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
