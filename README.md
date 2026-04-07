# WC Finder

[![Download APK](https://img.shields.io/github/v/release/saschb2b/wc-finder?label=Download%20APK&style=for-the-badge&color=34a853)](https://github.com/saschb2b/wc-finder/releases/latest)
[![Build Status](https://img.shields.io/github/actions/workflow/status/saschb2b/wc-finder/build.yml?branch=main&style=for-the-badge)](https://github.com/saschb2b/wc-finder/actions)

A free toilet finder for wheelchair users in Germany, Austria, and Switzerland.

You have a Euroschlüssel. You need to go. Where is the nearest accessible toilet you can actually use right now? WC Finder answers that question in one tap.

---

## 📱 Download

### [⬇️ Download Latest APK](https://github.com/saschb2b/wc-finder/releases/latest)

**Installation:**
1. Click the green button above
2. Download `wc-finder.apk` from the latest release
3. Open the file on your Android device
4. Allow installation from unknown sources if prompted
5. Grant location permission when asked

**Requirements:**
- Android 6.0+ (API level 23)
- Location permission (to find nearest toilets)
- Internet connection (for map tiles)

---

## What it does

- Shows **11,000+ wheelchair-accessible toilets** on a map, sorted by distance (plus real-time Google Places results when configured)
- One tap to navigate to the nearest **24/7 public toilet** via Google Maps
- Each toilet is categorized: **24/7 public**, **station**, **gastro**, or **other** — so you know which ones are actually usable when you need them
- **Search by city** — planning a trip to Dortmund? See all toilets there before you arrive
- **Pan the map** and tap "Hier suchen" to explore any area
- **Favorites** — save the toilets you trust for your regular routes
- **Community reporting** — something wrong? Toilet gone? New one found? Report it directly from the app

## Why this exists

Existing apps either cost money per month or have incomplete data. WC Finder is free, open-source, and combines multiple data sources to be as complete as possible.

The distinction between a public 24/7 EU-key toilet and a wheelchair-accessible toilet inside a Starbucks that closes at 8pm matters when you urgently need to go. WC Finder makes that distinction visible.

## Data sources

Toilet locations are merged from multiple sources:

- **toilettenhero.de** — 11,000+ locations from OpenStreetMap, filtered for wheelchair accessibility
- **OpenStreetMap Overpass API** — 11,000+ wheelchair-accessible toilets queried directly
  - Basic query: `wheelchair=yes` only
  - Enhanced query: fuel stations, hotels, museums, shopping malls (may have accessible toilets)
- **Manual curation** — 68+ verified locations at McDonald's, shopping malls, hospitals, and police stations in major cities
- **Toiletten für alle + Stadt Hannover** — curated premium accessible locations with care equipment
- **Stadt Dortmund** — official open data for public toilets

All data is bundled offline in geo-tiles. The app works without internet after install.

## Development

```bash
pnpm install
pnpm start
```

Scan the QR code with Expo Go, or press `a` for Android.

### Updating toilet data

```bash
# Basic update
pnpm exec tsx scripts/fetch-toilets.ts          # scrape toilettenhero.de
pnpm exec tsx scripts/fetch-overpass-toilets.ts  # pull from OpenStreetMap
pnpm exec tsx scripts/fetch-tfa.ts               # curated Hannover
pnpm exec tsx scripts/merge-sources.ts           # deduplicate + merge
pnpm exec tsx scripts/split-tiles.ts             # split into geo-tiles
pnpm exec tsx scripts/gen-tile-loader.ts         # generate tile loader

# Enhanced dataset (includes fuel stations, hotels, malls)
pnpm exec tsx scripts/fetch-enhanced-osm.ts      # extended OSM query
pnpm exec tsx scripts/fetch-manual-curated.ts    # manual curation
pnpm exec tsx scripts/merge-sources.ts           # merge all sources
pnpm exec tsx scripts/split-tiles.ts
pnpm exec tsx scripts/gen-tile-loader.ts
```

### Building locally

Requires an [Expo](https://expo.dev) account and `EXPO_TOKEN`:

```bash
eas build --platform android --profile preview
```

### Releasing a new version

```bash
# Tag a new version to trigger the release workflow
git tag v1.0.1
git push origin v1.0.1
```

GitHub Actions will automatically build and attach the APK to a new release.

## Optional: Google Places API (Data Enrichment)

To add businesses not in OpenStreetMap (like "Clubhouse by The Harp"):

```bash
# 1. Get API key at https://developers.google.com/maps/documentation/places/web-service/get-api-key
# 2. Enable "Places API (New)"
# 3. Copy and fill in:
cp .env.example .env
# Edit .env and add: GOOGLE_PLACES_API_KEY=your_key_here

# 4. Fetch places around your area:
npx tsx scripts/fetch-google-places.ts 52.375 9.82 1000

# 5. Merge into dataset and rebuild:
npx tsx scripts/merge-sources.ts
npx tsx scripts/split-tiles.ts
npx tsx scripts/gen-tile-loader.ts
eas build --platform android --profile preview
```

**Important:**
- Free tier: 5,000 places/month, then $17 per 1,000
- Data is fetched once and bundled offline — no runtime API calls
- Results are merged with existing OSM data

## Contributing

Found a toilet that's missing or has wrong data? You can:

1. Use the **"+ Melden"** button in the app
2. Open an [issue](https://github.com/saschb2b/wc-finder/issues) on GitHub
3. Add or fix the toilet on [OpenStreetMap](https://www.openstreetmap.org) (tag: `amenity=toilets`, `wheelchair=yes`, `eurokey=yes`)

## License

MIT
