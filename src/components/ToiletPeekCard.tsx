import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Toilet } from "../types/toilet";
import { CATEGORY_COLORS } from "../types/toilet";
import { formatDistance } from "../services/overpass";
import { ToiletHours } from "./ToiletHours";
import { t, categoryLabel } from "../i18n";
import { useThemedStyles, type Colors } from "../theme";

interface Props {
  toilet: Toilet;
  isSelected: boolean;
  onNavigate: () => void;
  onList: () => void;
}

/** The always-visible sheet summary: what it is, how far, whether it is open, and the way there. */
export function ToiletPeekCard({ toilet, isSelected, onNavigate, onList }: Props) {
  const styles = useThemedStyles(makeStyles);
  return (
    <View style={styles.container}>
      <View style={styles.info}>
        <View style={styles.row}>
          <View style={[styles.badge, { backgroundColor: CATEGORY_COLORS[toilet.category] }]}>
            <Text style={styles.badgeText}>{categoryLabel(toilet.category)}</Text>
          </View>
          {!isSelected && <Text style={styles.nearest}>{t("toilet.nearest")}</Text>}
          {toilet.distance != null && <Text style={styles.distance}>{formatDistance(toilet.distance)}</Text>}
        </View>
        <Text style={styles.name} numberOfLines={1}>{toilet.name || t("toilet.fallbackName")}</Text>
        <ToiletHours toilet={toilet} compact />
      </View>
      <View style={styles.actions}>
        <TouchableOpacity style={styles.route} onPress={onNavigate} activeOpacity={0.8} accessibilityRole="button">
          <Text style={styles.routeText}>🧭 {t("action.route")}</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.list} onPress={onList} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={t("sheet.expand")}>
          <Text style={styles.listText}>☰ {t("sheet.list")}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: { paddingHorizontal: 16, paddingBottom: 12, gap: 10 },
  info: { gap: 4 },
  row: { flexDirection: "row", alignItems: "center", gap: 8 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeText: { color: c.onPrimary, fontSize: 10, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.5 },
  nearest: { fontSize: 12, color: c.success, fontWeight: "600" },
  distance: { marginLeft: "auto", fontSize: 15, fontWeight: "700", color: c.text },
  name: { fontSize: 17, fontWeight: "700", color: c.text },
  actions: { flexDirection: "row", gap: 10 },
  route: { flex: 1, backgroundColor: c.primary, borderRadius: 12, paddingVertical: 12, alignItems: "center", minHeight: 44 },
  routeText: { color: c.onPrimary, fontSize: 15, fontWeight: "700" },
  list: { backgroundColor: c.surfaceAlt, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16, alignItems: "center", minHeight: 44 },
  listText: { color: c.text, fontSize: 15, fontWeight: "600" },
});
