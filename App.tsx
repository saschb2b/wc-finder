import React, {
  useRef,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  FlatList,
  Linking,
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView, SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useToilets } from "./src/hooks/useToilets";
import { useFavorites } from "./src/hooks/useFavorites";
import { ToiletListItem } from "./src/components/ToiletListItem";
import { isCurrentlyOpen } from "./src/utils/opening-hours";
import { isOpenNow } from "./src/types/opening-hours";
import { ToiletDetailCard } from "./src/components/ToiletDetailCard";
import { ToiletMap } from "./src/components/ToiletMap";
import type { MapPin, MapRegion, ToiletMapHandle } from "./src/map/types";
import { Toilet, CATEGORY_COLORS, PIN_COLORS } from "./src/types/toilet";
import { ReportSheet } from "./src/components/ReportSheet";
import { OnboardingModal } from "./src/components/OnboardingModal";
import { EmptyState } from "./src/components/EmptyState";
import { mediumImpact, successNotification } from "./src/utils/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";

// Filter type must be defined outside component
type FilterMode = "now" | "all";

const isWeb = Platform.OS === "web";

function openNavigationWithHaptics(
  toilet: Toilet,
  showClosedWarning: boolean = true,
) {
  successNotification();
  openNavigation(toilet, showClosedWarning);
}

function openNavigation(toilet: Toilet, showClosedWarning: boolean = true) {
  // Check if toilet is closed
  const openStatus = toilet.hours ? isOpenNow(toilet.hours) : null;

  if (openStatus === false && showClosedWarning) {
    // Show warning before navigating
    const hoursText = toilet.hours?.original || "unbekannt";
    Alert.alert(
      "Toilette geschlossen",
      `\"${toilet.name}\" ist aktuell geschlossen (Öffnungszeiten: ${hoursText}).\n\nTrotzdem Navigation starten?`,
      [
        { text: "Abbrechen", style: "cancel" },
        {
          text: "Trotzdem navigieren",
          style: "default",
          onPress: () => openNavigation(toilet, false), // Skip warning on retry
        },
      ],
    );
    return;
  }

  const url = Platform.select({
    ios: `maps://app?daddr=${toilet.lat},${toilet.lon}&dirflg=w`,
    android: `google.navigation:q=${toilet.lat},${toilet.lon}&mode=w`,
    default: `https://www.google.com/maps/dir/?api=1&destination=${toilet.lat},${toilet.lon}&travelmode=walking`,
  });
  if (url) Linking.openURL(url);
}

function AppContent() {
  const insets = useSafeAreaInsets();
  const {
    toilets,
    nearest,
    userLocation,
    searchLocation,
    exploreBounds,
    loading,
    updating,
    error,
    refresh,
    backToMyLocation,
    exploreAt,
  } = useToilets();
  const {
    favoriteIds,
    toggleFavorite: rawToggleFavorite,
    isFavorite,
  } = useFavorites();

  // Wrap toggleFavorite with haptics
  const toggleFavorite = useCallback(
    (id: string) => {
      const willBeFavorite = !favoriteIds.has(id);
      if (willBeFavorite) {
        successNotification();
      } else {
        mediumImpact();
      }
      rawToggleFavorite(id);
    },
    [favoriteIds, rawToggleFavorite],
  );
  const mapRef = useRef<ToiletMapHandle>(null);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("now");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [requireEurokey, setRequireEurokey] = useState(false);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [reportToilet, setReportToilet] = useState<Toilet | undefined>(
    undefined,
  );
  const [showReport, setShowReport] = useState(false);
  const [mapRegion, setMapRegion] = useState<{
    lat: number;
    lon: number;
    latD: number;
    lonD: number;
  } | null>(null);
  // Debounce timer for auto-loading toilets on map pan
  const exploreTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Onboarding state
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Check if first launch
  useEffect(() => {
    const checkFirstLaunch = async () => {
      try {
        const hasSeenOnboarding =
          await AsyncStorage.getItem("hasSeenOnboarding");
        if (hasSeenOnboarding !== "true") {
          setShowOnboarding(true);
        }
      } catch {
        // Ignore errors
      }
    };
    if (!isWeb) {
      checkFirstLaunch();
    }
  }, []);

  // Animate to user location once it becomes available
  useEffect(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          latitude: userLocation.lat,
          longitude: userLocation.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        1000,
      );
    }
  }, [userLocation]);

  const handleOnboardingComplete = useCallback(async () => {
    setShowOnboarding(false);
    try {
      await AsyncStorage.setItem("hasSeenOnboarding", "true");
    } catch {
      // Ignore errors
    }
  }, []);

  // --- Callbacks ---

  const focusToilet = useCallback((toilet: Toilet) => {
    if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
    exploreTimerRef.current = null;
    mediumImpact();
    setSelectedToilet(toilet);
    setListExpanded(false);
    if (mapRef.current) {
      mapRef.current?.animateToRegion(
        {
          latitude: toilet.lat,
          longitude: toilet.lon,
          latitudeDelta: 0.005,
          longitudeDelta: 0.005,
        },
        500,
      );
    }
  }, []);

  const focusUser = useCallback(() => {
    if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
    exploreTimerRef.current = null;
    mediumImpact();
    backToMyLocation();
    setSelectedToilet(null);
    if (userLocation) {
      mapRef.current?.animateToRegion(
        {
          latitude: userLocation.lat,
          longitude: userLocation.lon,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        },
        500,
      );
    }
  }, [userLocation, backToMyLocation]);

  const handleRegionChange = useCallback(
    (region: MapRegion, isGesture: boolean) => {
      setMapRegion({
        lat: region.latitude,
        lon: region.longitude,
        latD: region.latitudeDelta,
        lonD: region.longitudeDelta,
      });

      if (!isGesture) return;

      // User-initiated pan - clear selection and auto-load toilets after debounce
      setSelectedToilet(null);

      if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
      exploreTimerRef.current = setTimeout(() => {
        exploreAt(
          region.latitude,
          region.longitude,
          region.latitudeDelta,
          region.longitudeDelta,
        );
      }, 400);
    },
    [exploreAt],
  );

  // --- Derived data (MUST be before any early returns) ---

  // Pins should reflect active filters - only show toilets matching current criteria
  // BUT always include the selected toilet so it doesn't disappear
  const visibleToilets = useMemo(() => {
    let result = [...toilets];

    // Apply same filters as list: Mode → Favorites → Eurokey
    // STRICT: "Jetzt geöffnet" shows ONLY confirmed open toilets
    if (filterMode === "now") {
      result = result.filter((t) => t.hours && isOpenNow(t.hours));
    }

    // Sort by open status: confirmed open > unknown > closed (at bottom)
    result = result.sort((a, b) => {
      const statusA = a.hours ? isOpenNow(a.hours) : null;
      const statusB = b.hours ? isOpenNow(b.hours) : null;
      // true (open) > null (unknown) > false (closed)
      if (statusA === statusB) return 0;
      if (statusA === true) return -1;
      if (statusB === true) return 1;
      if (statusA === null) return -1;
      if (statusB === null) return 1;
      return 0;
    });

    if (showFavoritesOnly) {
      result = result.filter((t) => isFavorite(t.id));
    }
    if (requireEurokey) {
      result = result.filter((t) => t.tags?.includes("eurokey"));
    }
    if (wheelchairOnly) {
      result = result.filter(
        (t) => t.tags?.includes("eurokey") || t.tags?.includes("barrierefrei"),
      );
    }

    // Then filter by map bounds for performance
    if (mapRegion) {
      const pad = 0.1;
      result = result.filter(
        (t) =>
          t.lat > mapRegion.lat - mapRegion.latD / 2 - pad &&
          t.lat < mapRegion.lat + mapRegion.latD / 2 + pad &&
          t.lon > mapRegion.lon - mapRegion.lonD / 2 - pad &&
          t.lon < mapRegion.lon + mapRegion.lonD / 2 + pad,
      );
    }

    // Ensure selected toilet is always visible even if it doesn't match filters
    if (selectedToilet) {
      result = [selectedToilet, ...result.filter(t => t.id !== selectedToilet.id)];
    }

    return result.slice(0, 200);
  }, [
    toilets,
    mapRegion,
    filterMode,
    showFavoritesOnly,
    requireEurokey,
    wheelchairOnly,
    isFavorite,
    selectedToilet,
  ]);

  // filteredToilets is now the same as visibleToilets (no bounds limit)
  const filteredToilets = useMemo(() => {
    let result = [...toilets];

    // Apply same filters: Mode → Favorites → Eurokey
    // STRICT: "Jetzt geöffnet" shows ONLY confirmed open toilets
    if (filterMode === "now") {
      result = result.filter((t) => t.hours && isOpenNow(t.hours));
    }
    if (showFavoritesOnly) {
      result = result.filter((t) => isFavorite(t.id));
    }
    if (requireEurokey) {
      result = result.filter((t) => t.tags?.includes("eurokey"));
    }
    if (wheelchairOnly) {
      result = result.filter(
        (t) => t.tags?.includes("eurokey") || t.tags?.includes("barrierefrei"),
      );
    }

    // Sort by open status: confirmed open > unknown > closed (at bottom)
    result = result.sort((a, b) => {
      const statusA = isCurrentlyOpen(a.opening_hours);
      const statusB = isCurrentlyOpen(b.opening_hours);
      // true (open) > null (unknown) > false (closed)
      if (statusA === statusB) return 0;
      if (statusA === true) return -1;
      if (statusB === true) return 1;
      if (statusA === null) return -1;
      if (statusB === null) return 1;
      return 0;
    });

    return result;
  }, [
    toilets,
    filterMode,
    showFavoritesOnly,
    requireEurokey,
    wheelchairOnly,
    isFavorite,
  ]);

  // Show the best option based on current filters
  const displayNearest = useMemo(() => {
    if (filteredToilets.length > 0) {
      return filteredToilets[0];
    }
    // Fallback: if filtered list is empty, try to find ANY open toilet
    if (filterMode === "now") {
      return toilets.find((t) => t.hours && isOpenNow(t.hours));
    }
    return nearest;
  }, [filteredToilets, filterMode, toilets, nearest]);

  const mapPins = useMemo<MapPin[]>(() => visibleToilets.map(toilet => {
    const selected = toilet.id === selectedToilet?.id;
    const favorite = favoriteIds.has(toilet.id);
    const closed = toilet.hours ? isOpenNow(toilet.hours) === false : false;
    return {
      id: toilet.id, name: toilet.name, lat: toilet.lat, lon: toilet.lon,
      color: selected ? PIN_COLORS.selected : favorite ? PIN_COLORS.favorite : CATEGORY_COLORS[toilet.category],
      opacity: selected ? 1 : closed ? 0.5 : 0.9,
      selected,
    };
  }), [visibleToilets, selectedToilet, favoriteIds]);

  useEffect(() => () => {
    if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
  }, []);

  // --- Loading ---
  if (loading && !userLocation) {
    return (
      <>
        <StatusBar style="dark" />
        <EmptyState type="loading" />
      </>
    );
  }

  // --- Error ---
  // Only show full-screen error for initial load failures (no location, etc.)
  // Don't block the map when panning to an empty area
  if (error && toilets.length === 0 && !userLocation && !exploreBounds) {
    return (
      <>
        <StatusBar style="dark" />
        <EmptyState type="error" onAction={refresh} message={error} />
      </>
    );
  }

  // --- Bottom card: shows SELECTED toilet or NEAREST if none selected ---
  const toiletToShow = selectedToilet || displayNearest;

  const bottomCard = toiletToShow && (
    <ToiletDetailCard
      toilet={toiletToShow}
      isSelected={!!selectedToilet}
      onNavigate={() => openNavigationWithHaptics(toiletToShow)}
      onReport={() => {
        setReportToilet(toiletToShow);
        setShowReport(true);
      }}
    />
  );

  // --- Filter chips ---
  // "Jetzt geöffnet" shows ONLY confirmed open toilets (strict)
  const openNowCount = toilets.filter(
    (t) => t.hours && isOpenNow(t.hours),
  ).length;
  const filterBar = (
    <View style={styles.filterContainer}>
      {/* Primary toggle: Now / All */}
      <View style={styles.primaryToggle}>
        <TouchableOpacity
          style={[
            styles.toggleBtn,
            filterMode === "now" && styles.toggleBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setFilterMode("now");
          }}
        >
          <Text
            style={[
              styles.toggleText,
              filterMode === "now" && styles.toggleTextActive,
            ]}
          >
            Jetzt geöffnet
          </Text>
          <View
            style={[styles.badge, filterMode === "now" && styles.badgeActive]}
          >
            <Text
              style={[
                styles.badgeText,
                filterMode === "now" && styles.badgeTextActive,
              ]}
            >
              {openNowCount}
            </Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.toggleBtn,
            filterMode === "all" && styles.toggleBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setFilterMode("all");
          }}
        >
          <Text
            style={[
              styles.toggleText,
              filterMode === "all" && styles.toggleTextActive,
            ]}
          >
            Alle
          </Text>
          <View
            style={[styles.badge, filterMode === "all" && styles.badgeActive]}
          >
            <Text
              style={[
                styles.badgeText,
                filterMode === "all" && styles.badgeTextActive,
              ]}
            >
              {toilets.length}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Secondary toggles */}
      <View style={styles.secondaryToggles}>
        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityLabel="Nur Favoriten"
          accessibilityState={{ checked: showFavoritesOnly }}
          style={[
            styles.secondaryBtn,
            showFavoritesOnly && styles.secondaryBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setShowFavoritesOnly(!showFavoritesOnly);
          }}
        >
          <Text style={[styles.secondaryIcon, showFavoritesOnly && styles.secondaryTextActive]}>
            {showFavoritesOnly ? "★" : "☆"}
          </Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.secondaryText,
              showFavoritesOnly && styles.secondaryTextActive,
            ]}
          >
            Favoriten
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityLabel="Mit Eurokey"
          accessibilityState={{ checked: requireEurokey }}
          style={[
            styles.secondaryBtn,
            requireEurokey && styles.secondaryBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setRequireEurokey(!requireEurokey);
          }}
        >
          <Text style={styles.secondaryIcon}>🔑</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.secondaryText,
              requireEurokey && styles.secondaryTextActive,
            ]}
          >
            Eurokey
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          accessibilityRole="checkbox"
          accessibilityLabel="Rollstuhlgerecht"
          accessibilityState={{ checked: wheelchairOnly }}
          style={[
            styles.secondaryBtn,
            wheelchairOnly && styles.secondaryBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setWheelchairOnly(!wheelchairOnly);
          }}
        >
          <Text style={styles.secondaryIcon}>♿</Text>
          <Text
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.8}
            style={[
              styles.secondaryText,
              wheelchairOnly && styles.secondaryTextActive,
            ]}
          >
            Rollstuhl
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  // --- List Modal for Native ---
  const listModal = (
    <Modal
      visible={listExpanded}
      animationType="slide"
      onRequestClose={() => setListExpanded(false)}
    >
      <SafeAreaView style={styles.modalContainer}>
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>
            {showFavoritesOnly
              ? "Favoriten"
              : wheelchairOnly
                ? "Barrierefreie Toiletten"
                : filterMode === "now"
                  ? "Geöffnete Toiletten"
                  : "Alle Toiletten"}
          </Text>
          <View style={styles.modalHeaderActions}>
            <TouchableOpacity
              onPress={() => {
                setReportToilet(undefined);
                setShowReport(true);
              }}
              style={styles.modalReportBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.modalReportText}>+ Melden</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setListExpanded(false)}
              style={styles.modalCloseBtn}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>
        </View>

        {filterBar}

        <FlatList
          data={filteredToilets}
          keyExtractor={(item) => item.id}
          initialNumToRender={15}
          maxToRenderPerBatch={15}
          renderItem={({ item }) => (
            <ToiletListItem
              toilet={item}
              isNearest={item.id === nearest?.id}
              isFavorite={isFavorite(item.id)}
              isSelected={item.id === selectedToilet?.id}
              onNavigate={(t) => {
                setListExpanded(false);
                openNavigation(t);
              }}
              onSelect={(t) => {
                setListExpanded(false);
                focusToilet(t);
              }}
              onToggleFavorite={toggleFavorite}
              onReport={(t) => {
                setReportToilet(t);
                setShowReport(true);
              }}
            />
          )}
          contentContainerStyle={styles.modalListContent}
          ListEmptyComponent={
            <EmptyState
              type="no-results"
              onAction={() => {
                setFilterMode("all");
                setShowFavoritesOnly(false);
                setRequireEurokey(false);
                setWheelchairOnly(false);
              }}
            />
          }
        />
      </SafeAreaView>
    </Modal>
  );

  // --- NATIVE ---
  return (
    <View style={styles.flex}>
      <StatusBar style="dark" />

      {/* Onboarding Modal */}
      <OnboardingModal
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        onRequestLocation={focusUser}
      />

      {/* List Modal */}
      {listModal}

      {/* Map - Always Full Screen */}
      <View style={styles.mapFull}>
        <ToiletMap
          ref={mapRef}
          pins={mapPins}
          userLocation={userLocation}
          initialRegion={{
            latitude: userLocation?.lat ?? 52.3759,
            longitude: userLocation?.lon ?? 9.732,
            latitudeDelta: userLocation ? 0.04 : 0.1,
            longitudeDelta: userLocation ? 0.04 : 0.1,
          }}
          onSelect={id => {
            const toilet = visibleToilets.find(t => t.id === id);
            if (toilet) focusToilet(toilet);
          }}
          onNavigate={id => {
            const toilet = visibleToilets.find(t => t.id === id);
            if (toilet) openNavigationWithHaptics(toilet);
          }}
          onRegionChange={handleRegionChange}
        />

        {/* Location pill - shows current context */}
        <View style={styles.locationPill}>
          {updating ? (
            <View style={styles.updatingRow}>
              <ActivityIndicator size="small" color="#666" />
              <Text style={styles.updatingText}>Aktualisiere…</Text>
            </View>
          ) : (
            <Text style={styles.locationPillText}>
              {exploreBounds
                ? `🔍 ${visibleToilets.length} Toiletten`
                : searchLocation
                  ? "📍 Standort"
                  : "📍 Mein Standort"}
            </Text>
          )}
        </View>

        {/* My location button */}
        <TouchableOpacity
          style={[styles.locBtn, { bottom: 140 + insets.bottom }]}
          onPress={focusUser}
          activeOpacity={0.8}
        >
          <Text style={styles.locBtnIcon}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom panel - Always shows nearest + list button */}
      <View style={[styles.panel, { paddingBottom: insets.bottom }]}>
        {/* Nearest card */}
        {bottomCard}

        {/* Action buttons */}
        <View style={styles.bottomActions}>
          <TouchableOpacity
            style={styles.listButton}
            onPress={() => setListExpanded(true)}
            activeOpacity={0.8}
          >
            <Text style={styles.listButtonText}>
              {filteredToilets.length} Toiletten anzeigen
            </Text>
            <Text style={styles.listButtonIcon}>⌄</Text>
          </TouchableOpacity>

          {selectedToilet && (
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => setSelectedToilet(null)}
              activeOpacity={0.8}
            >
              <Text style={styles.clearBtnText}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Report sheet - triggered from list modal or bottom card */}
      <ReportSheet
        toilet={reportToilet}
        visible={showReport}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}

const S = {
  blue: "#1a73e8",
  green: "#34a853",
  bg: "#fff",
  textPrimary: "#1a1a1a",
  textSecondary: "#666",
  textMuted: "#999",
  border: "#e8e8e8",
  shadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  } as const,
};

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: S.bg },
  map: { flex: 1 },
  mapFull: { flex: 1 },

  // Loading / Error
  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: S.bg,
    paddingHorizontal: 32,
  },
  loadingTitle: {
    marginTop: 20,
    fontSize: 22,
    fontWeight: "700",
    color: S.textPrimary,
  },
  loadingSub: { marginTop: 6, fontSize: 14, color: S.textSecondary },
  errorText: {
    fontSize: 16,
    color: S.textPrimary,
    textAlign: "center",
    marginBottom: 20,
    lineHeight: 22,
  },
  primaryBtn: {
    backgroundColor: S.blue,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
  },
  primaryBtnText: { color: "#fff", fontSize: 16, fontWeight: "600" },

  // Web
  webHeader: {
    paddingTop: 48,
    paddingBottom: 16,
    paddingHorizontal: 20,
    backgroundColor: S.blue,
  },
  webTitle: { fontSize: 22, fontWeight: "700", color: "#fff" },

  // Location pill
  locationPill: {
    position: "absolute",
    top: 52,
    left: 16,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    ...S.shadow,
  },
  locationPillText: { fontSize: 15, color: S.textPrimary, fontWeight: "500" },
  updatingRow: { flexDirection: "row" as const, alignItems: "center" as const, gap: 8 },
  updatingText: { fontSize: 13, color: "#888" },

  // Location button - positioned above bottom panel
  locBtn: {
    position: "absolute",
    bottom: 140, // Above bottom panel (~120px height + margin)
    right: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...S.shadow,
  },
  locBtnIcon: { fontSize: 20, color: S.blue },

  // Bottom panel
  panel: {
    backgroundColor: S.bg,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 8,
  },

  // Nearest card
  nearestCard: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 4,
    padding: 14,
    backgroundColor: "#f4fbf5",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d4edda",
  },
  nearestInfo: { flex: 1, marginRight: 10 },
  nearestLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  nearestLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: S.green,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  contextBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  contextBadgeOpen: { backgroundColor: "#34a853" },
  contextBadgeFav: { backgroundColor: "#f5a623" },
  contextBadgeEurokey: { backgroundColor: "#1a73e8" },
  contextBadgeWheelchair: { backgroundColor: "#34a853" },
  contextBadgeText: {
    fontSize: 9,
    fontWeight: "700",
    color: "#fff",
  },
  nearestName: {
    fontSize: 14,
    fontWeight: "600",
    color: S.textPrimary,
    marginTop: 2,
  },
  nearestRight: { alignItems: "center", gap: 4 },
  nearestDist: { fontSize: 13, fontWeight: "700", color: S.textSecondary },
  nearestHoursRow: { marginTop: 4 },
  nearestCardActive: { backgroundColor: "#e8f4fd", borderColor: S.blue },
  nearestNavBtn: {
    backgroundColor: S.green,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  nearestNavText: { color: "#fff", fontSize: 13, fontWeight: "700" },
  cardReportBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  cardReportText: {
    fontSize: 11,
    color: "#1a73e8",
    fontWeight: "500",
  },

  // List button (replaces toggle)
  listButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    gap: 8,
  },
  listButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: S.textPrimary,
  },
  listButtonIcon: {
    fontSize: 18,
    color: S.textMuted,
    marginTop: -4,
  },
  bottomActions: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 12,
  },
  clearBtn: {
    width: 46,
    height: 46,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
  },
  clearBtnText: {
    fontSize: 16,
    color: S.textSecondary,
    fontWeight: "600",
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: S.bg,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: S.textPrimary,
  },
  modalHeaderActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modalReportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#f0f0f0",
    borderRadius: 16,
  },
  modalReportText: {
    fontSize: 13,
    fontWeight: "600",
    color: S.blue,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
  },
  modalCloseText: {
    fontSize: 18,
    color: S.textSecondary,
    fontWeight: "600",
  },
  modalFilterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: S.border,
    backgroundColor: "#fafafa",
  },
  modalChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#e8e8e8",
  },
  modalListContent: {
    paddingBottom: 40,
  },

  // Filter chips
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 6,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: "#f0f0f0",
  },
  chipActive: { backgroundColor: S.blue },
  chipOpenNow: { backgroundColor: "#34a853" },
  chipFav: { backgroundColor: "#f5a623" },
  chipText: { fontSize: 13, fontWeight: "600", color: S.textSecondary },
  chipTextActive: { color: "#fff" },

  // New Filter Styles
  filterContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  primaryToggle: {
    flexDirection: "row",
    backgroundColor: "#f0f0f0",
    borderRadius: 12,
    padding: 4,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    gap: 8,
  },
  toggleBtnActive: {
    backgroundColor: "#fff",
    ...{
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
  },
  toggleText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#666",
  },
  toggleTextActive: {
    color: "#1a1a1a",
  },
  badge: {
    backgroundColor: "#ddd",
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: "center",
  },
  badgeActive: {
    backgroundColor: "#34a853",
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#666",
  },
  badgeTextActive: {
    color: "#fff",
  },
  secondaryToggles: {
    flexDirection: "row",
    gap: 8,
  },
  secondaryBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 10,
    paddingHorizontal: 6,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  secondaryBtnActive: {
    backgroundColor: "#e8f0fe",
    borderColor: "#1a73e8",
  },
  secondaryIcon: {
    width: 20,
    textAlign: "center",
    fontSize: 16,
    lineHeight: 20,
    color: "#666",
  },
  secondaryText: {
    flexShrink: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "600",
    color: "#666",
  },
  secondaryTextActive: {
    color: "#185abc",
  },

  // List
  listContent: { paddingBottom: 40 },
  emptyState: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 24,
  },
  emptyText: { fontSize: 15, color: S.textMuted, textAlign: "center" },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
