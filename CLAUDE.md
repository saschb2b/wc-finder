# CLAUDE.md

## Project

WC Finder — a React Native (Expo SDK 57) app that helps wheelchair users find the nearest accessible toilet with a Euroschlüssel (EU key) in Germany, Austria, and Switzerland. 11,000+ toilets bundled offline in geo-tiles.

## Commands

```bash
pnpm install              # install dependencies
pnpm start                # start Expo dev server
pnpm start --clear        # start with cache cleared
pnpm typecheck            # run TypeScript type checking
pnpm site                 # preview the landing page (docs/) at http://localhost:8100
pnpm site:full            # build the web export and serve landing page + app at http://localhost:8099
```

### Data pipeline (run in order)

```bash
pnpm exec tsx scripts/fetch-toilets.ts          # scrape toilettenhero.de
pnpm exec tsx scripts/fetch-overpass-toilets.ts  # pull from OpenStreetMap
pnpm exec tsx scripts/fetch-tfa.ts               # curated locations
pnpm exec tsx scripts/fetch-autobahn-rest.ts     # Autobahn rest areas (govt API)
pnpm exec tsx scripts/fetch-station-toilets.ts   # train station / Sanifair toilets
pnpm exec tsx scripts/merge-sources.ts           # deduplicate + merge
pnpm exec tsx scripts/migrate-hours-format.ts    # normalize opening hours
pnpm exec tsx scripts/split-tiles.ts             # split into geo-tiles
pnpm exec tsx scripts/gen-tile-loader.ts         # regenerate tile loader
```

After running the pipeline, `src/data/tileLoader.ts` and `src/data/tiles/` are updated. The intermediate files (`toilets.json`, `osm-toilets.json`, `tfa-toilets.json`) are not committed — only tiles are.

### Opening Hours Format

Toilets now use a standardized `hours` field (see `src/types/opening-hours.ts`):

```typescript
interface StandardizedHours {
  type: '24_7' | 'weekly' | 'seasonal' | 'unknown';
  weekly?: {
    0: { isOpen: boolean; periods: [{ open: 540, close: 1020 }] }, // Sunday
    1: { isOpen: boolean; periods: [{ open: 540, close: 1020 }] }, // Monday
    // ... etc
  };
}
```

The `migrate-hours-format.ts` script normalizes OSM/Google Places strings to this format.

### Enrich with Google Places (optional)

To add businesses not in OpenStreetMap:

```bash
# 1. Set GOOGLE_PLACES_API_KEY in .env file
# 2. Fetch places around a location (e.g., Hannover)
npx tsx scripts/fetch-google-places.ts 52.375 9.82 1000

# 3. Merge into dataset
npx tsx scripts/merge-sources.ts
npx tsx scripts/split-tiles.ts
npx tsx scripts/gen-tile-loader.ts
```

Cost: Free tier 5,000 places/month, then $17 per 1,000.

### Releasing

1. Move the **Unreleased** entries in `CHANGELOG.md` under `## [X.Y.Z] – YYYY-MM-DD`, written for users, not developers.
2. Bump `version` and `android.versionCode` in `app.config.js` (and `version` in `package.json`).
3. Commit, tag `vX.Y.Z`, push the tag. The release workflow builds the APK and uses the changelog section as the release notes; it fails if the section is missing.

## Architecture

- **App.tsx** — single-screen app: map + bottom panel with nearest card, list, filters
- **src/components/ToiletMap.tsx / ToiletMap.web.tsx** — Leaflet WebView / iframe with a typed message bridge
- **src/map/leaflet-runtime.ts** — embedded map; run `pnpm build:map` after edits and commit generated assets
- **src/hooks/useToilets.ts** — location + tile loading + search-at-location
- **src/hooks/useFavorites.ts** — AsyncStorage-backed favorites
- **src/services/overpass.ts** — loads tiles, distance calc, formatting
- **src/services/report.ts** — opens pre-filled GitHub Issues for community reports
- **src/data/tileLoader.ts** — auto-generated static require map for 136 geo-tiles (1°x1°)
- **src/types/toilet.ts** — Toilet type, categories, labels, colors

## Key decisions

- **Offline-first data**: toilet data and Leaflet are bundled; background map tiles load from OpenStreetMap with HTTP caching, no offline prefetch
- **No reanimated/bottom-sheet**: removed due to TurboModule crashes in Expo Go — using simple toggle panel instead
- **Key-free map**: Leaflet markers update in place; keep attribution visible and follow the OSM tile usage policy
- **Viewport filtering**: only renders markers visible on the map (max 200), keeping the selected toilet included
- **Clustering**: overlapping pins collapse into counted clusters (leaflet.markercluster, bundled by `pnpm build:map`); the selected pin is always placed directly on the map. On first load the map fits the reference point plus the nearest eight results (`fitToPoints`) instead of a fixed zoom
- **Categories matter**: `public_24h` (EU key, 24/7) vs `station` (train/bus) vs `tankstelle` (fuel stations) vs `gastro` vs `other` — the default filter hides unreliable gastro/other toilets
- **Theming**: colours come from `src/theme` (`useTheme`, `useThemedStyles`), never hard-coded in components. The scheme follows the system (`userInterfaceStyle: "automatic"`); the embedded map gets a `theme` command and darkens OSM tiles with a CSS filter. The splash screen (`expo-splash-screen` plugin in `app.config.js`) uses the same light/dark backgrounds as the loading screen; keep them in sync with `src/theme/colors.ts`.
- **i18n**: all user-facing text goes through `t()` from `src/i18n` (German is the source dictionary, English the translation; keys are typed and a test enforces parity). The system language picks the locale at startup in `index.ts`; non-German devices get English. Strings inside the embedded map are passed via `MapStrings`.

## Style

- pnpm, not npm
- TypeScript strict mode
- No unnecessary abstractions — it's a single-screen app
- Commit messages in English, UI strings in `src/i18n/translations.ts` (German + English)
