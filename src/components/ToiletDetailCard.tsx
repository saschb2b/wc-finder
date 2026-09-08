import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Toilet, CATEGORY_COLORS } from '../types/toilet';
import { t, categoryLabel as categoryLabelFor } from '../i18n';
import { formatDistance } from '../services/overpass';
import { ToiletHours } from './ToiletHours';
import { CareFacilitiesDisplay } from './CareFacilitiesDisplay';
import { ToiletSources } from './ToiletSources';
import { Chip } from './Chip';
import { lastChecked, lastCheckedLabel, freshnessTone } from '../utils/data-freshness';
import { useThemedStyles, type Colors } from "../theme";

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
  const styles = useThemedStyles(makeStyles);
  const hasEurokey = toilet.tags?.includes('eurokey');
  const isFree = toilet.tags?.includes('kostenlos') || toilet.fee === 'no';

  const checked = lastChecked(toilet);
  const tone = freshnessTone(checked);
  const categoryColor = CATEGORY_COLORS[toilet.category];
  const categoryLabel = categoryLabelFor(toilet.category);

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
        {toilet.name || t('toilet.fallbackName')}
      </Text>

      {/* Address/City */}
      {(toilet.city || toilet.address) && (
        <Text style={styles.address}>{[toilet.address, toilet.city].filter(Boolean).join(', ')}</Text>
      )}

      {/* Last checked: as prominent as the address, never hidden behind the sources toggle.
          Text only, so green stays reserved for "open". */}
      <Text style={[styles.address, styles.checkedText, tone === 'stale' && checked && styles.checkedStale, !checked && styles.checkedUnknown]}>
        {lastCheckedLabel(toilet)}
        {tone === 'stale' && checked ? ` · ${t('toilet.mightBeOutdated')}` : ''}
      </Text>

      {/* Opening Hours */}
      <View style={styles.hoursSection}>
        <ToiletHours toilet={toilet} compact />
      </View>

      {/* Facts that are not already stated by the category or the hours line */}
      <View style={styles.tagsRow}>
        {hasEurokey && <Chip icon="🔑" label={t('toilet.eurokey')} />}
        {isFree && <Chip icon="🆓" label={t('toilet.free')} />}
        <CareFacilitiesDisplay toilet={toilet} inline />
      </View>

      <CareFacilitiesDisplay toilet={toilet} detailsOnly />
      {toilet.accessNote && <Text style={styles.address}>{toilet.accessNote}</Text>}
      {toilet.locationNote && <Text style={styles.address}>{toilet.locationNote}</Text>}
      {toilet.fee && toilet.fee !== 'no' && <Text style={styles.address}>
        {toilet.fee === 'yes' ? t('toilet.paid') : t('toilet.fee', { fee: toilet.fee })}
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
          <Text style={styles.primaryButtonText}>{t('action.route')}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={onReport}
          activeOpacity={0.8}
        >
          <Text style={styles.secondaryButtonText}>{t('action.reportProblem')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    backgroundColor: c.surface,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: c.shadowOpacity,
    shadowRadius: 8,
    elevation: 4,
    margin: 16,
    marginBottom: 8,
  },
  selected: {
    borderWidth: 2,
    borderColor: c.primary,
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
    color: c.onPrimary,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  distance: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
  },
  name: {
    fontSize: 18,
    fontWeight: '700',
    color: c.text,
    marginBottom: 4,
    lineHeight: 24,
  },
  address: {
    fontSize: 14,
    color: c.textSecondary,
    marginBottom: 8,
  },
  hoursSection: {
    marginBottom: 12,
  },
  checkedText: {
    fontSize: 13,
  },
  checkedStale: {
    color: c.warningText,
  },
  checkedUnknown: {
    fontStyle: 'italic',
    color: c.textMuted,
  },
  unknownHours: {
    fontSize: 13,
    color: c.textMuted,
    fontStyle: 'italic',
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
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
    backgroundColor: c.primary,
    flex: 1,
  },
  secondaryButton: {
    backgroundColor: c.surfaceAlt,
  },
  buttonIcon: {
    fontSize: 16,
  },
  primaryButtonText: {
    color: c.onPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  secondaryButtonText: {
    color: c.textSecondary,
    fontSize: 14,
    fontWeight: '600',
  },
});
