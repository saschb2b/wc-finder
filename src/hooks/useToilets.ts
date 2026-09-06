import { useState, useEffect, useCallback, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Platform } from "react-native";
import { Toilet } from "../types/toilet";
import { getDistanceMeters, getNearbyToilets, getToiletsInBounds } from "../services/overpass";
import { scheduleIdleTask } from "../utils/idle-task";

const LAST_LOCATION_KEY = "wc_last_location";

interface UseToiletsResult {
  toilets: Toilet[];
  nearest: Toilet | null;
  userLocation: { lat: number; lon: number } | null;
  searchLocation: { lat: number; lon: number } | null;
  loading: boolean;
  updating: boolean;
  error: string | null;
  refresh: () => void;
  searchAt: (lat: number, lon: number) => void;
  backToMyLocation: () => void;
  exploreAt: (
    lat: number,
    lon: number,
    latDelta: number,
    lonDelta: number,
  ) => void;
  exploreBounds: {
    lat: number;
    lon: number;
    latDelta: number;
    lonDelta: number;
  } | null;
  clearExplore: () => void;
}

export function useToilets(): UseToiletsResult {
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [nearest, setNearest] = useState<Toilet | null>(null);
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(null);
  const [searchLocation, setSearchLocation] = useState<{
    lat: number;
    lon: number;
  } | null>(Platform.OS === "web" ? { lat: 52.3759, lon: 9.732 } : null);
  const [exploreBounds, setExploreBounds] = useState<{
    lat: number;
    lon: number;
    latDelta: number;
    lonDelta: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exploreTaskRef = useRef<(() => void) | null>(null);
  const initialLoadDone = useRef(false);
  const requestId = useRef(0);

  const cancelPendingExplore = useCallback(() => {
    requestId.current++;
    exploreTaskRef.current?.();
    exploreTaskRef.current = null;
  }, []);

  useEffect(() => cancelPendingExplore, [cancelPendingExplore]);

  // Calculate distances from a reference point while preserving toilet data
  const calculateDistances = useCallback(
    (toiletList: Toilet[], fromLat: number, fromLon: number): Toilet[] => {
      return toiletList
        .map((t) => ({
          ...t,
          distance: getDistanceMeters(fromLat, fromLon, t.lat, t.lon),
        }))
        .sort((a, b) => (a.distance || 0) - (b.distance || 0));
    },
    [],
  );

  const loadToilets = useCallback(async (lat: number, lon: number) => {
    cancelPendingExplore();
    const currentRequest = requestId.current;
    setUpdating(false);
    setLoading(true);
    setError(null);

    try {
      const results = await getNearbyToilets(lat, lon);
      if (currentRequest !== requestId.current) return;
      setToilets(results);
      setNearest(results.length > 0 ? results[0] : null);
      if (results.length === 0) setError("Keine Toiletten in der Nähe gefunden.");
    } catch {
      if (currentRequest !== requestId.current) return;
      setError("Toilettendaten konnten nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.");
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [cancelPendingExplore]);

  // Full load: sets location, clears explore, loads toilets. Used for first fix only.
  const fullLocationLoad = useCallback(
    (coords: { lat: number; lon: number }) => {
      setUserLocation(coords);
      setSearchLocation(null);
      setExploreBounds(null);
      loadToilets(coords.lat, coords.lon);
      initialLoadDone.current = true;
      AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(coords)).catch(
        () => {},
      );
    },
    [loadToilets],
  );

  // Silent update: only updates userLocation (for distance calc). No map reset.
  const silentLocationUpdate = useCallback(
    (coords: { lat: number; lon: number }) => {
      setUserLocation(coords);
      AsyncStorage.setItem(LAST_LOCATION_KEY, JSON.stringify(coords)).catch(
        () => {},
      );
    },
    [],
  );

  const initLocation = useCallback(async () => {
    // 1. Try cached location first — show map instantly
    try {
      const cached = await AsyncStorage.getItem(LAST_LOCATION_KEY);
      if (cached && !initialLoadDone.current) {
        const coords = JSON.parse(cached);
        fullLocationLoad(coords);
      }
    } catch {}

    // 2. Request permission
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        if (!initialLoadDone.current) {
          setError(
            "Standortberechtigung wird benötigt, um die nächste Toilette zu finden.",
          );
          setLoading(false);
        }
        return;
      }

      // 3. Try last known position — often instant
      const lastKnown = await Location.getLastKnownPositionAsync();
      if (lastKnown) {
        const coords = {
          lat: lastKnown.coords.latitude,
          lon: lastKnown.coords.longitude,
        };
        if (!initialLoadDone.current) {
          fullLocationLoad(coords);
        } else {
          silentLocationUpdate(coords);
        }
      }

      // 4. Get accurate position in background
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      };
      if (!initialLoadDone.current || Platform.OS === "web") {
        fullLocationLoad(coords);
      } else {
        silentLocationUpdate(coords);
      }
    } catch (err: any) {
      if (!initialLoadDone.current) {
        setError("Standort konnte nicht ermittelt werden.");
        setLoading(false);
      }
      console.error("Location error:", err);
    }
  }, [fullLocationLoad, silentLocationUpdate]);

  useEffect(() => {
    // Browsers can explore immediately; request location only on explicit use.
    if (Platform.OS === "web") {
      return scheduleIdleTask(() => { void loadToilets(52.3759, 9.732); });
    }
    // Location initialization awaits storage/permission APIs before updating state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    initLocation();
  }, [initLocation, loadToilets]);

  // Search at a new location - this CHANGES the distance reference point
  // Used for: City search, planning a trip TO this location
  const searchAt = useCallback(
    (lat: number, lon: number) => {
      setSearchLocation({ lat, lon });
      setExploreBounds(null);
      loadToilets(lat, lon);
    },
    [loadToilets],
  );

  // Explore at bounds - loads toilets in area but keeps distance from userLocation
  // Map movement is already debounced; defer tile processing until JS is idle.
  const exploreAt = useCallback(
    (lat: number, lon: number, latDelta: number, lonDelta: number) => {
      cancelPendingExplore();
      const currentRequest = requestId.current;

      setUpdating(true);
      setLoading(false);
      setError(null);
      setExploreBounds({ lat, lon, latDelta, lonDelta });

      exploreTaskRef.current = scheduleIdleTask(async () => {
        exploreTaskRef.current = null;
        try {
          const results = await getToiletsInBounds(
            lat - latDelta / 2,
            lat + latDelta / 2,
            lon - lonDelta / 2,
            lon + lonDelta / 2,
          );
          if (currentRequest !== requestId.current) return;

          const referencePoint = userLocation || { lat, lon };
          const withDistances = calculateDistances(
            results,
            referencePoint.lat,
            referencePoint.lon,
          );

          setToilets(withDistances);
          setNearest(withDistances.length > 0 ? withDistances[0] : null);
        } catch {
          if (currentRequest === requestId.current) setError("Toilettendaten konnten nicht geladen werden. Bitte Verbindung prüfen und erneut versuchen.");
        } finally {
          if (currentRequest === requestId.current) setUpdating(false);
        }
      });
    },
    [userLocation, calculateDistances, cancelPendingExplore],
  );

  const refresh = useCallback(() => {
    if (exploreBounds) {
      exploreAt(exploreBounds.lat, exploreBounds.lon, exploreBounds.latDelta, exploreBounds.lonDelta);
    } else if (searchLocation) {
      void loadToilets(searchLocation.lat, searchLocation.lon);
    } else if (userLocation) {
      void loadToilets(userLocation.lat, userLocation.lon);
    } else {
      void initLocation();
    }
  }, [userLocation, searchLocation, exploreBounds, loadToilets, initLocation, exploreAt]);

  const clearExplore = useCallback(() => {
    cancelPendingExplore();
    setUpdating(false);
    setExploreBounds(null);
    if (searchLocation) {
      loadToilets(searchLocation.lat, searchLocation.lon);
    } else if (userLocation) {
      loadToilets(userLocation.lat, userLocation.lon);
    }
  }, [searchLocation, userLocation, loadToilets, cancelPendingExplore]);

  const backToMyLocation = useCallback(() => {
    cancelPendingExplore();
    setUpdating(false);
    setSearchLocation(null);
    setExploreBounds(null);
    if (userLocation) {
      loadToilets(userLocation.lat, userLocation.lon);
    } else {
      void initLocation();
    }
  }, [userLocation, loadToilets, cancelPendingExplore, initLocation]);

  return {
    toilets,
    nearest,
    userLocation,
    searchLocation,
    exploreBounds,
    loading,
    updating,
    error,
    refresh,
    searchAt,
    backToMyLocation,
    exploreAt,
    clearExplore,
  };
}
