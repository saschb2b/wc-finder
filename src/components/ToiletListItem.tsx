import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Toilet } from '../types/toilet';
import { formatDistance, formatWheelchairTime } from '../services/overpass';

interface ToiletListItemProps {
  toilet: Toilet;
  isNearest?: boolean;
  isFavorite?: boolean;
  onNavigate: (toilet: Toilet) => void;
  onSelect: (toilet: Toilet) => void;
  onToggleFavorite?: (id: string) => void;
}

export function ToiletListItem({
  toilet,
  isNearest,
  isFavorite,
  onNavigate,
  onSelect,
  onToggleFavorite,
}: ToiletListItemProps) {
  const displayName = toilet.name || 'Barrierefreie Toilette';

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
          <Text style={[styles.name, isNearest && styles.nearestName]} numberOfLines={1}>
            {displayName}
          </Text>
          {isNearest && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Nächste</Text>
            </View>
          )}
        </View>

        {toilet.distance != null && (
          <View style={styles.metaRow}>
            <Text style={styles.time}>{formatWheelchairTime(toilet.distance)}</Text>
            <Text style={styles.separator}> · </Text>
            <Text style={styles.distance}>{formatDistance(toilet.distance)}</Text>
          </View>
        )}

        {toilet.city && (
          <Text style={styles.detail} numberOfLines={1}>
            {toilet.city}
            {toilet.tags?.includes('kostenlos') ? ' · Kostenlos' : ''}
          </Text>
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
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    paddingHorizontal: 16,
    minHeight: 80,
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
    marginTop: 4,
  },
  time: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a73e8',
  },
  separator: {
    fontSize: 14,
    color: '#999',
  },
  distance: {
    fontSize: 14,
    color: '#666',
  },
  detail: {
    fontSize: 13,
    color: '#888',
    marginTop: 2,
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
