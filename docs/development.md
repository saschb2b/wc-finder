# Development and maintenance

[Back to WC Finder](../README.md)

## Local development

Use Node.js 24 and the pnpm version pinned in [package.json](../package.json).
Keep `pnpm-lock.yaml` as the only dependency lockfile.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm start
```

Use an [Expo Go](https://expo.dev/go) version compatible with the SDK in
`package.json`, or an Android emulator. The map works in Expo Go without a Google
Maps API key or a custom native client. Rebuild native development clients after
an Expo SDK upgrade. If Metro has stale cached code, use `pnpm start --go --clear`.

```bash
pnpm quality       # Type checking, lint, app/data/map tests
pnpm web           # Web development server
pnpm build:web     # Production Pages site in dist/, browser app in dist/app/
```

GitHub Pages builds the Expo web export on pushes to `main`, retaining the
landing page at `/wc-finder/` and serving the app at `/wc-finder/app/`.
The workflow supplies the Pages base path, so exported asset URLs also work
with a custom domain. Locally, `PAGES_BASE_PATH` defaults to `/wc-finder`;
set it to an empty string to host `dist` at a server root.
`pnpm web` prepares ignored `public/data/tiles` files for local development.
The browser fetches only the regional JSON files needed for the map; native
builds continue to include the directory. Rebuild the web export after data changes.

Dependency versions follow the project's Expo SDK. When upgrading, use
`pnpm exec expo install --fix`, `pnpm dlx expo-doctor@latest`, and `pnpm audit`,
then review the changes and test on a phone. Check the existing Expo exclusions
in `package.json` and overrides in [pnpm-workspace.yaml](../pnpm-workspace.yaml).

## Map and bundled data

Leaflet runs in a WebView on Android/iOS and an iframe on web. Its JavaScript,
CSS, and icons are bundled, so initializing the map does not need a CDN.
Street-map images come from OpenStreetMap over HTTPS.

After changing Leaflet or the runtime:

```bash
pnpm build:map
pnpm test:map
```

Commit `src/map/leaflet-assets.generated.ts` with the source changes. The map
tests exercise the bundled code in a DOM simulator; verify gestures, tile loading,
and behaviour without a connection on a physical phone as well.

The tile source is in [leaflet-runtime.ts](../src/map/leaflet-runtime.ts).
Keep attribution, application identification, and normal HTTP caching intact.
OpenStreetMap's public service is best-effort and prohibits bulk downloads and
offline prefetching; use a provider that supports those features if you add them.
See the [tile usage policy](https://operations.osmfoundation.org/policies/tiles/).

Toilet records are separate from street-map images. The app loads local JSON
files through `src/data/tileLoader.ts`, grouped into 1° geographic cells.
Opening status is calculated locally from normalized schedules. Favourites and
the last location are stored with AsyncStorage.

## Refreshing data

Data changes reach users through a new app build. A refresh of the app's view
reloads bundled records; it does not call Overpass or the source directories.

| Task | Command |
| --- | --- |
| Refresh Hannover and rebuild tiles | `pnpm data:hannover` |
| Refresh specialist care directories and rebuild tiles | `pnpm data:care` |
| Replay cached care directory downloads | `pnpm data:care --cached` |
| Replay a saved Hannover Overpass response | `pnpm data:hannover --input path/to/response.json` |

The Hannover refresh preserves curated identities and data outside its bounding
box. It records the source timestamp and unmatched business IDs under
`regionalUpdates.hannover`. Specialist equipment, source matching, and temporary
events have separate rules in the [care data guide](care-toilets.md).

To run the same data steps as the weekly workflow:

```bash
pnpm exec tsx scripts/fetch-overpass-toilets.ts
pnpm exec tsx scripts/update-osm-data.ts
pnpm data:municipal
pnpm data:hannover
pnpm quality
```

Stop if any command fails. The OSM fetch requires complete responses from all four
regions, using request timeouts and a fallback server. The updater preserves
existing IDs and specialist care details, then the Hannover step rebuilds tiles.
Review source files, changes to locations, and generated tiles together.

The [Weekly Data Update workflow](../.github/workflows/update-data.yml) runs on
Sundays at 02:00 UTC and can be started manually. After validation it creates or
updates one PR on `data/weekly-update`; a maintainer reviews and merges it.
It refreshes OSM, Berlin, Hamburg, Rostock, Oldenburg, Münster and Hannover. Other sources, including specialist directories
and historical Google Places imports, are not refreshed by that schedule.

The repository must allow GitHub Actions to create pull requests under
**Settings → Actions → General → Workflow permissions**. The job requests
contents and pull-request write access; it does not approve or merge its own PR.
No Discord webhook or additional API key is required for the weekly workflow.

The [data import guide](data-imports.md) covers expanded venue coverage, source
licences, resumable OSM queries and the review/import route for partner directories.

Older source importers and `merge-sources.ts` remain available for broader data
maintenance. They are not the weekly update path. Some importers require their
own credentials, and a full merge can affect curated identities; review the
relevant script before running one.

## Building a signed Android installer

Open **Actions → Build & Release APK → Run workflow** and select the branch.
After success, download **wc-finder-apk** from the run's **Artifacts** section,
unzip it, and install `wc-finder.apk`. Manual branch builds produce an artifact
without publishing a release.

The [release workflow](../.github/workflows/release.yml) runs quality checks,
installs Java and Android SDK tools, and compiles with EAS local build on the
GitHub runner. It verifies the APK signature and package identity before upload.
The build step has a 45-minute timeout; the job allows 55 minutes for setup and
upload. Successful artifacts are retained for 30 days.

`EXPO_TOKEN` must have access to this Expo project's Android signing credentials.
The preview profile uses remote credentials and CI freezes them to prevent
accidental replacement. Keep the existing signing key so users can update their
installed app. The build archive uses [.easignore](../.easignore) to exclude raw
pipeline files while retaining runtime toilet tiles.

For a local build, install Java and the Android SDK/NDK versions specified in the
workflow, authenticate with Expo, and run:

```bash
pnpm dlx eas-cli@23.2.0 build --platform android --profile preview --local --output ./wc-finder.apk
```

EAS local builds support [Linux and macOS](https://docs.expo.dev/build-reference/local-builds/).
Use the GitHub runner from Windows. For initial signing setup, use
`pnpm dlx eas-cli@23.2.0 credentials --platform android`.
The `production` profile in [eas.json](../eas.json) produces an app bundle for
Google Play, rather than a directly installable APK.

## Publishing a release

Choose an unused `v` tag for the commit you want to release, then push that tag.
The tag-triggered workflow builds and verifies the installer and publishes the
GitHub release with `wc-finder.apk` attached. Check the run's result and the
release asset before announcing it. A tag or an empty release page does not mean
an installer has been built successfully.

When retrying a failed workflow, remember that reruns use the original commit.
To test a workflow fix, push it and start a manual build from the updated branch.
