import React, { useRef, useCallback, useState, useMemo } from 'react';
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
import { formatDistance } from './src/services/overpass';
import { ReportSheet } from './src/components/ReportSheet';

const isWeb = Platform.OS === 'web';

let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = null;

if (!isWeb) {
  const maps = require('react-native-maps');
  MapView = maps.default;
  Marker = maps.Marker;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

function openNavigation(toilet: Toilet) {
  const url = Platform.select({
    ios: `maps://app?daddr=${toilet.lat},${toilet.lon}&dirflg=w`,
    android: `google.navigation:q=${toilet.lat},${toilet.lon}&mode=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lon}&travelmode=walking`,
  });
  if (url) Linking.openURL(url);
}

const CITIES: Record<string, { lat: number; lon: number }> = {
  'Hannover': { lat: 52.3759, lon: 9.7320 },
  'Dortmund': { lat: 51.5136, lon: 7.4653 },
  'Berlin': { lat: 52.5200, lon: 13.4050 },
  'Hamburg': { lat: 53.5511, lon: 9.9937 },
  'München': { lat: 48.1351, lon: 11.5820 },
  'Köln': { lat: 50.9375, lon: 6.9603 },
  'Frankfurt': { lat: 50.1109, lon: 8.6821 },
};

function AppContent() {
  const { toilets, nearest, userLocation, searchLocation, loading, error, refresh, searchAt, backToMyLocation } = useToilets();
  const { toggleFavorite, isFavorite } = useFavorites();
  const mapRef = useRef<any>(null);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [filter, setFilter] = useState<'reliable' | 'favorites' | 'all'>('reliable');
  const [mapMoved, setMapMoved] = useState(false);
  const [mapCenter, setMapCenter] = useState<{ lat: number; lon: number } | null>(null);
  const [showCities, setShowCities] = useState(false);
  const [reportToilet, setReportToilet] = useState<Toilet | undefined>(undefined);
  const [showReport, setShowReport] = useState(false);
  const [mapRegion, setMapRegion] = useState<{ lat: number; lon: number; latD: number; lonD: number } | null>(null);

  // --- Callbacks ---

  const focusToilet = useCallback((toilet: Toilet) => {
    setSelectedToilet(toilet);
    setListExpanded(false);
    if (!isWeb) {
      mapRef.current?.animateToRegion(
        { latitude: toilet.lat, longitude: toilet.lon, latitudeDelta: 0.005, longitudeDelta: 0.005 },
        500
      );
    }
  }, []);

  const focusUser = useCallback(() => {
    backToMyLocation();
    setMapMoved(false);
    setShowCities(false);
    if (userLocation && !isWeb) {
      mapRef.current?.animateToRegion(
        { latitude: userLocation.lat, longitude: userLocation.lon, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        500
      );
    }
  }, [userLocation, backToMyLocation]);

  const handleSearchHere = useCallback(() => {
    if (mapCenter) {
      searchAt(mapCenter.lat, mapCenter.lon);
      setMapMoved(false);
    }
  }, [mapCenter, searchAt]);

  const handleRegionChange = useCallback((region: any) => {
    setMapCenter({ lat: region.latitude, lon: region.longitude });
    setMapRegion({ lat: region.latitude, lon: region.longitude, latD: region.latitudeDelta, lonD: region.longitudeDelta });
    setMapMoved(true);
  }, []);

  const jumpToCity = useCallback((name: string) => {
    const city = CITIES[name];
    if (!city) return;
    searchAt(city.lat, city.lon);
    setShowCities(false);
    setMapMoved(false);
    if (!isWeb) {
      mapRef.current?.animateToRegion(
        { latitude: city.lat, longitude: city.lon, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        500
      );
    }
  }, [searchAt]);

  // --- Derived data ---

  const visibleToilets = useMemo(() => {
    if (!mapRegion) return toilets.slice(0, 50);
    const pad = 0.1;
    return toilets
      .filter((t) =>
        t.lat > mapRegion.lat - mapRegion.latD / 2 - pad &&
        t.lat < mapRegion.lat + mapRegion.latD / 2 + pad &&
        t.lon > mapRegion.lon - mapRegion.lonD / 2 - pad &&
        t.lon < mapRegion.lon + mapRegion.lonD / 2 + pad
      )
      .slice(0, 50);
  }, [toilets, mapRegion]);

  const filteredToilets = filter === 'favorites'
    ? toilets.filter((t) => isFavorite(t.id))
    : filter === 'reliable'
    ? toilets.filter((t) => t.category === 'public_24h' || t.category === 'station')
    : toilets;

  const reliableNearest = toilets.find(
    (t) => t.category === 'public_24h' || t.category === 'station'
  ) || nearest;

  const reliableCount = toilets.filter(
    (t) => t.category === 'public_24h' || t.category === 'station'
  ).length;

  // --- Loading ---
  if (loading && !userLocation) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <ActivityIndicator size="large" color="#1a73e8" />
        <Text style={styles.loadingTitle}>WC Finder</Text>
        <Text style={styles.loadingSub}>Standort wird ermittelt...</Text>
      </SafeAreaView>
    );
  }

  // --- Error ---
  if (error && toilets.length === 0) {
    return (
      <SafeAreaView style={styles.centered}>
        <StatusBar style="dark" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.primaryBtn} onPress={refresh}>
          <Text style={styles.primaryBtnText}>Erneut versuchen</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // --- Compact nearest card for bottom panel ---
  const nearestCard = reliableNearest && (
    <TouchableOpacity
      style={styles.nearestCard}
      onPress={() => openNavigation(reliableNearest)}
      activeOpacity={0.85}
    >
      <View style={styles.nearestInfo}>
        <Text style={styles.nearestLabel}>Nächste 24/7 Toilette</Text>
        <Text style={styles.nearestName} numberOfLines={1}>
          {reliableNearest.name || 'Barrierefreie Toilette'}
          {reliableNearest.city ? ` · ${reliableNearest.city}` : ''}
        </Text>
      </View>
      <View style={styles.nearestRight}>
        {reliableNearest.distance != null && (
          <Text style={styles.nearestDist}>{formatDistance(reliableNearest.distance)}</Text>
        )}
        <View style={styles.nearestNavBtn}>
          <Text style={styles.nearestNavText}>Route</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  // --- Filter chips ---
  const filterBar = (
    <View style={styles.filterBar}>
      {([
        { key: 'reliable' as const, label: `24/7 (${reliableCount})` },
        { key: 'favorites' as const, label: '\u2605 Favoriten' },
        { key: 'all' as const, label: `Alle (${toilets.length})` },
      ]).map((f) => (
        <TouchableOpacity
          key={f.key}
          style={[styles.chip, filter === f.key && (f.key === 'favorites' ? styles.chipFav : styles.chipActive)]}
          onPress={() => setFilter(f.key)}
        >
          <Text style={[styles.chipText, filter === f.key && styles.chipTextActive]}>
            {f.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );

  // --- List ---
  const renderList = () => (
    <>
      {filterBar}
      <FlatList
        data={filteredToilets}
        keyExtractor={(item) => item.id}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={5}
        renderItem={({ item }) => (
          <ToiletListItem
            toilet={item}
            isNearest={item.id === nearest?.id}
            isFavorite={isFavorite(item.id)}
            onNavigate={openNavigation}
            onSelect={focusToilet}
            onToggleFavorite={toggleFavorite}
            onReport={(t) => { setReportToilet(t); setShowReport(true); }}
          />
        )}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>
              {filter === 'favorites'
                ? 'Noch keine Favoriten gespeichert.'
                : filter === 'reliable'
                ? 'Keine 24/7-Toiletten in der Nähe.'
                : 'Keine Toiletten gefunden.'}
            </Text>
          </View>
        }
      />
    </>
  );

  // --- WEB (debug only) ---
  if (isWeb) {
    return (
      <SafeAreaView style={styles.flex}>
        <StatusBar style="dark" />
        <View style={styles.webHeader}>
          <Text style={styles.webTitle}>WC Finder</Text>
        </View>
        {nearestCard}
        {renderList()}
      </SafeAreaView>
    );
  }

  // --- NATIVE ---
  return (
    <View style={styles.flex}>
      <StatusBar style="dark" />

      {/* Map */}
      <View style={listExpanded ? styles.mapSmall : styles.mapFull}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'android' ? PROVIDER_GOOGLE : undefined}
          initialRegion={
            userLocation
              ? { latitude: userLocation.lat, longitude: userLocation.lon, latitudeDelta: 0.04, longitudeDelta: 0.04 }
              : { latitude: 52.3759, longitude: 9.732, latitudeDelta: 0.1, longitudeDelta: 0.1 }
          }
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          onRegionChangeComplete={handleRegionChange}
        >
          {visibleToilets.map((toilet) => (
            <Marker
              key={toilet.id}
              coordinate={{ latitude: toilet.lat, longitude: toilet.lon }}
              title={toilet.name || 'Barrierefreie Toilette'}
              description={toilet.distance != null ? formatDistance(toilet.distance) : undefined}
              onPress={() => focusToilet(toilet)}
              pinColor={toilet.id === nearest?.id ? '#34a853' : '#1a73e8'}
              tracksViewChanges={false}
            />
          ))}
        </MapView>

        {/* Search bar overlay */}
        <TouchableOpacity
          style={styles.searchBar}
          onPress={() => setShowCities(!showCities)}
          activeOpacity={0.9}
        >
          <Text style={styles.searchBarText}>
            {searchLocation ? 'Anderer Standort' : 'Stadt suchen...'}
          </Text>
          {searchLocation && (
            <TouchableOpacity onPress={focusUser} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.searchBarReset}>Zurück</Text>
            </TouchableOpacity>
          )}
        </TouchableOpacity>

        {/* City chips */}
        {showCities && (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.cityRow}
            contentContainerStyle={styles.cityRowContent}
          >
            {Object.keys(CITIES).map((name) => (
              <TouchableOpacity key={name} style={styles.cityChip} onPress={() => jumpToCity(name)}>
                <Text style={styles.cityChipText}>{name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* "Hier suchen" pill */}
        {mapMoved && !showCities && (
          <TouchableOpacity style={styles.searchHerePill} onPress={handleSearchHere} activeOpacity={0.9}>
            <Text style={styles.searchHereText}>Hier suchen</Text>
          </TouchableOpacity>
        )}

        {/* My location button */}
        <TouchableOpacity style={styles.locBtn} onPress={focusUser} activeOpacity={0.8}>
          <Text style={styles.locBtnIcon}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom panel */}
      <View style={styles.panel}>
        {/* Nearest card */}
        {nearestCard}

        {/* Toggle list */}
        <TouchableOpacity style={styles.toggleBar} onPress={() => setListExpanded(!listExpanded)} activeOpacity={0.7}>
          <View style={styles.toggleHandle} />
          <Text style={styles.toggleLabel}>
            {listExpanded ? 'Karte zeigen' : `${filteredToilets.length} Toiletten`}
          </Text>
        </TouchableOpacity>

        {listExpanded && <View style={styles.listWrap}>{renderList()}</View>}
      </View>

      {/* Report FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => { setReportToilet(undefined); setShowReport(true); }}
        activeOpacity={0.85}
      >
        <Text style={styles.fabIcon}>+</Text>
        <Text style={styles.fabLabel}>Melden</Text>
      </TouchableOpacity>

      {/* Report sheet */}
      <ReportSheet toilet={reportToilet} visible={showReport} onClose={() => setShowReport(false)} />
    </View>
  );
}

const S = {
  blue: '#1a73e8',
  green: '#34a853',
  bg: '#fff',
  textPrimary: '#1a1a1a',
  textSecondary: '#666',
  textMuted: '#999',
  border: '#e8e8e8',
  shadow: { shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 4, elevation: 3 } as const,
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: S.bg },
  map: { flex: 1 },
  mapFull: { flex: 1 },
  mapSmall: { height: 200 },

  // Loading / Error
  centered: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    backgroundColor: S.bg, paddingHorizontal: 32,
  },
  loadingTitle: { marginTop: 20, fontSize: 22, fontWeight: '700', color: S.textPrimary },
  loadingSub: { marginTop: 6, fontSize: 14, color: S.textSecondary },
  errorText: { fontSize: 16, color: S.textPrimary, textAlign: 'center', marginBottom: 20, lineHeight: 22 },
  primaryBtn: { backgroundColor: S.blue, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 24 },
  primaryBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // Web
  webHeader: { paddingTop: 48, paddingBottom: 16, paddingHorizontal: 20, backgroundColor: S.blue },
  webTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },

  // Search bar
  searchBar: {
    position: 'absolute', top: 52, left: 16, right: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#fff', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12,
    ...S.shadow,
  },
  searchBarText: { fontSize: 15, color: S.textMuted },
  searchBarReset: { fontSize: 13, color: S.blue, fontWeight: '700' },

  // City chips
  cityRow: { position: 'absolute', top: 102, left: 0, right: 0 },
  cityRowContent: { paddingHorizontal: 16, gap: 8 },
  cityChip: {
    backgroundColor: '#fff', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8,
    ...S.shadow,
  },
  cityChipText: { fontSize: 13, fontWeight: '600', color: S.textPrimary },

  // Search here
  searchHerePill: {
    position: 'absolute', top: 102, alignSelf: 'center',
    backgroundColor: S.blue, borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10,
    ...S.shadow,
  },
  searchHereText: { fontSize: 13, color: '#fff', fontWeight: '700' },

  // Location button
  locBtn: {
    position: 'absolute', bottom: 16, right: 16,
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#fff',
    alignItems: 'center', justifyContent: 'center',
    ...S.shadow,
  },
  locBtnIcon: { fontSize: 20, color: S.blue },

  // Bottom panel
  panel: {
    backgroundColor: S.bg,
    borderTopLeftRadius: 16, borderTopRightRadius: 16,
    shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 6, elevation: 8,
  },

  // Nearest card
  nearestCard: {
    flexDirection: 'row', alignItems: 'center',
    marginHorizontal: 16, marginTop: 14, marginBottom: 4,
    padding: 14, backgroundColor: '#f4fbf5', borderRadius: 14,
    borderWidth: 1, borderColor: '#d4edda',
  },
  nearestInfo: { flex: 1, marginRight: 10 },
  nearestLabel: { fontSize: 11, fontWeight: '700', color: S.green, textTransform: 'uppercase', letterSpacing: 0.5 },
  nearestName: { fontSize: 14, fontWeight: '600', color: S.textPrimary, marginTop: 2 },
  nearestRight: { alignItems: 'center', gap: 4 },
  nearestDist: { fontSize: 13, fontWeight: '700', color: S.textSecondary },
  nearestNavBtn: { backgroundColor: S.green, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20 },
  nearestNavText: { color: '#fff', fontSize: 13, fontWeight: '700' },

  // Toggle bar
  toggleBar: { alignItems: 'center', paddingVertical: 10 },
  toggleHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: '#d8d8d8', marginBottom: 5 },
  toggleLabel: { fontSize: 13, color: S.textMuted, fontWeight: '500' },
  listWrap: { maxHeight: 420 },

  // Filter chips
  filterBar: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 8, gap: 6 },
  chip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, backgroundColor: '#f0f0f0' },
  chipActive: { backgroundColor: S.blue },
  chipFav: { backgroundColor: '#f5a623' },
  chipText: { fontSize: 13, fontWeight: '600', color: S.textSecondary },
  chipTextActive: { color: '#fff' },

  // Report FAB
  fab: {
    position: 'absolute', bottom: 20, right: 16,
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: S.blue, borderRadius: 24,
    paddingHorizontal: 16, paddingVertical: 12,
    ...S.shadow,
  },
  fabIcon: { fontSize: 18, color: '#fff', fontWeight: '700' },
  fabLabel: { fontSize: 13, color: '#fff', fontWeight: '600' },

  // List
  listContent: { paddingBottom: 40 },
  emptyState: { alignItems: 'center', paddingVertical: 32, paddingHorizontal: 24 },
  emptyText: { fontSize: 15, color: S.textMuted, textAlign: 'center' },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
