import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Toilet, CATEGORY_LABELS, CATEGORY_COLORS } from '../types/toilet';
import { formatDistance } from '../services/overpass';

interface ToiletListItemProps {
  toilet: Toilet;
  isNearest?: boolean;
  isFavorite?: boolean;
  onNavigate: (toilet: Toilet) => void;
  onSelect: (toilet: Toilet) => void;
  onToggleFavorite?: (id: string) => void;
  onReport?: (toilet: Toilet) => void;
}

export const ToiletListItem = memo(function ToiletListItem({
  toilet,
  isNearest,
  isFavorite,
  onNavigate,
  onSelect,
  onToggleFavorite,
  onReport,
}: ToiletListItemProps) {
  const displayName = toilet.name || 'Barrierefreie Toilette';
  const catColor = CATEGORY_COLORS[toilet.category];
  const isFree = toilet.tags?.includes('kostenlos') || toilet.fee === 'no';
  const hasEurokey = toilet.tags?.includes('eurokey');

  return (
    <TouchableOpacity
      style={[styles.container, isNearest && styles.nearestContainer]}
      onPress={() => onSelect(toilet)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${toilet.distance != null ? formatDistance(toilet.distance) : ''}`}
    >
      {/* Left: favorite star */}
      {onToggleFavorite && (
        <TouchableOpacity
          style={styles.favButton}
          onPress={() => onToggleFavorite(toilet.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <Text style={[styles.favIcon, isFavorite && styles.favIconActive]}>
            {isFavorite ? '\u2605' : '\u2606'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Center: info */}
      <View style={styles.info}>
        {/* Row 1: name + distance */}
        <View style={styles.row}>
          <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
          {toilet.distance != null && (
            <Text style={styles.distance}>{formatDistance(toilet.distance)}</Text>
          )}
        </View>

        {/* Row 2: tags */}
        <View style={styles.tagRow}>
          <View style={[styles.tag, { backgroundColor: catColor }]}>
            <Text style={styles.tagText}>{CATEGORY_LABELS[toilet.category]}</Text>
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
          {toilet.opening_hours === '24/7' && (
            <View style={[styles.tag, styles.tag24h]}>
              <Text style={styles.tagText}>24/7</Text>
            </View>
          )}
          {isNearest && (
            <View style={[styles.tag, styles.tagNearest]}>
              <Text style={styles.tagText}>Nächste</Text>
            </View>
          )}
        </View>

        {/* Row 3: city + opening hours (compact) */}
        {(toilet.city || (toilet.opening_hours && toilet.opening_hours !== '24/7')) && (
          <Text style={styles.sub} numberOfLines={1}>
            {toilet.city}
            {toilet.opening_hours && toilet.opening_hours !== '24/7' ? ` · ${toilet.opening_hours}` : ''}
          </Text>
        )}
      </View>

      {/* Right: actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.navButton}
          onPress={() => onNavigate(toilet)}
          activeOpacity={0.8}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.navButtonText}>Route</Text>
        </TouchableOpacity>
        {onReport && (
          <TouchableOpacity
            onPress={() => onReport(toilet)}
            hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
            style={styles.reportBtn}
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
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e8e8e8',
  },
  nearestContainer: {
    backgroundColor: '#f4fbf5',
  },
  favButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  favIcon: { fontSize: 20, color: '#d0d0d0' },
  favIconActive: { color: '#f5a623' },
  info: { flex: 1, marginRight: 10 },
  row: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1a1a1a',
    flex: 1,
    marginRight: 8,
  },
  distance: {
    fontSize: 14,
    fontWeight: '600',
    color: '#555',
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 5,
    gap: 4,
  },
  tag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    backgroundColor: '#e0e0e0',
  },
  tagText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#fff',
  },
  tagEurokey: { backgroundColor: '#1a73e8' },
  tagFree: { backgroundColor: '#6bb77b' },
  tag24h: { backgroundColor: '#34a853' },
  tagNearest: { backgroundColor: '#34a853' },
  sub: {
    fontSize: 12,
    color: '#999',
    marginTop: 3,
  },
  actions: {
    alignItems: 'center',
    gap: 6,
  },
  navButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 22,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
  reportBtn: {
    paddingVertical: 2,
  },
  reportText: {
    fontSize: 11,
    color: '#aaa',
  },
});
