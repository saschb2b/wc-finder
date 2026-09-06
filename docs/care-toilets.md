# Specialist toilet data

`pnpm data:care` refreshes the [national Toiletten für alle directory](https://www.toiletten-fuer-alle.de/wo-wie.html),
the [Niedersachsen directory](https://toiletten-fuer-alle-niedersachsen.de/standorte/), and its public location map.
It writes `src/data/care-toilets.json`, overlays `toilets.json`, and regenerates offline tiles.
No API key is required. Downloads are cached under `.expo/care-toilets`; `pnpm data:care --cached`
replays those files. A refresh fails before publishing if a profile download, format, or regional identity check fails.

The September 2026 import reviewed 216 national profiles and 24 regional listings. It includes
219 fixed locations after combining both directories. Two mobile rental contacts are excluded;
their directory coordinates do not identify a permanently available public toilet.

## Equipment and access

Wheelchair accessibility does not imply a care bed or hoist. `care.bed` and `care.hoist` each
record `available`, `absent`, `unavailable`, or `unknown`. Filters require `available`.
Eurokey access is independently true, false, or unknown. Access notes retain requirements such
as collecting a key, supplying a sling, visiting an event, or entering a paid venue.
The app exposes source links and the directory-check date; this is not an on-site inspection date.

The national toilet coordinates take precedence over the regional venue markers. Regional
equipment and hours take precedence where present; omitted access/key details retain national
information. Complex, seasonal, incomplete, or event-dependent schedules remain unknown, with
the original hours note visible. Explicit temporary closures override opening hours.

The nine existing Hannover specialist IDs remain stable for favorites. In particular, the
Ernst-August-Galerie has a bed but no hoist, Landtag and VGH have 24-hour access, and the arena
and Messe require an appropriate event. The airport and Haus der Jugend Langenhagen are different venues.
Overlay matching uses stable source identities or an unambiguous identical venue name nearby;
proximity alone is insufficient to merge two specialist facilities.

## Festival toilets

`src/data/event-toilets.json` retains independently verified event facts. Map import requires
verified coordinates plus inclusive `from` and `through` dates. Dates use Europe/Berlin and
do not recur automatically the following year. Outside those dates, an event cannot appear in
normal browsing, “Jetzt geöffnet”, or the nearest recommendation. A saved event can still be
viewed under favorites/“Alle”, with its availability warning.

The Maschseefest 2026 care toilet is recorded for **22 July–9 August 2026**, on the Kinderwiese
next to the H96 parking area. A care bed and Eurokey access are confirmed; a hoist is not.
Its source map gives a schematic area location, so exact coordinates remain unverified and
no navigation pin is published. This is a mobile festival facility, not evidence of a permanent
public toilet outside the stadium. Add verified coordinates to the event record before a map
import; a later year's event requires newly confirmed dates and location.

Sources: [Niedersachsen event notice](https://toiletten-fuer-alle-niedersachsen.de/allgemein/das-maschseefest-bleibt-inklusiv-wieder-mit-einer-pflegetoilette/),
[organizer's 2026 map](https://www.maschseefest.de/wp-content/uploads/2026/07/MSF_Karte_2026-1.pdf).

Run `pnpm quality` for type checking, lint, availability/filter tests, directory importer tests,
and map interaction regressions. `pnpm data:care --cached` should add zero locations on a repeat run.
