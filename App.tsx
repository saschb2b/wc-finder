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
  ScrollView,
  Linking,
  Alert,
  AppState,
  useWindowDimensions,
} from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { useToilets } from "./src/hooks/useToilets";
import { useFavorites } from "./src/hooks/useFavorites";
import { ToiletListItem } from "./src/components/ToiletListItem";
import { toiletOpenStatus, isWithinAvailability, availabilityLabel } from "./src/utils/toilet-availability";
import { filterToilets } from "./src/utils/filter-toilets";
import { ToiletDetailCard } from "./src/components/ToiletDetailCard";
import { ToiletPeekCard } from "./src/components/ToiletPeekCard";
import { BottomSheet, type BottomSheetHandle } from "./src/components/BottomSheet";
import { ToiletMap } from "./src/components/ToiletMap";
import type { MapPin, MapRegion, ToiletMapHandle } from "./src/map/types";
import { Toilet, CATEGORY_COLORS, PIN_COLORS } from "./src/types/toilet";
import { ReportSheet } from "./src/components/ReportSheet";
import { OnboardingModal } from "./src/components/OnboardingModal";
import { EmptyState } from "./src/components/EmptyState";
import { BrandIcon } from "./src/components/BrandIcon";
import { mediumImpact, successNotification } from "./src/utils/haptics";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { t, getLocale, setLocale } from "./src/i18n";
import { detectLocale } from "./src/i18n/detect";
import { useLocale } from "./src/i18n/useLocale";
import { useTheme, useColorSchemeName, useThemedStyles, shadow, type Colors } from "./src/theme";
import * as SystemUI from "expo-system-ui";

type FilterMode = "now" | "all";

const isWeb = Platform.OS === "web";
/** Height of the location button and filter row that float above the sheet surface. */
const OVERLAY_HEIGHT = 108;
/** Sheet header height before it is measured. */
const DEFAULT_PEEK = 150;

function openNavigationWithHaptics(
  toilet: Toilet,
  showClosedWarning: boolean = true,
) {
  successNotification();
  openNavigation(toilet, showClosedWarning);
}

function openNavigation(toilet: Toilet, showClosedWarning: boolean = true) {
  // Check if toilet is closed
  const openStatus = toiletOpenStatus(toilet);

  if (openStatus === false && showClosedWarning) {
    // Show warning before navigating
    const hoursText = availabilityLabel(toilet) || toilet.care?.hoursNote || toilet.hours?.original || t("unknown");
    if (isWeb) {
      if (window.confirm(t("nav.closedMessage", { name: toilet.name, hours: hoursText }))) {
        openNavigation(toilet, false);
      }
      return;
    }
    Alert.alert(
      t("nav.closedTitle"),
      t("nav.closedMessageNative", { name: toilet.name, hours: hoursText }),
      [
        { text: t("action.cancel"), style: "cancel" },
        {
          text: t("nav.anyway"),
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
  const { width, height } = useWindowDimensions();
  const colors = useTheme();
  const colorScheme = useColorSchemeName();
  const styles = useThemedStyles(makeStyles);
  // Keep the native root view (visible behind modals and during rotation) in the current scheme.
  useEffect(() => {
    if (!isWeb) void SystemUI.setBackgroundColorAsync(colors.background);
  }, [colors.background]);
  const desktopWeb = isWeb && width >= 900;
  // Remount the tree on a locale change so memoized children and the map document pick it up.
  const locale = useLocale();
  const {
    toilets,
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
  const sheetRef = useRef<BottomSheetHandle>(null);
  const [selectedToilet, setSelectedToilet] = useState<Toilet | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>("now");
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [requireEurokey, setRequireEurokey] = useState(false);
  const [wheelchairOnly, setWheelchairOnly] = useState(false);
  const [requireBed, setRequireBed] = useState(false);
  const [requireHoist, setRequireHoist] = useState(false);
  const [peekHeight, setPeekHeight] = useState(DEFAULT_PEEK);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const update = () => setNow(new Date());
    const timer = setInterval(update, 60000);
    const subscription = AppState.addEventListener("change", state => {
      if (state !== "active") return;
      update();
      // Android keeps the app alive across a system language change; iOS restarts it.
      const locale = detectLocale();
      if (locale !== getLocale()) setLocale(locale);
    });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
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

  // Frame the reference point plus the nearest results once per location, so the
  // first view shows distinguishable pins instead of a fixed city-wide zoom.
  const fittedFor = useRef<string | null>(null);
  const reference = userLocation ?? searchLocation;
  useEffect(() => {
    if (!reference || toilets.length === 0 || exploreBounds) return;
    const key = `${reference.lat.toFixed(4)},${reference.lon.toFixed(4)}`;
    if (fittedFor.current === key) return;
    fittedFor.current = key;
    const nearest = toilets.slice(0, 8).map(t => ({ lat: t.lat, lon: t.lon }));
    mapRef.current?.fitToPoints([reference, ...nearest], {
      top: insets.top + 90, left: 32, right: 32,
      bottom: desktopWeb ? 40 : OVERLAY_HEIGHT + peekHeight + insets.bottom + 16,
    }, 17, 800);
  }, [reference, toilets, exploreBounds, insets.top, insets.bottom, desktopWeb, peekHeight]);

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
    // Selecting collapses the sheet so the pin is visible on the map.
    sheetRef.current?.snapTo(0);
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

  const openReportFor = useCallback((toilet?: Toilet) => {
    setReportToilet(toilet);
    setShowReport(true);
  }, []);

  const resetFilters = useCallback(() => {
    setFilterMode("all");
    setShowFavoritesOnly(false);
    setRequireEurokey(false);
    setWheelchairOnly(false);
    setRequireBed(false);
    setRequireHoist(false);
    setSelectedToilet(null);
  }, []);

  // --- Derived data (MUST be before any early returns) ---

  const filteredToilets = useMemo(() => filterToilets(toilets, {
    openNow: filterMode === "now", favoritesOnly: showFavoritesOnly, favoriteIds,
    eurokey: requireEurokey, wheelchair: wheelchairOnly, bed: requireBed, hoist: requireHoist,
  }, now), [toilets, filterMode, showFavoritesOnly, favoriteIds, requireEurokey, wheelchairOnly, requireBed, requireHoist, now]);

  // Preserve an explicit selection, including its availability warning.
  const visibleToilets = useMemo(() => {
    let result = filteredToilets;
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
  }, [filteredToilets, mapRegion, selectedToilet]);

  // An empty filter result must never recommend an incompatible toilet.
  const displayNearest = filteredToilets[0];

  const mapPins = useMemo<MapPin[]>(() => visibleToilets.map(toilet => {
    const selected = toilet.id === selectedToilet?.id;
    const favorite = favoriteIds.has(toilet.id);
    const closed = toiletOpenStatus(toilet, now) === false;
    return {
      id: toilet.id, name: toilet.name, lat: toilet.lat, lon: toilet.lon,
      color: selected ? PIN_COLORS.selected : favorite ? PIN_COLORS.favorite : CATEGORY_COLORS[toilet.category],
      opacity: selected ? 1 : closed ? 0.5 : 0.9,
      selected,
      featured: toilet.id === displayNearest?.id,
    };
  }), [visibleToilets, selectedToilet, displayNearest?.id, favoriteIds, now]);

  const openNowCount = useMemo(
    () => toilets.filter((t) => toiletOpenStatus(t, now) === true).length,
    [toilets, now],
  );
  const allCount = useMemo(
    () => toilets.filter(t => isWithinAvailability(t, now)).length,
    [toilets, now],
  );

  useEffect(() => () => {
    if (exploreTimerRef.current) clearTimeout(exploreTimerRef.current);
  }, []);

  // --- Loading ---
  if (loading && !userLocation) {
    return (
      <>
        <StatusBar style="auto" />
        <EmptyState type="loading" />
      </>
    );
  }

  // --- Error ---
  // Only show full-screen error for initial load failures (no location, etc.)
  // Don't block the map when panning to an empty area
  if (error && toilets.length === 0 && !userLocation) {
    return (
      <>
        <StatusBar style="auto" />
        <EmptyState type="error" onAction={refresh} message={error} />
      </>
    );
  }

  const toiletToShow = selectedToilet || displayNearest;

  // --- Filter chips: always visible, one row, horizontally scrollable ---
  const modeChip = (mode: FilterMode, label: string, count: number) => {
    const active = filterMode === mode;
    return (
      <TouchableOpacity
        key={mode}
        accessibilityRole="radio"
        accessibilityState={{ selected: active }}
        style={[styles.chip, active && styles.chipActive]}
        onPress={() => { mediumImpact(); setFilterMode(mode); setSelectedToilet(null); }}
      >
        <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
        <Text style={[styles.chipCount, active && styles.chipTextActive]}>{count}</Text>
      </TouchableOpacity>
    );
  };
  const toggleChip = (
    key: string, label: string, a11yLabel: string, checked: boolean, setChecked: (v: boolean) => void, icon?: string,
  ) => (
    <TouchableOpacity
      key={key}
      accessibilityRole="checkbox"
      accessibilityLabel={a11yLabel}
      accessibilityState={{ checked }}
      aria-checked={checked}
      style={[styles.chip, checked && styles.chipActive]}
      onPress={() => { mediumImpact(); setChecked(!checked); setSelectedToilet(null); }}
    >
      {icon ? <Text style={[styles.chipIcon, checked && styles.chipTextActive]}>{icon}</Text> : null}
      <Text style={[styles.chipText, checked && styles.chipTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
  const filterChips = [
    modeChip("now", t("filter.openNow"), openNowCount),
    modeChip("all", t("filter.all"), allCount),
    toggleChip("fav", t("filter.favorites"), t("filter.favoritesOnly"), showFavoritesOnly, setShowFavoritesOnly, showFavoritesOnly ? "★" : "☆"),
    toggleChip("eurokey", t("toilet.eurokey"), t("filter.withEurokey"), requireEurokey, setRequireEurokey, "🔑"),
    toggleChip("wheelchair", t("filter.wheelchair"), t("filter.wheelchairA11y"), wheelchairOnly, setWheelchairOnly, "♿"),
    toggleChip("bed", t("care.bed"), t("filter.withEquipment", { label: t("care.bed") }), requireBed, setRequireBed),
    toggleChip("hoist", t("care.hoist"), t("filter.withEquipment", { label: t("care.hoist") }), requireHoist, setRequireHoist),
  ];

  const locationButton = (
    <TouchableOpacity
      style={styles.locBtn}
      accessibilityRole="button"
      accessibilityLabel={t("map.useMyLocation")}
      onPress={focusUser}
      activeOpacity={0.8}
    >
      <Text style={styles.locBtnIcon}>◎</Text>
    </TouchableOpacity>
  );

  const errorBanner = error && (
    <TouchableOpacity accessibilityRole="button" onPress={refresh} style={styles.errorBanner}>
      <Text accessibilityRole="alert" style={styles.errorText}>{error} {t("action.retry")}</Text>
    </TouchableOpacity>
  );

  // --- List (shared by the sheet body and the desktop side panel) ---
  const list = (
    <FlatList
      data={filteredToilets}
      keyExtractor={(item) => item.id}
      initialNumToRender={12}
      maxToRenderPerBatch={12}
      keyboardShouldPersistTaps="handled"
      ListHeaderComponent={
        // Details only for an explicit selection; the peek card already summarises the nearest one.
        selectedToilet ? (
          <ToiletDetailCard
            toilet={selectedToilet}
            isSelected
            onNavigate={() => openNavigationWithHaptics(selectedToilet)}
            onReport={() => openReportFor(selectedToilet)}
          />
        ) : null
      }
      renderItem={({ item }) => (
        <ToiletListItem
          toilet={item}
          isNearest={item.id === displayNearest?.id}
          isFavorite={isFavorite(item.id)}
          isSelected={item.id === selectedToilet?.id}
          onNavigate={(t) => openNavigation(t)}
          onSelect={focusToilet}
          onToggleFavorite={toggleFavorite}
          onReport={openReportFor}
        />
      )}
      ListEmptyComponent={<EmptyState type="no-results" onAction={resetFilters} />}
      ListFooterComponent={
        <TouchableOpacity style={styles.reportMissing} onPress={() => openReportFor(undefined)} accessibilityRole="button">
          <Text style={styles.reportMissingText}>📍 {t("list.reportMissing")}</Text>
        </TouchableOpacity>
      }
      contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
    />
  );

  const statusPill = (
    <View style={[styles.statusPill, { top: insets.top + 8 }]} pointerEvents="none">
      <BrandIcon size={32} />
      <View style={styles.statusCopy}>
        <Text style={styles.brandName}>{t("app.name")}</Text>
        {updating ? (
          <View style={styles.updatingRow}>
            <ActivityIndicator size="small" color={colors.textSecondary} />
            <Text style={styles.statusText}>{t("map.updating")}</Text>
          </View>
        ) : (
          <Text style={styles.statusText}>
            {exploreBounds
              ? t("list.toiletsCount", { n: visibleToilets.length })
              : searchLocation
                ? t("map.mapLocation")
                : t("map.myLocation")}
          </Text>
        )}
      </View>
    </View>
  );

  const map = (
    <ToiletMap
      ref={mapRef}
      pins={mapPins}
      userLocation={userLocation}
      colorScheme={colorScheme}
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
      onDeselect={() => setSelectedToilet(null)}
      onNavigate={id => {
        const toilet = visibleToilets.find(t => t.id === id);
        if (toilet) openNavigationWithHaptics(toilet);
      }}
      onRegionChange={handleRegionChange}
    />
  );

  // --- Desktop web: map with a fixed side panel, no sheet gesture ---
  if (desktopWeb) {
    return (
      <View style={styles.flex} key={locale}>
        <StatusBar style="auto" />
        <View style={styles.desktopRow}>
          <View style={styles.flex}>
            {map}
            {statusPill}
            <View style={styles.desktopLocBtn}>{locationButton}</View>
          </View>
          <View style={styles.sidePanel}>
            <View style={styles.sideFilters}>{filterChips}</View>
            {errorBanner}
            {list}
          </View>
        </View>
        <ReportSheet toilet={reportToilet} visible={showReport} onClose={() => setShowReport(false)} />
      </View>
    );
  }

  // --- Phone: full-screen map with a persistent draggable sheet ---
  const fullHeight = height - insets.top - 8;
  const snapPoints = [
    Math.min(OVERLAY_HEIGHT + peekHeight + insets.bottom, fullHeight),
    Math.min(Math.round(height * 0.55), fullHeight),
    fullHeight,
  ];

  return (
    <View style={styles.flex} key={locale}>
      <StatusBar style="auto" />

      {/* Onboarding Modal */}
      <OnboardingModal
        visible={showOnboarding}
        onComplete={handleOnboardingComplete}
        onRequestLocation={focusUser}
      />

      {/* Map - always full screen; the sheet floats above it */}
      <View style={styles.mapFull}>
        {map}
        {statusPill}
      </View>

      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        overlay={
          <View style={styles.overlay} pointerEvents="box-none">
            <View style={styles.overlayLocRow} pointerEvents="box-none">{locationButton}</View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterRow}
              keyboardShouldPersistTaps="handled"
            >
              {filterChips}
            </ScrollView>
          </View>
        }
        header={
          <View onLayout={e => setPeekHeight(Math.ceil(e.nativeEvent.layout.height) + 25)}>
            {errorBanner}
            {toiletToShow ? (
              <ToiletPeekCard
                toilet={toiletToShow}
                isSelected={!!selectedToilet}
                onNavigate={() => openNavigationWithHaptics(toiletToShow)}
                onList={() => { mediumImpact(); sheetRef.current?.snapTo(1); }}
              />
            ) : (
              <TouchableOpacity style={styles.peekEmpty} onPress={resetFilters} accessibilityRole="button">
                <Text style={styles.peekEmptyTitle}>{t("empty.noResults.title")}</Text>
                <Text style={styles.peekEmptyAction}>{t("empty.noResults.action")}</Text>
              </TouchableOpacity>
            )}
          </View>
        }
      >
        {list}
      </BottomSheet>

      {/* Report sheet - triggered from the list or the detail card */}
      <ReportSheet
        toilet={reportToilet}
        visible={showReport}
        onClose={() => setShowReport(false)}
      />
    </View>
  );
}

const makeStyles = (c: Colors) => StyleSheet.create({
  flex: { flex: 1, backgroundColor: c.surface },
  mapFull: { flex: 1 },

  // Status pill: small, top-left, never in the way of pins
  statusPill: {
    position: "absolute",
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: c.surface,
    ...shadow(c),
  },
  statusCopy: { gap: 2 },
  brandName: { fontSize: 14, color: c.text, fontWeight: "700" },
  statusText: { fontSize: 12, color: c.textSecondary, fontWeight: "500" },
  updatingRow: { flexDirection: "row", alignItems: "center", gap: 8 },

  // Location button
  locBtn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: c.surface,
    alignItems: "center",
    justifyContent: "center",
    ...shadow(c),
  },
  locBtnIcon: { fontSize: 20, color: c.primary },
  desktopLocBtn: { position: "absolute", top: 90, right: 24 },

  // Overlay above the sheet surface (moves with the sheet)
  overlay: { height: OVERLAY_HEIGHT, justifyContent: "flex-end" },
  overlayLocRow: { alignItems: "flex-end", paddingRight: 16, paddingBottom: 8 },
  filterRow: { paddingHorizontal: 12, gap: 8, paddingBottom: 8 },
  sideFilters: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: c.border },

  // Filter chips
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: c.surface,
    ...shadow(c),
  },
  chipActive: { backgroundColor: c.primary },
  chipIcon: { fontSize: 14, color: c.textSecondary },
  chipText: { fontSize: 14, fontWeight: "600", color: c.text },
  chipCount: { fontSize: 12, fontWeight: "700", color: c.textMuted },
  chipTextActive: { color: c.onPrimary },

  // Sheet header states
  peekEmpty: { paddingHorizontal: 16, paddingBottom: 16, gap: 4 },
  peekEmptyTitle: { fontSize: 16, fontWeight: "700", color: c.text },
  peekEmptyAction: { fontSize: 14, color: c.primary, fontWeight: "600" },
  errorBanner: { paddingHorizontal: 16, paddingBottom: 8 },
  errorText: { color: c.dangerText, fontSize: 13 },

  // List
  listContent: { paddingTop: 4 },
  reportMissing: { alignItems: "center", paddingVertical: 16, minHeight: 44 },
  reportMissingText: { color: c.primary, fontSize: 14, fontWeight: "600" },

  // Desktop web
  desktopRow: { flex: 1, flexDirection: "row" },
  sidePanel: { width: 420, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: c.border, backgroundColor: c.surface },
});

export default function App() {
  return (
    <SafeAreaProvider>
      <AppContent />
    </SafeAreaProvider>
  );
}
