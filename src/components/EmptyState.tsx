import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { lightImpact } from '../utils/haptics';
import { t } from '../i18n';
import { useThemedStyles, type Colors } from "../theme";

interface EmptyStateProps {
  type: 'no-results' | 'no-location' | 'error' | 'loading';
  onAction?: () => void;
  message?: string;
}

const configs = {
  'no-results': { icon: '🔍', key: 'noResults', hasAction: true },
  'no-location': { icon: '📍', key: 'noLocation', hasAction: true },
  'error': { icon: '⚠️', key: 'error', hasAction: true },
  'loading': { icon: '⏳', key: 'loading', hasAction: false },
} as const;

export function EmptyState({ type, onAction, message }: EmptyStateProps) {
  const styles = useThemedStyles(makeStyles);
  const config = configs[type];
  const title = t(`empty.${config.key}.title`);
  const description = t(`empty.${config.key}.description`);
  const actionLabel = config.hasAction ? t(`empty.${config.key}.action`) : undefined;

  const handleAction = () => {
    lightImpact();
    onAction?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>
        {message || description}
      </Text>
      {actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={handleAction}>
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: c.background,
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: c.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: c.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: c.primary,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 22,
  },
  buttonText: {
    color: c.onPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
