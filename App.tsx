import React, {
  useRef,
  useCallback,
  useState,
  useMemo,
  useEffect,
} from "react";

// Filter type must be defined outside component
type FilterMode = "now" | "all";
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
  Modal,
  Alert,
} from "react-native";
import { SafeAreaView, SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useToilets } from "./src/hooks/useToilets";
import { useFavorites } from "./src/hooks/useFavorites";
import { ToiletListItem } from "./src/components/ToiletListItem";
import { isCurrentlyOpen } from "./src/utils/opening-hours";
import { OpeningHoursDisplay } from "./src/components/OpeningHoursDisplay";
import { isOpenNow } from "./src/types/opening-hours";
import { ToiletDetailCard } from "./src/components/ToiletDetailCard";
import { ToiletCallout } from "./src/components/ToiletCallout";
import { Toilet, CATEGORY_COLORS, PIN_COLORS } from "./src/types/toilet";
import { formatDistance } from "./src/services/overpass";
import { ReportSheet } from "./src/components/ReportSheet";
import { OnboardingModal } from "./src/components/OnboardingModal";
import { EmptyState } from "./src/components/EmptyState";
import { mediumImpact, successNotification } from "./src/utils/haptics";

const isWeb = Platform.OS === "web";
import AsyncStorage from "@react-native-async-storage/async-storage";

let MapView: any = null;
let Marker: any = null;
let Callout: any = null;
let PROVIDER_GOOGLE: any = null;

if (!isWeb) {
  const maps = require("react-native-maps");
  MapView = maps.default;
  Marker = maps.Marker;
  Callout = maps.Callout;
  PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
}

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
  const {
    toilets,
    nearest,
    userLocation,
    searchLocation,
    exploreBounds,
    loading,
    error,
    refresh,
    searchAt,
    backToMyLocation,
    exploreAt,
    clearExplore,
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
  const mapRef = useRef<any>(null);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [listExpanded, setListExpanded] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>("now");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [requireEurokey, setRequireEurokey] = useState(false);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [mapMoved, setMapMoved] = useState(false);
  const [mapCenter, setMapCenter] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
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
  // Track programmatic animation target to distinguish from user pans
  const animatingToRef = useRef<{ lat: number; lon: number } | null>(null);

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
    if (userLocation && !isWeb && mapRef.current) {
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
    mediumImpact();
    setSelectedToilet(toilet);
    setListExpanded(false);
    if (!isWeb) {
      // Set target so we know this is a programmatic animation
      animatingToRef.current = { lat: toilet.lat, lon: toilet.lon };
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
    mediumImpact();
    backToMyLocation();
    setSelectedToilet(null);
    setMapMoved(false);
    if (userLocation && !isWeb) {
      animatingToRef.current = { lat: userLocation.lat, lon: userLocation.lon };
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

  const handleSearchHere = useCallback(() => {
    mediumImpact();
    if (mapRegion) {
      // exploreAt loads toilets in the visible bounds but keeps distance from userLocation
      exploreAt(mapRegion.lat, mapRegion.lon, mapRegion.latD, mapRegion.lonD);
      setMapMoved(false);
    }
  }, [mapRegion, exploreAt]);

  const handleRegionChange = useCallback((region: any) => {
    setMapCenter({ lat: region.latitude, lon: region.longitude });
    setMapRegion({
      lat: region.latitude,
      lon: region.longitude,
      latD: region.latitudeDelta,
      lonD: region.longitudeDelta,
    });

    // Check if this region change matches our animation target
    const target = animatingToRef.current;
    if (target) {
      const latDiff = Math.abs(region.latitude - target.lat);
      const lonDiff = Math.abs(region.longitude - target.lon);
      // If we're close to the target (within ~100m), this is our animation completing
      if (latDiff < 0.001 && lonDiff < 0.001) {
        animatingToRef.current = null; // Reset target
        return; // Don't clear selection - this was our programmatic animation
      }
      // If region doesn't match target, user panned during animation - clear target
      animatingToRef.current = null;
    }

    // User-initiated pan - clear selection
    setMapMoved(true);
    setSelectedToilet(null);
  }, []);

  // --- Derived data (MUST be before any early returns) ---

  // Pins should reflect active filters - only show toilets matching current criteria
  // BUT always include the selected toilet so it doesn't disappear
  const visibleToilets = useMemo(() => {
    let result = toilets;

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
      const alreadyIncluded = result.some((t) => t.id === selectedToilet.id);
      if (!alreadyIncluded) {
        result = [selectedToilet, ...result];
      }
    }

    return result.slice(0, 50);
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
    let result = toilets;

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

  // Helper to check if toilet is currently open
  const getOpenStatus = (t: Toilet): boolean => {
    if (!t.hours || t.hours.type === "unknown") return true; // Treat unknown as open
    return isOpenNow(t.hours);
  };

  // Prefer open toilets for "nearest" suggestions
  const reliableToilets = toilets.filter(
    (t) => t.category === "public_24h" || t.category === "station",
  );

  // First try to find an open reliable toilet, then any reliable, then any open, then just nearest
  const reliableNearest =
    reliableToilets.find(getOpenStatus) ||
    reliableToilets[0] ||
    toilets.find(getOpenStatus) ||
    nearest;

  const reliableCount = reliableToilets.length;

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
  if (error && toilets.length === 0) {
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
  // "Alle" shows all except definitely closed
  const allAvailableCount = toilets.filter(
    (t) =>
      !t.hours || t.hours.type === "unknown" || isOpenNow(t.hours) !== false,
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
          style={[
            styles.secondaryBtn,
            showFavoritesOnly && styles.secondaryBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setShowFavoritesOnly(!showFavoritesOnly);
          }}
        >
          <Text
            style={[
              styles.secondaryText,
              showFavoritesOnly && styles.secondaryTextActive,
            ]}
          >
            {showFavoritesOnly ? "★ Nur Favoriten" : "☆ Favoriten"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            requireEurokey && styles.secondaryBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setRequireEurokey(!requireEurokey);
          }}
        >
          <Text
            style={[
              styles.secondaryText,
              requireEurokey && styles.secondaryTextActive,
            ]}
          >
            {requireEurokey ? "🔑 Mit Eurokey" : "🔑 Eurokey"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.secondaryBtn,
            wheelchairOnly && styles.secondaryBtnActive,
          ]}
          onPress={() => {
            mediumImpact();
            setWheelchairOnly(!wheelchairOnly);
          }}
        >
          <Text
            style={[
              styles.secondaryText,
              wheelchairOnly && styles.secondaryTextActive,
            ]}
          >
            {wheelchairOnly ? "♿ Barrierefrei" : "♿ Rollstuhl"}
          </Text>
        </TouchableOpacity>
      </View>
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
            isSelected={item.id === selectedToilet?.id}
            onNavigate={openNavigationWithHaptics}
            onSelect={focusToilet}
            onToggleFavorite={toggleFavorite}
            onReport={(t) => {
              setReportToilet(t);
              setShowReport(true);
            }}
          />
        )}
        contentContainerStyle={styles.listContent}
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
        {bottomCard}
        {renderList()}
      </SafeAreaView>
    );
  }

  // --- List Modal for Native ---
  const ListModal = () => (
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

        {/* Filter in modal */}
        <View style={styles.filterContainer}>
          <View style={styles.primaryToggle}>
            <TouchableOpacity
              style={[
                styles.toggleBtn,
                filterMode === "now" && styles.toggleBtnActive,
              ]}
              onPress={() => setFilterMode("now")}
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
                style={[
                  styles.badge,
                  filterMode === "now" && styles.badgeActive,
                ]}
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
              onPress={() => setFilterMode("all")}
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
                style={[
                  styles.badge,
                  filterMode === "all" && styles.badgeActive,
                ]}
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

          <View style={styles.secondaryToggles}>
            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                showFavoritesOnly && styles.secondaryBtnActive,
              ]}
              onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
            >
              <Text
                style={[
                  styles.secondaryText,
                  showFavoritesOnly && styles.secondaryTextActive,
                ]}
              >
                {showFavoritesOnly ? "★ Favoriten" : "☆ Favoriten"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.secondaryBtn,
                requireEurokey && styles.secondaryBtnActive,
              ]}
              onPress={() => setRequireEurokey(!requireEurokey)}
            >
              <Text
                style={[
                  styles.secondaryText,
                  requireEurokey && styles.secondaryTextActive,
                ]}
              >
                {requireEurokey ? "🔑 Eurokey" : "🔑 Eurokey"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

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
      <ListModal />

      {/* Map - Always Full Screen */}
      <View style={styles.mapFull}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
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
          onRegionChangeComplete={handleRegionChange}
        >
          {visibleToilets.map((toilet) => {
            const isSelected = toilet.id === selectedToilet?.id;
            const isFavorite = toilet.id ? favoriteIds.has(toilet.id) : false;
            const openStatus = toilet.hours ? isOpenNow(toilet.hours) : null;
            const isClosed = openStatus === false;

            // Pin color priority: selected > favorite > category-based
            let pinColor = CATEGORY_COLORS[toilet.category];
            if (isSelected) {
              pinColor = PIN_COLORS.selected;
            } else if (isFavorite) {
              pinColor = PIN_COLORS.favorite;
            }

            // Closed toilets fade into background
            const opacity = isSelected ? 1 : isClosed ? 0.5 : 0.9;

            // Selected pin on top
            const zIndex = isSelected ? 1000 : isFavorite ? 100 : 1;

            return (
              <Marker
                key={toilet.id}
                coordinate={{ latitude: toilet.lat, longitude: toilet.lon }}
                onPress={() => focusToilet(toilet)}
                pinColor={pinColor}
                opacity={opacity}
                zIndex={zIndex}
                tracksViewChanges={false}
              >
                <Callout
                  tooltip
                  onPress={() => openNavigationWithHaptics(toilet)}
                >
                  <ToiletCallout
                    toilet={toilet}
                    onNavigate={() => openNavigationWithHaptics(toilet)}
                  />
                </Callout>
              </Marker>
            );
          })}
        </MapView>

        {/* Location pill - shows current context only */}
        <View style={styles.locationPill}>
          <Text style={styles.locationPillText}>
            {exploreBounds
              ? "🔍 Bereich erkunden"
              : searchLocation
                ? "📍 Standort"
                : "📍 Mein Standort"}
          </Text>
        </View>

        {/* "Hier suchen" pill - appears when map moves */}
        {mapMoved && (
          <TouchableOpacity
            style={styles.searchHerePill}
            onPress={handleSearchHere}
            activeOpacity={0.9}
          >
            <Text style={styles.searchHereText}>Hier suchen</Text>
          </TouchableOpacity>
        )}

        {/* My location button */}
        <TouchableOpacity
          style={styles.locBtn}
          onPress={focusUser}
          activeOpacity={0.8}
        >
          <Text style={styles.locBtnIcon}>◎</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom panel - Always shows nearest + list button */}
      <View style={styles.panel}>
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

  // Search here
  searchHerePill: {
    position: "absolute",
    top: 102,
    alignSelf: "center",
    backgroundColor: S.blue,
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 10,
    ...S.shadow,
  },
  searchHereText: { fontSize: 13, color: "#fff", fontWeight: "700" },

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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    borderWidth: 1,
    borderColor: "#e0e0e0",
  },
  secondaryBtnActive: {
    backgroundColor: "#e8f4fd",
    borderColor: "#1a73e8",
  },
  secondaryText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#666",
  },
  secondaryTextActive: {
    color: "#1a73e8",
    fontWeight: "600",
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

// --- Loading Screen Component ---
function LoadingScreen({ onSkip }: { onSkip: () => void }) {
  const [dots, setDots] = useState("");
  const [showSkip, setShowSkip] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setDots((d) => (d.length >= 3 ? "" : d + "."));
    }, 500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setShowSkip(true), 5000);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <SafeAreaView style={loadingStyles.container}>
      <StatusBar style="dark" />

      {/* Icon */}
      <View style={loadingStyles.iconContainer}>
        <Text style={loadingStyles.icon}>🚻</Text>
      </View>

      {/* Title */}
      <Text style={loadingStyles.title}>WC Finder</Text>
      <Text style={loadingStyles.subtitle}>
        Toiletten in deiner Nähe finden
      </Text>

      {/* Loading indicator */}
      <View style={loadingStyles.loadingBox}>
        <ActivityIndicator size="small" color="#1a73e8" />
        <Text style={loadingStyles.loadingText}>
          Standort wird ermittelt{dots}
        </Text>
      </View>

      {/* Info text */}
      <Text style={loadingStyles.infoText}>
        Dein Standort hilft uns, die nächste erreichbare Toilette zu finden.
      </Text>

      {/* Skip button (appears after 5s) */}
      {showSkip && (
        <TouchableOpacity
          style={loadingStyles.skipButton}
          onPress={onSkip}
          activeOpacity={0.8}
        >
          <Text style={loadingStyles.skipText}>
            🗺️ Karte stattdessen anzeigen
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const loadingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: "#e8f4fd",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#1a1a1a",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 40,
  },
  loadingBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 10,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 15,
    color: "#1a73e8",
    fontWeight: "600",
    minWidth: 200,
  },
  infoText: {
    fontSize: 13,
    color: "#888",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  skipButton: {
    marginTop: 32,
    paddingVertical: 12,
    paddingHorizontal: 20,
  },
  skipText: {
    fontSize: 14,
    color: "#1a73e8",
    fontWeight: "600",
  },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
