# WC Finder

Find the nearest Euroschlüssel (EU key) accessible toilet — fast.

Built for wheelchair users who need to quickly locate and navigate to the closest 24/7 accessible toilet that opens with the European disability key (Euroschlüssel).

## Features

- Map centered on your location with all nearby EU key toilets
- Nearest toilet highlighted with one-tap navigation to Google Maps
- Swipeable bottom sheet with full list sorted by distance
- Data from OpenStreetMap (Overpass API) — free, open, community-maintained
- 25km search radius around your position

## Tech Stack

- React Native + Expo SDK 54
- react-native-maps
- @gorhom/bottom-sheet
- expo-location
- OpenStreetMap Overpass API (`eurokey=yes` / `centralkey=yes` tags)

## Getting Started

```bash
npm install
npx expo start
```

Scan the QR code with Expo Go on your phone, or press `a` for Android / `i` for iOS.

## Data Source

Toilet locations come from OpenStreetMap's Overpass API, querying for:
- `amenity=toilets` + `eurokey=yes`
- `amenity=toilets` + `centralkey=yes`

The community actively maintains this data. If you find a missing toilet, you can add it on [openstreetmap.org](https://www.openstreetmap.org).
