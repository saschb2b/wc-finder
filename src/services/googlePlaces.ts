/**
 * Google Places API integration for fetching nearby businesses with restrooms.
 * Falls back gracefully if API key is not configured or quota exceeded.
 *
 * Usage:
 * 1. Set GOOGLE_PLACES_API_KEY in .env file
 * 2. Call findNearbyPlacesWithRestrooms(lat, lon)
 *
 * Note: Places API (New) has different pricing than Places API (Legacy).
 * We use the Nearby Search (New) which is more cost-effective.
 */

import { Toilet, ToiletCategory } from "../types/toilet";
import Constants from "expo-constants";

// Get API key from EAS/environment (works for local dev and EAS builds)
const GOOGLE_PLACES_API_KEY =
  Constants.expoConfig?.extra?.googlePlacesApiKey ||
  process.env.GOOGLE_PLACES_API_KEY ||
  "";

interface GooglePlace {
  id: string;
  displayName: { text: string };
  location: { latitude: number; longitude: number };
  accessibilityOptions?: {
    wheelchairAccessibleEntrance?: boolean;
    wheelchairAccessibleRestroom?: boolean;
  };
  restroom?: boolean;
  primaryType?: string;
  types?: string[];
  businessStatus?: string;
}

/**
 * Searches for nearby places that have restrooms.
 * Filters for wheelchair accessibility if possible.
 */
export async function findNearbyPlacesWithRestrooms(
  lat: number,
  lon: number,
  radius: number = 500, // meters
): Promise<Toilet[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    console.log("Google Places API key not configured");
    return [];
  }

  try {
    // Use Places API (New) - Nearby Search
    const response = await fetch(
      `https://places.googleapis.com/v1/places:searchNearby`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": GOOGLE_PLACES_API_KEY,
          "X-Goog-FieldMask":
            "places.id,places.displayName,places.location,places.accessibilityOptions,places.restroom,places.primaryType,places.types,places.businessStatus",
        },
        body: JSON.stringify({
          locationRestriction: {
            circle: {
              center: { latitude: lat, longitude: lon },
              radius: radius,
            },
          },
          // Search for places likely to have public restrooms
          includedTypes: [
            "restaurant",
            "cafe",
            "fast_food_restaurant",
            "gym",
            "shopping_mall",
            "department_store",
            "supermarket",
            "convenience_store",
            "gas_station",
          ],
          maxResultCount: 20,
        }),
      },
    );

    if (!response.ok) {
      const error = await response.text();
      console.warn("Google Places API error:", error);
      return [];
    }

    const data = await response.json();
    const places: GooglePlace[] = data.places || [];

    return places
      .filter((place) => {
        // Only include places with restrooms OR wheelchair accessible
        const hasRestroom = place.restroom === true;
        const hasAccessibleRestroom =
          place.accessibilityOptions?.wheelchairAccessibleRestroom === true;
        const hasAccessibleEntrance =
          place.accessibilityOptions?.wheelchairAccessibleEntrance === true;

        // Include if it has a restroom and at least some accessibility
        return hasRestroom && (hasAccessibleRestroom || hasAccessibleEntrance);
      })
      .map((place) => convertToToilet(place));
  } catch (err) {
    console.error("Google Places fetch failed:", err);
    return [];
  }
}

function convertToToilet(place: GooglePlace): Toilet {
  const types = place.types || [];
  const primaryType = place.primaryType || "";

  // Determine category
  let category: ToiletCategory = "other";
  if (
    types.includes("restaurant") ||
    types.includes("cafe") ||
    types.includes("fast_food_restaurant") ||
    primaryType.includes("restaurant") ||
    primaryType.includes("cafe")
  ) {
    category = "gastro";
  } else if (
    types.includes("gas_station") ||
    primaryType.includes("gas_station")
  ) {
    category = "tankstelle";
  }

  // Build tags
  const tags: string[] = [];

  // Mark as wheelchair accessible if Google says so
  if (
    place.accessibilityOptions?.wheelchairAccessibleRestroom === true ||
    place.accessibilityOptions?.wheelchairAccessibleEntrance === true
  ) {
    tags.push("barrierefrei");
  }

  // Mark if explicitly has restroom
  if (place.restroom === true) {
    tags.push("wc_verfuegbar");
  }

  return {
    id: `gplaces_${place.id}`,
    lat: place.location.latitude,
    lon: place.location.longitude,
    name: place.displayName?.text || "Unnamed Location",
    city: "", // Google doesn't provide this directly in nearby search
    category,
    tags,
    // Note: Opening hours require a separate API call ( Places Details)
    // We could fetch this on-demand when user selects a place
  };
}

/**
 * Check if Google Places API is configured.
 */
export function isGooglePlacesConfigured(): boolean {
  return (
    !!GOOGLE_PLACES_API_KEY && GOOGLE_PLACES_API_KEY !== "your_api_key_here"
  );
}

/**
 * Get API status for debugging.
 */
export function getGooglePlacesStatus(): {
  configured: boolean;
  keyPreview: string;
} {
  if (!GOOGLE_PLACES_API_KEY) {
    return { configured: false, keyPreview: "none" };
  }
  return {
    configured: true,
    keyPreview: `${GOOGLE_PLACES_API_KEY.substring(0, 8)}...`,
  };
}
