import React, { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Toilet } from '../types/toilet';
import { openReport } from '../services/report';

interface ReportSheetProps {
  toilet?: Toilet;
  visible: boolean;
  onClose: () => void;
}

const OPTIONS = [
  { type: 'wrong' as const, icon: '✏️', label: 'Daten stimmen nicht', sub: 'Position, Öffnungszeiten, Barrierefreiheit' },
  { type: 'closed' as const, icon: '🚫', label: 'Existiert nicht mehr', sub: 'Toilette ist dauerhaft geschlossen' },
  { type: 'info' as const, icon: '💡', label: 'Info hinzufügen', sub: 'Hinweis, Tipp, Öffnungszeiten' },
  { type: 'new' as const, icon: '📍', label: 'Neue Toilette melden', sub: 'Fehlt auf der Karte' },
];

export const ReportSheet = memo(function ReportSheet({ toilet, visible, onClose }: ReportSheetProps) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>
            {toilet ? 'Problem melden' : 'Toilette melden'}
          </Text>
          {toilet && (
            <Text style={styles.subtitle} numberOfLines={1}>
              {toilet.name} · {toilet.city}
            </Text>
          )}

          <View style={styles.options}>
            {OPTIONS
              .filter((o) => toilet ? o.type !== 'new' : o.type === 'new')
              .map((o) => (
                <TouchableOpacity
                  key={o.type}
                  style={styles.option}
                  onPress={() => { openReport(o.type, toilet); onClose(); }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.optionIcon}>{o.icon}</Text>
                  <View style={styles.optionText}>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                    <Text style={styles.optionSub}>{o.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
          </View>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>Abbrechen</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 12,
    paddingBottom: 40,
    paddingHorizontal: 20,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: '#d0d0d0', alignSelf: 'center', marginBottom: 16,
  },
  title: {
    fontSize: 20, fontWeight: '700', color: '#1a1a1a',
  },
  subtitle: {
    fontSize: 14, color: '#888', marginTop: 2,
  },
  options: {
    marginTop: 20, gap: 4,
  },
  option: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: 16, paddingHorizontal: 4,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  optionIcon: {
    fontSize: 24, width: 40,
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 16, fontWeight: '600', color: '#1a1a1a',
  },
  optionSub: {
    fontSize: 13, color: '#888', marginTop: 1,
  },
  cancelBtn: {
    marginTop: 16, alignItems: 'center', paddingVertical: 14,
    backgroundColor: '#f0f0f0', borderRadius: 24,
  },
  cancelText: {
    fontSize: 16, fontWeight: '600', color: '#666',
  },
});
