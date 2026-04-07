import { useState, useEffect, useCallback } from "react";

// Note: To enable persistent favorites, install:
//   npx expo install @react-native-async-storage/async-storage
//
// Then update this file to use the commented code below.

const STORAGE_KEY = "wc_favorites";

// In-memory fallback
const memoryStorage = new Set<string>();

async function getAsyncStorage() {
  try {
    // @ts-ignore - optional dependency
    const mod = await import("@react-native-async-storage/async-storage");
    return mod.default;
  } catch {
    return null;
  }
}

export function useFavorites() {
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const loadFavorites = async () => {
      try {
        const AsyncStorage = await getAsyncStorage();
        if (AsyncStorage) {
          const raw = await AsyncStorage.getItem(STORAGE_KEY);
          if (raw) {
            const parsed: string[] = JSON.parse(raw);
            setFavoriteIds(new Set(parsed));
          }
        } else {
          // Use memory fallback
          setFavoriteIds(new Set(memoryStorage));
        }
      } catch {
        setFavoriteIds(new Set(memoryStorage));
      }
      setLoaded(true);
    };

    loadFavorites();
  }, []);

  const persist = useCallback(async (ids: Set<string>) => {
    const AsyncStorage = await getAsyncStorage();
    if (AsyncStorage) {
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
    } else {
      // Memory fallback
      memoryStorage.clear();
      ids.forEach((id) => memoryStorage.add(id));
    }
  }, []);

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavoriteIds((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        persist(next);
        return next;
      });
    },
    [persist],
  );

  const isFavorite = useCallback(
    (id: string) => favoriteIds.has(id),
    [favoriteIds],
  );

  return { favoriteIds, toggleFavorite, isFavorite, loaded };
}
