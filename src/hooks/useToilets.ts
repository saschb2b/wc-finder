import { useState, useEffect, useCallback } from 'react';
import * as Location from 'expo-location';
import { Toilet } from '../types/toilet';
import { getNearbyToilets } from '../services/overpass';

interface UseToiletsResult {
  toilets: Toilet[];
  nearest: Toilet | null;
  userLocation: { lat: number; lon: number } | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useToilets(): UseToiletsResult {
  const [toilets, setToilets] = useState<Toilet[]>([]);
  const [nearest, setNearest] = useState<Toilet | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadToilets = useCallback((lat: number, lon: number) => {
    setLoading(true);
    setError(null);

    const results = getNearbyToilets(lat, lon);
    setToilets(results);
    setNearest(results.length > 0 ? results[0] : null);

    if (results.length === 0) {
      setError('Keine barrierefreien Toiletten in der Nähe gefunden.');
    }

    setLoading(false);
  }, []);

  const initLocation = useCallback(async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setError('Standortberechtigung wird benötigt, um die nächste Toilette zu finden.');
        setLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = { lat: location.coords.latitude, lon: location.coords.longitude };
      setUserLocation(coords);
      loadToilets(coords.lat, coords.lon);
    } catch (err: any) {
      setError('Standort konnte nicht ermittelt werden.');
      setLoading(false);
      console.error('Location error:', err);
    }
  }, [loadToilets]);

  useEffect(() => {
    initLocation();
  }, [initLocation]);

  const refresh = useCallback(() => {
    if (userLocation) {
      loadToilets(userLocation.lat, userLocation.lon);
    } else {
      initLocation();
    }
  }, [userLocation, loadToilets, initLocation]);

  return { toilets, nearest, userLocation, loading, error, refresh };
}
