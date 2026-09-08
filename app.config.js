export default {
  name: "WC Finder",
  slug: "wc-finder",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  // Follow the system appearance; expo-system-ui makes Android honour this.
  userInterfaceStyle: "automatic",
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.saschb2b.wcfinder",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "WC Finder needs your location to find the nearest public toilet.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "WC Finder needs your location to find the nearest public toilet.",
    },
  },
  // Localized Info.plist strings; the system language picks the file.
  locales: {
    de: "./locales/de.json",
    en: "./locales/en.json",
  },
  android: {
    package: "com.saschb2b.wcfinder",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#0643a7",
    },
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
  },
  web: {
    bundler: "metro",
    output: "single",
    favicon: "./assets/favicon.png",
  },
  experiments: {
    baseUrl: process.env.WEB_BASE_PATH || "",
  },
  plugins: [
    // Splash matches the app's loading screen in both appearances (see src/theme/colors.ts),
    // so launch -> loading -> map is one continuous surface. Icon width follows the
    // Android 12 system splash convention of a centred icon on a plain background.
    [
      "expo-splash-screen",
      {
        image: "./assets/splash-icon.png",
        imageWidth: 200,
        resizeMode: "contain",
        backgroundColor: "#f8f9fa",
        dark: {
          image: "./assets/splash-icon-dark.png",
          backgroundColor: "#121212",
        },
      },
    ],
    "expo-status-bar",
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "WC Finder needs your location to find the nearest public toilet.",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "722813c5-17f3-4b55-97d0-7a1324e3619a",
    },
  },
};
