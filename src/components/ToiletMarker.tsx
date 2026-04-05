import React from 'react';
import { View, StyleSheet } from 'react-native';

interface ToiletMarkerProps {
  isNearest?: boolean;
}

export function ToiletMarker({ isNearest }: ToiletMarkerProps) {
  return (
    <View style={[styles.marker, isNearest && styles.nearestMarker]}>
      <View style={[styles.inner, isNearest && styles.nearestInner]} />
    </View>
  );
}

const styles = StyleSheet.create({
  marker: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(26, 115, 232, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  nearestMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(52, 168, 83, 0.25)',
  },
  inner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a73e8',
    borderWidth: 2,
    borderColor: '#fff',
  },
  nearestInner: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#34a853',
  },
});
