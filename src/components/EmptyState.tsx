import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { lightImpact } from '../utils/haptics';

interface EmptyStateProps {
  type: 'no-results' | 'no-location' | 'error' | 'loading';
  onAction?: () => void;
  message?: string;
}

const configs = {
  'no-results': {
    icon: '🔍',
    title: 'Keine Toiletten gefunden',
    description: 'Versuche es in einem anderen Gebiet oder ändere deine Filter.',
    actionLabel: 'Filter zurücksetzen',
  },
  'no-location': {
    icon: '📍',
    title: 'Standort nicht verfügbar',
    description: 'Erlaube den Zugriff auf deinen Standort, um Toiletten in deiner Nähe zu finden.',
    actionLabel: 'Standort aktivieren',
  },
  'error': {
    icon: '⚠️',
    title: 'Etwas ist schiefgelaufen',
    description: 'Die Toiletten-Daten konnten nicht geladen werden. Bitte versuche es erneut.',
    actionLabel: 'Erneut versuchen',
  },
  'loading': {
    icon: '⏳',
    title: 'Lade Toiletten...',
    description: 'Sammle die neuesten Daten für dich.',
    actionLabel: undefined,
  },
};

export function EmptyState({ type, onAction, message }: EmptyStateProps) {
  const config = configs[type];

  const handleAction = () => {
    lightImpact();
    onAction?.();
  };

  return (
    <View style={styles.container}>
      <Text style={styles.icon}>{config.icon}</Text>
      <Text style={styles.title}>{config.title}</Text>
      <Text style={styles.description}>
        {message || config.description}
      </Text>
      {config.actionLabel && onAction && (
        <TouchableOpacity style={styles.button} onPress={handleAction}>
          <Text style={styles.buttonText}>{config.actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#f8f9fa',
  },
  icon: {
    fontSize: 48,
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1a1a1a',
    textAlign: 'center',
    marginBottom: 8,
  },
  description: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#1a73e8',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 22,
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});
