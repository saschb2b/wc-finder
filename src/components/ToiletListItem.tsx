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
  const isReliable = toilet.category === 'public_24h' || toilet.category === 'station';

  return (
    <TouchableOpacity
      style={[styles.container, isNearest && styles.nearestContainer]}
      onPress={() => onSelect(toilet)}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={`${displayName}, ${toilet.distance != null ? formatDistance(toilet.distance) : ''}`}
    >
      {/* Favorite button */}
      {onToggleFavorite && (
        <TouchableOpacity
          style={styles.favButton}
          onPress={() => onToggleFavorite(toilet.id)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          accessibilityLabel={isFavorite ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen'}
        >
          <Text style={[styles.favIcon, isFavorite && styles.favIconActive]}>
            {isFavorite ? '\u2605' : '\u2606'}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.info}>
        <View style={styles.header}>
          <Text
            style={[styles.name, isNearest && styles.nearestName, !isReliable && styles.dimName]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
          {isNearest && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Nächste</Text>
            </View>
          )}
        </View>

        {/* Category + meta row */}
        <View style={styles.metaRow}>
          <View style={[styles.categoryBadge, { backgroundColor: catColor }]}>
            <Text style={styles.categoryText}>{CATEGORY_LABELS[toilet.category]}</Text>
          </View>
          {toilet.distance != null && (
            <Text style={styles.distance}>{formatDistance(toilet.distance)}</Text>
          )}
        </View>

        {/* Extra info line */}
        <View style={styles.detailRow}>
          {toilet.city && <Text style={styles.detail}>{toilet.city}</Text>}
          {toilet.tags?.includes('kostenlos') && <Text style={styles.detail}> · Kostenlos</Text>}
          {toilet.fee === 'no' && !toilet.tags?.includes('kostenlos') && (
            <Text style={styles.detail}> · Kostenlos</Text>
          )}
          {toilet.tags?.includes('eurokey') && <Text style={styles.detailHighlight}> · Eurokey</Text>}
          {toilet.opening_hours && toilet.opening_hours !== '24/7' && (
            <Text style={styles.detail} numberOfLines={1}> · {toilet.opening_hours}</Text>
          )}
          {toilet.opening_hours === '24/7' && <Text style={styles.detailHighlight}> · 24/7</Text>}
        </View>

        {onReport && (
          <TouchableOpacity
            onPress={() => onReport(toilet)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.reportLink}>Stimmt nicht?</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        style={[styles.navButton, isNearest && styles.nearestNavButton]}
        onPress={() => onNavigate(toilet)}
        activeOpacity={0.8}
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        accessibilityRole="button"
        accessibilityLabel="Route starten"
      >
        <Text style={styles.navButtonText}>Route</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 84,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e0e0e0',
  },
  nearestContainer: {
    backgroundColor: '#f0f9f0',
  },
  favButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  favIcon: {
    fontSize: 22,
    color: '#ccc',
  },
  favIconActive: {
    color: '#f5a623',
  },
  info: {
    flex: 1,
    marginRight: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1a1a1a',
    flexShrink: 1,
  },
  nearestName: {
    color: '#1b7a2b',
  },
  dimName: {
    color: '#888',
  },
  badge: {
    backgroundColor: '#34a853',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
    gap: 6,
  },
  categoryBadge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 8,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#fff',
  },
  distance: {
    fontSize: 14,
    color: '#666',
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 3,
    flexWrap: 'wrap',
  },
  detail: {
    fontSize: 12,
    color: '#888',
  },
  detailHighlight: {
    fontSize: 12,
    color: '#34a853',
    fontWeight: '600',
  },
  reportLink: {
    fontSize: 12, color: '#1a73e8', marginTop: 4,
  },
  navButton: {
    backgroundColor: '#1a73e8',
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 24,
    minWidth: 80,
    alignItems: 'center',
  },
  nearestNavButton: {
    backgroundColor: '#34a853',
  },
  navButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
