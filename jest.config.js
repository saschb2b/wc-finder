/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.d.ts",
    "!src/data/**/*",
    "!src/map/leaflet-assets.generated.ts",
    "!src/map/leaflet-runtime.ts", // Runs inside the map's browser document.
    "!src/map/*.test.ts",
    "!src/components/**/*", // JSX components need different coverage setup
  ],
  coverageThreshold: {
    global: {
      branches: 10,
      functions: 10,
      lines: 10,
      statements: 10,
    },
  },
  testMatch: ["**/__tests__/**/*.test.{ts,tsx}"],
};
