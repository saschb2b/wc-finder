import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import type { Toilet, EquipmentStatus } from "../types/toilet";

function label(name: string, status: EquipmentStatus) {
  if (status === "available") return name;
  if (status === "absent") return `${name === "Lifter" ? "Kein" : "Keine"} ${name}`;
  if (status === "unavailable") return `${name} außer Betrieb`;
  return `${name} unbekannt`;
}

export function CareFacilitiesDisplay({ toilet, compact = false }: { toilet: Toilet; compact?: boolean }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const care = toilet.care;
  if (!care) return null;
  const expanded = expandedId === toilet.id;
  return <View style={styles.container}>
    <View style={styles.badges}>
      {([["Pflegeliege", care.bed], ["Lifter", care.hoist]] as const).map(([name, status]) =>
        <Text key={name} style={[styles.badge, status === "available" && styles.available]}>{label(name, status)}</Text>)}
    </View>
    {!compact && <>
      <TouchableOpacity accessibilityRole="button" accessibilityState={{ expanded }} aria-expanded={expanded}
        onPress={() => setExpandedId(expanded ? null : toilet.id)} style={styles.toggle}>
        <Text style={styles.link}>{expanded ? "Zugang & Quelle ausblenden" : "Zugang & Quelle anzeigen"}</Text>
      </TouchableOpacity>
      {expanded && <ScrollView style={styles.details} nestedScrollEnabled>
        <Text style={styles.note}>{care.access || "Zugangsdetails nicht angegeben."}</Text>
        {care.hoursNote && <Text style={styles.note}>{care.hoursNote}</Text>}
        <Text style={styles.note}>{care.eurokey === false ? "Kein Eurokey erforderlich" : care.eurokey === true ? "Eurokey erforderlich" : "Eurokey: keine Angabe"}</Text>
        <Text style={styles.note}>Verzeichnis geprüft: {care.checkedAt.split("-").reverse().join(".")}</Text>
        {care.sourceUrls.map((url, i) => <TouchableOpacity key={url} accessibilityRole="link"
          onPress={() => Linking.openURL(url)} style={styles.toggle}>
          <Text style={styles.link}>Standortquelle {i + 1} öffnen ↗</Text>
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
