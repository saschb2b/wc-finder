import React from 'react';
import { Image } from 'react-native';

/** Decorative artwork; the adjacent heading supplies the accessible name. */
export function BrandIcon({ size = 32 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/brand/app-icon.png')}
      style={{ width: size, height: size, borderRadius: size * 0.223 }}
      resizeMode="contain"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
