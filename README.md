# WC Finder

A free toilet finder for wheelchair users in Germany, Austria, and Switzerland.

You have a Euroschlüssel. You need to go. Where is the nearest accessible toilet you can actually use right now? WC Finder answers that question in one tap.

## What it does

- Shows **17,000+ wheelchair-accessible toilets** on a map, sorted by distance
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

Toilet locations are merged from three sources:

- **toilettenhero.de** — 9,000+ locations from OpenStreetMap, filtered for wheelchair accessibility
- **OpenStreetMap Overpass API** — 16,000+ wheelchair-accessible toilets queried directly, with opening hours, operator, and eurokey tags
- **Toiletten für alle + Stadt Hannover** — curated premium accessible locations with care equipment

All data is bundled offline in geo-tiles. The app works without internet after install.

## Getting started

```bash
pnpm install
pnpm start
```

Scan the QR code with Expo Go, or press `a` for Android.

### Updating toilet data

```bash
pnpm exec tsx scripts/fetch-toilets.ts          # scrape toilettenhero.de
pnpm exec tsx scripts/fetch-overpass-toilets.ts  # pull from OpenStreetMap
pnpm exec tsx scripts/fetch-tfa.ts               # curated locations
pnpm exec tsx scripts/merge-sources.ts           # deduplicate + merge
pnpm exec tsx scripts/split-tiles.ts             # split into geo-tiles
pnpm exec tsx scripts/gen-tile-loader.ts         # generate tile loader
```

### Building an APK

Requires an [Expo](https://expo.dev) account and `EXPO_TOKEN`:

```bash
eas build --platform android --profile preview
```

Or push to `main` — GitHub Actions builds the APK automatically.

## Contributing

Found a toilet that's missing or has wrong data? You can:

1. Use the **"+ Melden"** button in the app
2. Open an [issue](https://github.com/saschb2b/wc-finder/issues) on GitHub
3. Add or fix the toilet on [OpenStreetMap](https://www.openstreetmap.org) (tag: `amenity=toilets`, `wheelchair=yes`, `eurokey=yes`)

## License

MIT
