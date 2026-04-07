# CLAUDE.md

## Project

WC Finder — a React Native (Expo SDK 54) app that helps wheelchair users find the nearest accessible toilet with a Euroschlüssel (EU key) in Germany, Austria, and Switzerland. 11,000+ toilets bundled offline in geo-tiles.

## Commands

```bash
pnpm install              # install dependencies
pnpm start                # start Expo dev server
pnpm start --clear        # start with cache cleared
pnpm typecheck            # run TypeScript type checking
```

### Data pipeline (run in order)

```bash
pnpm exec tsx scripts/fetch-toilets.ts          # scrape toilettenhero.de
pnpm exec tsx scripts/fetch-overpass-toilets.ts  # pull from OpenStreetMap
pnpm exec tsx scripts/fetch-tfa.ts               # curated locations
pnpm exec tsx scripts/merge-sources.ts           # deduplicate + merge
pnpm exec tsx scripts/split-tiles.ts             # split into geo-tiles
pnpm exec tsx scripts/gen-tile-loader.ts         # regenerate tile loader
```

After running the pipeline, `src/data/tileLoader.ts` and `src/data/tiles/` are updated. The intermediate files (`toilets.json`, `osm-toilets.json`, `tfa-toilets.json`) are not committed — only tiles are.

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

## Architecture

- **App.tsx** — single-screen app: map + bottom panel with nearest card, list, filters
- **src/hooks/useToilets.ts** — location + tile loading + search-at-location
- **src/hooks/useFavorites.ts** — AsyncStorage-backed favorites
- **src/services/overpass.ts** — loads tiles, distance calc, formatting
- **src/services/report.ts** — opens pre-filled GitHub Issues for community reports
- **src/data/tileLoader.ts** — auto-generated static require map for 136 geo-tiles (1°x1°)
- **src/types/toilet.ts** — Toilet type, categories, labels, colors

## Key decisions

- **Offline-first**: all toilet data is bundled as JSON tiles, no API calls at runtime
- **No reanimated/bottom-sheet**: removed due to TurboModule crashes in Expo Go — using simple toggle panel instead
- **Native map pins**: custom marker views (`ToiletMarker.tsx`) were too slow with 50+ markers — using `pinColor` + `tracksViewChanges={false}`
- **Viewport filtering**: only renders markers visible on the map (max 50) for performance
- **Categories matter**: `public_24h` (EU key, 24/7) vs `station` vs `gastro` vs `other` — the default filter hides unreliable gastro/other toilets
- **German UI**: all user-facing text is in German

## Style

- pnpm, not npm
- TypeScript strict mode
- No unnecessary abstractions — it's a single-screen app
- Commit messages in English, UI in German
