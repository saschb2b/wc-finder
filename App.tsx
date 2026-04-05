import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  FlatList,
  Linking,
  ScrollView,
} from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useToilets } from './src/hooks/useToilets';
import { useFavorites } from './src/hooks/useFavorites';
import { ToiletListItem } from './src/components/ToiletListItem';
import { Toilet } from './src/types/toilet';
import { formatDistance, formatWheelchairTime } from './src/services/overpass';

const isWeb = Platform.OS === 'web';

// Lazy-load native-only map
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;
let ToiletMarker: any = null;

if (!isWeb) {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  ToiletMarker = require('./src/components/ToiletMarker').ToiletMarker;
}

function openNavigation(toilet: Toilet) {
  const url = Platform.select({
    ios: `maps://app?daddr=${toilet.lat},${toilet.lon}&dirflg=w`,
    android: `google.navigation:q=${toilet.lat},${toilet.lon}&mode=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lon}&travelmode=walking`,
  });
  if (url) Linking.openURL(url);
}

function AppContent() {
  const { toilets, nearest, userLocation, loading, error, refresh } = useToilets();
  const { toggleFavorite, isFavorite } = useFavorites();
  const mapRef = useRef<any>(null);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);

  const focusToilet = useCallback((toilet: Toilet) => {
    setSelectedToilet(toilet);
    setListExpanded(false);
    if (!isWeb) {
      mapRef.current?.animateToRegion(
        {
          latitude: toilet.lat,
          longitude: toilet.lon,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500
      );
    }
  }, []);

  const focusUser = useCallback(() => {
    if (userLocation && !isWeb) {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.lat,
          longitude: userLocation.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500
      );
    }
  }, [userLocation]);

  const displayedToilet = selectedToilet || nearest;

  const filteredToilets = showFavoritesOnly
    ? toilets.filter((t) => isFavorite(t.id))
    : toilets;

  // --- LOADING ---
  if (loading && !userLocation) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingText}>Standort wird ermittelt...</Text>
        <Text style={styles.loadingSubtext}>Suche barrierefreie Toiletten in der Nähe</Text>
      </SafeAreaView>
    );
  }

  // --- ERROR ---
  if (error && toilets.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- EMERGENCY BUTTON ---
  const emergencyButton = nearest && (
    <TouchableOpacity
      style={styles.emergencyButton}
      onPress={() => openNavigation(nearest)}
      activeOpacity={0.85}
      accessibilityRole="button"
      accessibilityLabel={`Nächste Toilette jetzt navigieren, ${nearest.distance != null ? formatWheelchairTime(nearest.distance) : ''}`}
    >
      <Text style={styles.emergencyLabel}>Nächste Toilette</Text>
      <Text style={styles.emergencyTime}>
        {nearest.distance != null ? formatWheelchairTime(nearest.distance) : ''}
      </Text>
      <Text style={styles.emergencyDist}>
        {nearest.distance != null ? formatDistance(nearest.distance) : ''}
        {nearest.city ? ` �� ${nearest.city}` : ''}
      </Text>
      <View style={styles.emergencyAction}>
        <Text style={styles.emergencyActionText}>JETZT NAVIGIEREN</Text>
      </View>
    </TouchableOpacity>
  );

  // --- Filter bar ---
  const filterBar = (
    <View style={styles.filterBar}>
      <TouchableOpacity
        style={[styles.filterChip, !showFavoritesOnly && styles.filterChipActive]}
        onPress={() => setShowFavoritesOnly(false)}
      >
        <Text style={[styles.filterChipText, !showFavoritesOnly && styles.filterChipTextActive]}>
          Alle ({toilets.length})
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.filterChip, showFavoritesOnly && styles.filterChipActive]}
        onPress={() => setShowFavoritesOnly(true)}
      >
        <Text style={[styles.filterChipText, showFavoritesOnly && styles.filterChipTextActive]}>
          {'\u2605'} Favoriten
        </Text>
      </TouchableOpacity>
    </View>
  );

  const renderList = () => (
    <>
      {filterBar}
      <FlatList
        data={filteredToilets}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <ToiletListItem
            toilet={item}
            isNearest={item.id === nearest?.id}
            isFavorite={isFavorite(item.id)}
            onNavigate={openNavigation}
            onSelect={focusToilet}
            onToggleFavorite={toggleFavorite}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {showFavoritesOnly
                ? 'Noch keine Favoriten gespeichert.'
                : 'Keine Toiletten gefunden.'}
            </Text>
          </View>
        }
      />
    </>
  );

  // --- WEB ---
  if (isWeb) {
    return (
      <SafeAreaView style={styles.flex}>
        <StatusBar style="dark" />
        <View style={styles.webHeader}>
          <Text style={styles.webTitle}>WC Finder</Text>
        </View>
        {emergencyButton}
        {renderList()}
      </SafeAreaView>
    );
  }

  // --- NATIVE ---
  return (
    <View style={styles.flex}>
      <StatusBar style="dark" />

      {/* Map */}
      <View style={listExpanded ? styles.mapCollapsed : styles.mapExpanded}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={
            userLocation
              ? {
                  latitude: userLocation.lat,
                  longitude: userLocation.lon,
                  latitudeDelta: 0.04,
                  longitudeDelta: 0.04,
                }
              : {
                  latitude: 52.3759,
                  longitude: 9.732,
                  latitudeDelta: 0.1,
                  longitudeDelta: 0.1,
                }
          }
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
        >
          {toilets.map((toilet) => (
            <Marker
              key={toilet.id}
              coordinate={{ latitude: toilet.lat, longitude: toilet.lon }}
              title={toilet.name || 'Barrierefreie Toilette'}
              description={toilet.distance != null ? formatDistance(toilet.distance) : undefined}
              onPress={() => focusToilet(toilet)}
            >
              <ToiletMarker isNearest={toilet.id === nearest?.id} />
            </Marker>
          ))}
        </MapView>

        {/* Map buttons */}
        <TouchableOpacity style={styles.myLocationBtn} onPress={focusUser} activeOpacity={0.8}>
          <Text style={styles.myLocationIcon}>◎</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.refreshBtn} onPress={refresh} activeOpacity={0.8}>
          <Text style={styles.refreshIcon}>↻</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={styles.bottomPanel}>
        {/* Emergency button */}
        {emergencyButton}

        {/* Toggle list */}
        <TouchableOpacity
          style={styles.toggleBar}
          onPress={() => setListExpanded(!listExpanded)}
          activeOpacity={0.7}
        >
          <View style={styles.toggleHandle} />
          <Text style={styles.toggleText}>
            {listExpanded ? 'Karte zeigen' : `${toilets.length} Toiletten in der Nähe`}
          </Text>
        </TouchableOpacity>

        {listExpanded && <View style={styles.listContainer}>{renderList()}</View>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: '#fff' },
  map: { flex: 1 },
  mapExpanded: { flex: 1 },
  mapCollapsed: { height: 180 },
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff', paddingHorizontal: 32,
  },
  loadingText: { marginTop: 16, fontSize: 18, fontWeight: '600', color: '#1a1a1a' },
  loadingSubtext: { marginTop: 6, fontSize: 14, color: '#666' },
  errorText: { fontSize: 16, color: '#333', textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  retryButton: { backgroundColor: '#1a73e8', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  retryText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Web
  webHeader: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: '#1a73e8' },
  webTitle: { fontSize: 24, fontWeight: '700', color: '#fff' },

  // Emergency button
  emergencyButton: {
    marginHorizontal: 16, marginVertical: 10, padding: 20,
    backgroundColor: '#34a853', borderRadius: 20,
    alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2, shadowRadius: 8, elevation: 6,
  },
  emergencyLabel: {
    fontSize: 13, fontWeight: '600', color: 'rgba(255,255,255,0.85)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  emergencyTime: {
    fontSize: 36, fontWeight: '800', color: '#fff', marginTop: 2,
  },
  emergencyDist: {
    fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 2,
  },
  emergencyAction: {
    marginTop: 14, backgroundColor: '#fff',
    paddingHorizontal: 32, paddingVertical: 14, borderRadius: 28,
  },
  emergencyActionText: {
    fontSize: 16, fontWeight: '800', color: '#34a853', letterSpacing: 0.5,
  },

  // Filter bar
  filterBar: {
    flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
    backgroundColor: '#f0f0f0',
  },
  filterChipActive: {
    backgroundColor: '#1a73e8',
  },
  filterChipText: {
    fontSize: 14, fontWeight: '600', color: '#666',
  },
  filterChipTextActive: {
    color: '#fff',
  },

  // Map buttons
  myLocationBtn: {
    position: 'absolute', top: 60, right: 16,
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  myLocationIcon: { fontSize: 24, color: '#1a73e8' },
  refreshBtn: {
    position: 'absolute', top: 116, right: 16,
    width: 48, height: 48, borderRadius: 24, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4, elevation: 4,
  },
  refreshIcon: { fontSize: 24, color: '#1a73e8' },

  // Bottom panel
  bottomPanel: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    shadowColor: '#000', shadowOffset: { width: 0, height: -3 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 10,
    paddingTop: 4,
  },
  toggleBar: { alignItems: 'center', paddingVertical: 10 },
  toggleHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: '#d0d0d0', marginBottom: 6 },
  toggleText: { fontSize: 14, color: '#888', fontWeight: '500' },
  listContainer: { maxHeight: 420 },

  // List
  listContent: { paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyText: { fontSize: 16, color: '#666', textAlign: 'center' },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
