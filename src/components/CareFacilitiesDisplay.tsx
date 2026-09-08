import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Linking } from "react-native";
import type { Toilet, EquipmentStatus } from "../types/toilet";
import { t, formatDay } from "../i18n";
import { Chip } from "./Chip";
import { useThemedStyles, type Colors } from "../theme";

function label(kind: "bed" | "hoist", status: EquipmentStatus) {
  const name = t(`care.${kind}`);
  if (status === "available") return name;
  if (status === "absent") return t(kind === "bed" ? "care.noBed" : "care.noHoist");
  if (status === "unavailable") return t("care.outOfOrder", { name });
  return t("care.unknown", { name });
}

interface Props {
  toilet: Toilet;
  /** Only the equipment chips, to sit in a row with other chips. */
  inline?: boolean;
  /** Only the access/source toggle, below the chip row. */
  detailsOnly?: boolean;
  compact?: boolean;
}

export function CareFacilitiesDisplay({ toilet, inline = false, detailsOnly = false, compact = false }: Props) {
  const styles = useThemedStyles(makeStyles);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const care = toilet.care;
  if (!care) return null;
  const expanded = expandedId === toilet.id;
  const chips = ([["bed", care.bed], ["hoist", care.hoist]] as const).map(([kind, status]) =>
    <Chip key={kind} icon={kind === "bed" ? "🛏️" : "🏗️"} label={label(kind, status)}
      tone={status === "available" ? "good" : status === "unknown" ? "muted" : "default"} />);
  if (inline) return <>{chips}</>;
  const details = !compact && !inline && <>
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
  </>;
  if (detailsOnly) return <View>{details}</View>;
  return <View style={styles.container}>
    <View style={styles.badges}>{chips}</View>
    {details}
  </View>;
}
const makeStyles = (c: Colors) => StyleSheet.create({
  container: { marginTop: 4, marginBottom: 8 },
  badges: { flexDirection: "row", flexWrap: "wrap", gap: 4 },
  toggle: { paddingVertical: 12, minHeight: 44, justifyContent: "center" },
  link: { color: c.link, fontSize: 13 },
  details: { maxHeight: 120 },
  note: { fontSize: 13, color: c.textSecondary, lineHeight: 19, marginBottom: 4 },
});
