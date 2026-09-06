# Accessible toilet data: expansion opportunities

Research date: 6 September 2026. Baseline: `0694d2f`, with 40,152 bundled rows
(40,151 distinct IDs) and 219 specialist care records. No new locations were
added during this audit.

This is the original research snapshot. Subsequent implementation and source
access requirements are documented in [data-imports.md](data-imports.md), with
measured bundle changes in [data-import-results.json](data-import-results.json).

The biggest opportunity is to import **explicit toilet accessibility inside
public venues**, then add independent municipal and network data. Expanding a
generic business search would also expand the existing uncertainty: 8,002 of our
Google-derived records carry an entrance-accessibility label, while 10,223 carry
an explicit accessible-restroom label.

## Priority 1: broaden the OpenStreetMap import

Our [national importer](../scripts/fetch-overpass-toilets.ts) fetches only nodes
with `amenity=toilets` and either `wheelchair=yes` or `toilets:wheelchair=yes`.
It excludes ways and relations, and accessible toilets recorded on a library,
museum, restaurant, town hall, or other venue. The Hannover updater handles more
of these cases, but only in its local bounding box.

Geofabrik's **Germany-only** Taginfo database, with data through
**5 September 2026, 20:22 UTC**, reports:

| Objects tagged `toilets:wheelchair=yes` | Count |
| --- | ---: |
| All object types | 32,073 |
| Nodes | 18,218 |
| Ways | 13,364 |
| Relations | 491 |
| Also tagged `amenity=toilets` | 2,172 |

Thus 29,901 objects in this tag set do not have `amenity=toilets`, and 13,855 are
not nodes. These groups overlap; **do not add the counts together**. They measure
what the national query cannot retrieve, not how many locations are absent from
every source in our merged app data.

Particularly useful venue categories with this explicit WC tag:

| Category | German OSM objects |
| --- | ---: |
| Museums | 895 |
| Community centres | 856 |
| Town halls | 647 |
| Libraries | 480 |
| Theatres | 479 |
| Arts centres | 223 |
| Restaurants | 5,475 |
| Cafés | 1,708 |

These are candidates, not guaranteed unrestricted public toilets. Schools,
private workplaces, hotel rooms, and similar restricted facilities must not
become public destinations merely because a WC exists.

**Implementation:** query nodes, ways, and relations for dedicated accessible
toilets and `toilets:wheelchair=yes` on venues. Preserve OSM type/ID, explicit
access restrictions, toilet-specific hours and fees, and the difference between
a venue centroid and a toilet entrance. Include Eurokey-tagged toilets in a
review pass; a generic key tag can also describe non-toilet facilities.

Use bounded regional queries or a Geofabrik extract for larger refreshes. A
country-wide Overpass query timed out on both public servers during this audit;
there is no measured nationwide net-add count yet.

Sources: [Germany tag statistics](https://taginfo.geofabrik.de/europe:germany/api/4/tag/stats?key=toilets%3Awheelchair&value=yes),
[amenity combinations](https://taginfo.geofabrik.de/europe:germany/api/4/tag/combinations?key=toilets%3Awheelchair&value=yes&filter=all&query=amenity&rp=100&page=1),
[tourism combinations](https://taginfo.geofabrik.de/europe:germany/api/4/tag/combinations?key=toilets%3Awheelchair&value=yes&filter=all&query=tourism&rp=100&page=1),
[tag meaning](https://wiki.openstreetmap.org/wiki/Key:toilets:wheelchair),
[Germany extracts](https://download.geofabrik.de/europe/germany.html).

## Priority 2: Die nette Toilette

This network adds something business directories often lack: an agreement that
people may use the toilet without buying anything. Accessibility is recorded
separately, so only the barrier-free subset belongs in an accessibility import.

The public web-app feed retrieved on 6 September contained **4,029 entries** and
338 town records. Its `z=1` flag is displayed by the web app as barrier-free:
**1,449 entries across 252 towns**, including locations outside Germany.

Comparison with all current app locations, using geographic distance:

| No existing location within… | Barrier-free candidates |
| --- | ---: |
| 50 metres | 1,207 |
| 100 metres | 1,043 |
| 250 metres | 821 |

Examples beyond 250 metres include Aichach's Rathaus, Asperg's Stadtverwaltung,
and Aalen's SSV Vereinsgaststätte. Proximity is only a screening tool: nearby
different venues may both belong in the app, while displaced coordinates can
hide a duplicate. The feed also contains a location named “Ehemalige öffentl.
Toilette”; retrieving a record today does not establish that it is current.

**Next step:** confirm the operator's export/reuse terms and feed freshness,
then import the accessible subset with network IDs, hours, and access notes.
No explicit open-data licence was found in the reviewed pages.

Sources: [network](https://die-nette-toilette.de/),
[public web app](https://app.die-nette-toilette.de/webapp/),
[location feed](https://app.die-nette-toilette.de/deploy/?action=loat),
[town feed](https://app.die-nette-toilette.de/deploy/?action=loac).

## Priority 3: municipal open-data feeds

GovData provides a discovery route across cities, rather than a single uniform
toilet database. Start with sources that supply coordinates, explicit wheelchair
access, operating hours, and a documented reuse licence.

Two concrete examples:

- **Berlin:** the official public-toilet dataset offers a WFS download service;
  GovData lists Datenlizenz Deutschland Zero 2.0. Its description includes modern
  accessible modular toilets, but the full dataset also covers other types.
- **Oldenburg:** a GeoJSON/CSV dataset combines public toilets with the
  “Öffentliches Örtchen” participating-business network. Its catalogue entry was
  updated on 9 June 2026. Inspect individual accessibility fields before import.

Build small adapters for recurring formats such as GeoJSON, CSV, and WFS. Keep
municipal source IDs and licence information. This can scale across Germany,
but field names and accessibility classifications differ between publishers.

Sources: [Berlin dataset and licence](https://www.govdata.de/suche/daten/offentliche-toiletten-3?ids=926f7f7a-4508-490a-b2cf-20a877c4ec14),
[GovData WC catalogue, including Oldenburg](https://www.govdata.de/suche?tags=wc&type=dataset),
[Berlin's toilet programme](https://www.berlin.de/sen/uvk/mobilitaet-und-verkehr/infrastruktur/oeffentliche-toiletten/).

## Other nationwide sources worth pursuing

| Source | What it adds | Access and limitations |
| --- | --- | --- |
| **Wheelmap / accessibility.cloud** | Toilet-specific accessibility assessments and independent partner directories. | Wheelmap's OSM records overlap priority 1. Partner data has different licences. The API requires registration and an app token; request source/licence metadata and use its documented export approach. |
| **Reisen für Alle / tourism open data** | Surveyed venue details, potentially including WC dimensions, access routes, and equipment. Museums, visitor centres, leisure venues, and tourist facilities are useful targets. | Read the WC assessment, not just the venue's overall certification. Public website access does not establish export rights. DZT's service portal offers JSON data packages after registration and subscription approval, with API-key access; confirm which packages expose the required toilet fields. |
| **CBF Darmstadt: Der Locus** | A specialist directory advertised as containing over 12,000 accessible toilet locations across Germany, Austria, and Switzerland. | The listed edition is 2022 and sold as a book. This is a potential data partnership, not a verified current open feed or 12,000 new German toilets. Ask about a current licensed digital export. |
| **SANIFAIR and HERING / rail & fresh** | Operator location lists and access rules for a nationwide network of station, shopping-centre, and motorway toilets. | Our station/SANIFAIR importer uses OSM, not these operator lists. Compare operator locations against existing records. Preserve opening times, staff assistance, and venue-specific access; avoid assuming every installation is open 24/7. |
| **abilityX / HandicapX** | An independent specialist accessible-WC directory with equipment and key information. | Potential partnership or cross-check source. No documented public bulk-reuse route was established in this audit. |

Sources: [Wheelmap data provenance](https://news.wheelmap.org/FAQ/),
[accessibility.cloud API](https://github.com/sozialhelden/accessibility-cloud/blob/main/app/docs/json-api.md),
[Reisen für Alle](https://reisen-fuer-alle.de/barrierefreie-angebote/),
[DZT access model](https://open-data-germany.org/service-portal/),
[Der Locus product information](https://shop.cbf-da.de/product_info.php?products_id=72),
[SANIFAIR station list](https://www.sanifair.de/db/),
[SANIFAIR accessibility FAQ](https://www.sanifair.de/faq/),
[rail & fresh](https://www.wc-fresh.com/),
[abilityX](https://handicapx.de/abilityx-barrierefreie-toiletten/).

## Recommended implementation order

1. Expand OSM coverage and generate a review report of additions, overlap, and
   restricted-access exclusions. Keep existing favourites and care records.
2. Add reusable municipal adapters, starting with a documented open feed.
3. Pursue Die nette Toilette's reuse route; it has the clearest measured
   opportunity for hundreds of additional barrier-free locations.
4. Add independent partner feeds through accessibility.cloud or direct
   agreements, prioritizing toilet-specific evidence over venue accessibility.

For every source, retain the original identity, provenance, update date where
provided, access conditions, and independent bed/hoist/Eurokey fields. Missing
hours remain unknown. Reconcile names, addresses, geometry, and source IDs;
distance alone must not overwrite a different venue's details.

The existing national and Niedersachsen Toiletten für alle imports already
cover our 219 specialist care records. Re-importing those directories is useful
for freshness, but does not constitute a newly discovered nationwide source.
