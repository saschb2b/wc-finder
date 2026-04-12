import { useState, useEffect, useCallback, useRef } from "react";
import { InteractionManager } from "react-native";
import * as Location from "expo-location";
import { Toilet } from "../types/toilet";
import { getNearbyToilets, getToiletsInBounds } from "../services/overpass";

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

  const initLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setError(
          "Standortberechtigung wird benötigt, um die nächste Toilette zu finden.",
        );
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        lat: location.coords.latitude,
        lon: location.coords.longitude,
      };
      setUserLocation(coords);
      setSearchLocation(null);
      setExploreBounds(null);
      loadToilets(coords.lat, coords.lon);
    } catch (err: any) {
      setError("Standort konnte nicht ermittelt werden.");
      setLoading(false);
      console.error("Location error:", err);
    }
  }, [loadToilets]);

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
