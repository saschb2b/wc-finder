# Changelog

All notable, user-visible changes to WC Finder. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow
[Semantic Versioning](https://semver.org/).

Write entries for people who use the app, not for developers: say what changed
for them and why it matters. Add lines under **Unreleased** as changes land; a
release moves that section under its version and date. The release workflow
publishes the matching section as the GitHub release notes and fails if it is
missing.

## [Unreleased]

## [0.2.0] – 2026-09-09

### Added
- **English interface.** The app follows your device language: German on German
  devices, English everywhere else. Switching the system language on Android
  takes effect on the next resume.
- **Dark mode** follows the system setting, including a darkened map, the
  splash screen, and the web app.
- **Last checked date** on every toilet, shown right under the address. It tells
  you whether a person confirmed it on site, a directory checked it, the entry
  was edited in OpenStreetMap, or the data was only downloaded. Entries older
  than 18 months or without a date are flagged.
- **"Stimmt so" / "Looks right"** in the report sheet lets you confirm an entry
  after a visit, which moves its check date forward.
- **Marker clusters.** Overlapping pins collapse into a counted bubble; tap it
  to zoom in. The selected toilet and the nearest one always stay visible.
- Public read-only JSON API of the full directory, documented at
  https://saschb2b.github.io/wc-finder/api/.

### Changed
- **Map-first layout.** The bottom panel is now a draggable sheet with three
  positions, so the map keeps most of the screen. Filters sit in a chip row
  directly above it, and the list opens inside the sheet instead of a separate
  screen.
- The first view frames your position and the nearest toilets at street level
  instead of a fixed city-wide zoom.
- Tapping a pin highlights it and updates the sheet; the map popup is gone.
  Tapping the map clears the selection.
- Each fact is shown once: the "24/7" and "wheelchair" chips were removed
  because the category and the hours line already say it. Care equipment uses
  the same chip style as other features.
- Zoom buttons are hidden on touch screens; pinch and double-tap still work.
- New app icon and refreshed landing page with current screenshots.
- Fresh directory data: more accessible toilets from OpenStreetMap and city
  open-data portals (Berlin, Hamburg, Rostock, Oldenburg, Münster).

### Fixed
- The onboarding screens now appear in the device language.
- The open list no longer repeats the summary card for the nearest toilet.
- Android now installs new versions as updates (the APK carries an increasing
  version code).

## [0.1.3] – 2026-09-06

### Fixed
- Android builds on the release pipeline again; no user-facing changes.

## [0.1.2] – 2026-09-06

### Added
- Specialist care toilets ("Toiletten für alle") with changing bench and hoist
  details, access notes, and separate filters for bed and hoist.
- Map without an API key, so the app works without any account or quota.

### Changed
- Refreshed Hannover toilets and updated dependencies.

### Fixed
- Selection and filter layout glitches on the map.
- Bottom panel and controls respect the Android navigation bar.

## [0.1.1] – 2026-04-07

### Added
- Detail card for the selected toilet and custom map callouts.
- Standardized opening hours with a clearer open/closed display.
- Landing page on GitHub Pages.

### Fixed
- Map now zooms to your location on startup.
- "Hier suchen" loads all tiles for the visible area.
- Several opening-hours parsing issues.

## [0.1.0] – 2026-04-07

### Added
- First release: nearby accessible toilets on a map and in a list, with
  Eurokey, wheelchair, favourites and "open now" filters, offline toilet data,
  one-tap navigation, and community reports via GitHub issues.

[Unreleased]: https://github.com/saschb2b/wc-finder/compare/v0.2.0...HEAD
[0.2.0]: https://github.com/saschb2b/wc-finder/compare/v0.1.3...v0.2.0
[0.1.3]: https://github.com/saschb2b/wc-finder/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/saschb2b/wc-finder/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/saschb2b/wc-finder/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/saschb2b/wc-finder/releases/tag/v0.1.0
