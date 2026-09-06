import React, { useState } from "react";
import { Linking, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import type { Toilet } from "../types/toilet";

export function ToiletSources({ toilet }: { toilet: Toilet }) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (!toilet.sources?.length) return null;
  const expanded = expandedId === toilet.id;
  return <View>
    <TouchableOpacity style={styles.toggle} accessibilityRole="button" accessibilityState={{ expanded }}
      onPress={() => setExpandedId(expanded ? null : toilet.id)}>
      <Text style={styles.link}>{expanded ? "Quellen ausblenden" : "Quellen anzeigen"}</Text>
    </TouchableOpacity>
    {expanded && toilet.sources.map(source => <View key={source.id}>
      <TouchableOpacity style={styles.toggle} accessibilityRole="link" onPress={() => Linking.openURL(source.url)}>
        <Text style={styles.link}>{source.name} ↗</Text>
      </TouchableOpacity>
      <Text style={styles.note}>{source.license} · Abgerufen: {source.retrievedAt.slice(0, 10)}</Text>
    </View>)}
  </View>;
}
const styles = StyleSheet.create({
  toggle: { paddingVertical: 10 },
  link: { color: "#1765bf", fontSize: 13 },
  note: { color: "#666", fontSize: 12, marginBottom: 8 },
});
