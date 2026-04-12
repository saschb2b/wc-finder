import { useState, useEffect, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import { Toilet } from "../types/toilet";
import { getNearbyToilets, getToiletsInBounds } from "../services/overpass";

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
  } | null>(null);
  const [exploreBounds, setExploreBounds] = useState<{
    lat: number;
    lon: number;
    latDelta: number;
    lonDelta: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exploreTaskRef = useRef<ReturnType<typeof InteractionManager.runAfterInteractions> | null>(null);
  const initialLoadDone = useRef(false);

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

  const loadToilets = useCallback((lat: number, lon: number) => {
    setLoading(true);
    setError(null);

    const results = getNearbyToilets(lat, lon);
    setToilets(results);
    setNearest(results.length > 0 ? results[0] : null);

    if (results.length === 0) {
      setError("Keine Toiletten in der Nähe gefunden.");
    }

    setLoading(false);
  }, []);

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
      if (!initialLoadDone.current) {
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
    initLocation();
  }, [initLocation]);

  const refresh = useCallback(() => {
    if (searchLocation) {
      loadToilets(searchLocation.lat, searchLocation.lon);
    } else if (userLocation) {
      loadToilets(userLocation.lat, userLocation.lon);
    } else {
      initLocation();
    }
  }, [userLocation, searchLocation, loadToilets, initLocation]);

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
  // Deferred via InteractionManager so map animations finish first
  const exploreAt = useCallback(
    (lat: number, lon: number, latDelta: number, lonDelta: number) => {
      // Cancel any pending explore task
      if (exploreTaskRef.current) {
        exploreTaskRef.current.cancel();
      }

      setUpdating(true);
      setError(null);
      setExploreBounds({ lat, lon, latDelta, lonDelta });

      // Defer heavy work until after animations complete
      exploreTaskRef.current = InteractionManager.runAfterInteractions(() => {
        const results = getToiletsInBounds(
          lat - latDelta / 2,
          lat + latDelta / 2,
          lon - lonDelta / 2,
          lon + lonDelta / 2,
        );

        const referencePoint = userLocation || { lat, lon };
        const withDistances = calculateDistances(
          results,
          referencePoint.lat,
          referencePoint.lon,
        );

        setToilets(withDistances);
        setNearest(withDistances.length > 0 ? withDistances[0] : null);
        setUpdating(false);
      });
    },
    [userLocation, calculateDistances],
  );

  const clearExplore = useCallback(() => {
    setExploreBounds(null);
    if (searchLocation) {
      loadToilets(searchLocation.lat, searchLocation.lon);
    } else if (userLocation) {
      loadToilets(userLocation.lat, userLocation.lon);
    }
  }, [searchLocation, userLocation, loadToilets]);

  const backToMyLocation = useCallback(() => {
    setSearchLocation(null);
    setExploreBounds(null);
    if (userLocation) {
      loadToilets(userLocation.lat, userLocation.lon);
    }
  }, [userLocation, loadToilets]);

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

// Helper to calculate distance between two points
function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
