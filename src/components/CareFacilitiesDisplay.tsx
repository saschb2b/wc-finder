import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import type { Toilet, EquipmentStatus } from "../types/toilet";
import { t, formatDay } from "../i18n";

function label(kind: "bed" | "hoist", status: EquipmentStatus) {
  const name = t(`care.${kind}`);
  if (status === "available") return name;
  if (status === "absent") return t(kind === "bed" ? "care.noBed" : "care.noHoist");
  if (status === "unavailable") return t("care.outOfOrder", { name });
  return t("care.unknown", { name });
}

export function CareFacilitiesDisplay({ toilet, compact = false }: { toilet: Toilet; compact?: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const care = toilet.care;
  if (!care) return null;
  const expanded = expandedId === toilet.id;
  return <View style={styles.container}>
    <View style={styles.badges}>
      {([["bed", care.bed], ["hoist", care.hoist]] as const).map(([kind, status]) =>
        <Text key={kind} style={[styles.badge, status === "available" && styles.available]}>{label(kind, status)}</Text>)}
    </View>
    {!compact && <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded}
        onPress={() => setExpandedId(expanded ? null : toilet.id)} style={styles.toggle}>
        <Text style={styles.link}>{expanded ? t("care.hideDetails") : t("care.showDetails")}</Text>
      </TouchableOpacity>
      {expanded && <ScrollView style={styles.details} nestedScrollEnabled>
        <Text style={styles.note}>{care.access || t("care.noAccessDetails")}</Text>
        {care.hoursNote && <Text style={styles.note}>{care.hoursNote}</Text>}
        <Text style={styles.note}>{care.eurokey === false ? t("care.eurokeyNotRequired") : care.eurokey === true ? t("care.eurokeyRequired") : t("care.eurokeyUnknown")}</Text>
        <Text style={styles.note}>{t("care.checked", { date: formatDay(care.checkedAt) })}</Text>
        {care.sourceUrls.map((url, i) => <TouchableOpacity key={url} accessibilityRole="link"
          onPress={() => Linking.openURL(url)} style={styles.toggle}>
          <Text style={styles.link}>{t("care.openSource", { n: i + 1 })}</Text>
        </TouchableOpacity>)}
      </ScrollView>}
    </>}
  </View>;
}
const styles = StyleSheet.create({
  container: { marginTop: 4, marginBottom: 8 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  badge: { backgroundColor: "#f0f1f3", color: "#555", fontSize: 12, paddingVertical: 4, paddingHorizontal: 7, borderRadius: 6 },
  available: { backgroundColor: "#e5f2e9", color: "#236738" },
  toggle: { paddingVertical: 10 },
  link: { color: "#1765bf", fontSize: 13 },
  details: { maxHeight: 120 },
  note: { fontSize: 13, color: "#555", lineHeight: 19, marginBottom: 4 },
});
