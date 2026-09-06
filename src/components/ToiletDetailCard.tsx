import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Toilet, CATEGORY_LABELS, CATEGORY_COLORS } from '../types/toilet';
import { formatDistance } from '../services/overpass';
import { ToiletHours } from './ToiletHours';
import { CareFacilitiesDisplay } from './CareFacilitiesDisplay';
import { ToiletSources } from './ToiletSources';
import { isWithinAvailability } from '../utils/toilet-availability';

interface ToiletDetailCardProps {
  toilet: Toilet;
  isSelected?: boolean;
  onNavigate: () => void;
  onReport: () => void;
}

export function ToiletDetailCard({
  toilet,
  isSelected = false,
  onNavigate,
  onReport
}: ToiletDetailCardProps) {
  const hasEurokey = toilet.tags?.includes('eurokey');
  const isWheelchairAccessible = toilet.tags?.includes('barrierefrei');
  const isFree = toilet.tags?.includes('kostenlos') || toilet.fee === 'no';
  const is24_7 = toilet.hours?.type === '24_7' && isWithinAvailability(toilet);

  const categoryColor = CATEGORY_COLORS[toilet.category];
  const categoryLabel = CATEGORY_LABELS[toilet.category];

  return (
    <View style={[styles.container, isSelected && styles.selected]}>
      {/* Header with category and distance */}
      <View style={styles.header}>
        <View style={[styles.categoryBadge, { backgroundColor: categoryColor }]}>
          <Text style={styles.categoryText}>{categoryLabel}</Text>
        </View>
        {toilet.distance != null && (
          <Text style={styles.distance}>{formatDistance(toilet.distance)}</Text>
        )}
      </View>

      {/* Name */}
      <Text style={styles.name} numberOfLines={2}>
        {toilet.name || "Barrierefreie Toilette"}
      </Text>

      {/* Address/City */}
      {(toilet.city || toilet.address) && (
        <Text style={styles.address}>{[toilet.address, toilet.city].filter(Boolean).join(', ')}</Text>
      )}

      {/* Opening Hours */}
      <View style={styles.hoursSection}>
        <ToiletHours toilet={toilet} compact />
      </View>

      {/* Feature Tags */}
      <View style={styles.tagsRow}>
        {hasEurokey && (
          <View style={styles.featureTag}>
            <Text style={styles.featureIcon}>🔑</Text>
            <Text style={styles.featureText}>Eurokey</Text>
          </View>
        )}
        {isWheelchairAccessible && (
          <View style={styles.featureTag}>
            <Text style={styles.featureIcon}>♿</Text>
            <Text style={styles.featureText}>Barrierefrei</Text>
          </View>
        )}
        {isFree && (
          <View style={styles.featureTag}>
            <Text style={styles.featureIcon}>🆓</Text>
            <Text style={styles.featureText}>Kostenlos</Text>
          </View>
        )}
        {is24_7 && (
          <View style={styles.featureTag}>
            <Text style={styles.featureIcon}>🕐</Text>
            <Text style={styles.featureText}>24/7</Text>
          </View>
        )}
      </View>

      <CareFacilitiesDisplay toilet={toilet} />
      {toilet.accessNote && <Text style={styles.address}>{toilet.accessNote}</Text>}
      {toilet.locationNote && <Text style={styles.address}>{toilet.locationNote}</Text>}
      {toilet.fee && toilet.fee !== 'no' && <Text style={styles.address}>
        {toilet.fee === 'yes' ? 'Kostenpflichtig' : `Gebühr: ${toilet.fee}`}
      </Text>}
      <ToiletSources toilet={toilet} />

      {/* Action Buttons */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={onNavigate}
          activeOpacity={0.8}
        >
          <Text style={styles.buttonIcon}>🧭</Text>
          <Text style={styles.primaryButtonText}>Route</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onReport}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>Problem melden</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    margin: 16,
    marginBottom: 8,
  },
  selected: {
    borderWidth: 2,
    borderColor: '#1a73e8',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distance: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1a1a1a',
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1a1a1a',
    marginBottom: 4,
    lineHeight: 24,
  },
  address: {
    fontSize: 14,
    color: '#666',
    marginBottom: 8,
  },
  hoursSection: {
    marginBottom: 12,
  },
  unknownHours: {
    fontSize: 13,
    color: '#9aa0a6',
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  featureTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 4,
  },
  featureIcon: {
    fontSize: 14,
  },
  featureText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#444',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
  },
  primaryButton: {
    backgroundColor: '#1a73e8',
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: '#f0f0f0',
  },
  buttonIcon: {
    fontSize: 16,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: '#666',
    fontSize: 14,
    fontWeight: '600',
  },
});
