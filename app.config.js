export default {
  name: "WC Finder",
  slug: "wc-finder",
  version: "1.0.0",
  orientation: "portrait",
  icon: "./assets/icon.png",
  userInterfaceStyle: "light",
  newArchEnabled: true,
  splash: {
    image: "./assets/splash-icon.png",
    resizeMode: "contain",
    backgroundColor: "#1a73e8",
  },
  ios: {
    supportsTablet: true,
    bundleIdentifier: "com.saschb2b.wcfinder",
    infoPlist: {
      NSLocationWhenInUseUsageDescription:
        "WC Finder benötigt deinen Standort, um die nächste öffentliche Toilette zu finden.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "WC Finder benötigt deinen Standort, um die nächste öffentliche Toilette zu finden.",
    },
  },
  android: {
    package: "com.saschb2b.wcfinder",
    adaptiveIcon: {
      foregroundImage: "./assets/adaptive-icon.png",
      backgroundColor: "#1a73e8",
    },
    edgeToEdgeEnabled: true,
    permissions: ["ACCESS_FINE_LOCATION", "ACCESS_COARSE_LOCATION"],
  },
  web: {
    favicon: "./assets/favicon.png",
  },
  plugins: [
    [
      "expo-location",
      {
        locationWhenInUsePermission:
          "WC Finder benötigt deinen Standort, um die nächste öffentliche Toilette zu finden.",
      },
    ],
  ],
  extra: {
    eas: {
      projectId: "722813c5-17f3-4b55-97d0-7a1324e3619a",
    },
  },
};
