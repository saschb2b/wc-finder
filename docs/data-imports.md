# Expanding and refreshing the directory

## Initial expansion, 6 September 2026

The bundle grew from 40,152 to 87,921 records: 47,335 OSM additions plus 434
municipal additions. The complete OSM source snapshot contains 50,253 eligible
records across the existing DACH bounding box and adjacent territory. These are
not Germany-only totals or independently verified unique public facilities.
All original IDs and 219 specialist care records were preserved. A repeat merge
of the same OSM snapshot changes zero records. The 5,460 additions within 50 metres
of an older pin are review candidates, not automatic duplicates.

After expansion, the Nette review still finds 585 barrier-free candidates with no
app record within 100 metres; these remain outside the bundle pending reuse and
freshness checks. Full quality checks and an Android Hermes export passed; the
exported bundle is approximately 24 MB. An APK was not built by this data refresh.

Follow-up reconciliation consolidated 394 unreleased duplicates using verified
legacy OSM identities and close city-suffix name matches. Münster's open feed
then added 12 records and enriched one matching venue. The current total is
87,539, with 47,387 additions relative to Git HEAD and 5,073 nearby review
candidates. Published IDs and specialist care records remain unchanged.
Four conflicting secondary OSM source references were detached without merging
their separate locations. The source matcher now rejects these ownership conflicts.

## Imports that run without credentials

```sh
pnpm exec tsx scripts/fetch-overpass-toilets.ts
pnpm exec tsx scripts/update-osm-data.ts
pnpm data:municipal
pnpm data:hannover
pnpm data:review
pnpm quality
```

Run sequentially and stop on errors. OSM queries cover the existing DACH bounding
box, including some neighbouring territory; totals are not Germany-only. They now
include nodes, ways, relations and explicit accessible WCs on venues. Restricted
workplaces, schools, guest accommodation and private facilities are excluded.
Eurokey-only toilets retain the key flag without assuming confirmed wheelchair
accessibility. Opening times with unsupported exceptions remain descriptive text.

Slow OSM requests are subdivided. Successful regional responses are cached under
`.expo/data-cache/osm` for one hour so an interrupted fetch can resume. The source
snapshot is replaced only after all four bands complete. The weekly workflow
runs OSM, municipal and Hannover refreshes and validates before proposing a PR.
The fetch prefers the last working server during a run and pauses after rate-limit
responses. Public services can still be unavailable; never merge an incomplete
snapshot. See the [OSM service list](https://wiki.openstreetmap.org/wiki/Overpass_API#Public_Overpass_API_instances).

Municipal imports require an explicit affirmative WC accessibility field. They
reject truncated feeds, duplicate identities and unexpected coordinates. A changed
schema that produces no eligible entries fails rather than silently removing data.

| Dataset and attribution | Licence | Accessibility field |
| --- | --- | --- |
| [Land Berlin: Öffentliche Toiletten](https://daten.berlin.de/datensaetze/offentliche-toiletten-wfs-ad2c0c24) | [dl-de-zero-2.0](https://www.govdata.de/dl-de/zero-2-0) | `barrierefrei=ja`; `barrierearm` alone is insufficient |
| [Freie und Hansestadt Hamburg: WC-Anlagen mit Trinkbrunnen](https://api.hamburg.de/datasets/v1/wc_mit_trinkbrunnen/collections/wc_mit_trinkbrunnen?f=json) | [dl-de-by-2.0](https://www.govdata.de/dl-de/by-2-0) | `behindertengerecht=ja` |
| [Hanse- und Universitätsstadt Rostock: Toiletten](https://www.opendata-hro.de/dataset/toiletten) | [CC0-1.0](https://creativecommons.org/publicdomain/zero/1.0/) | `behindertengerecht=true` |
| [Stadt Oldenburg (Oldb): Öffentliche Toiletten](https://opendata.oldenburg.de/dataset/%C3%B6ffentliche-toiletten) | [dl-de-by-2.0](https://www.govdata.de/dl-de/by-2-0) | `barrierefrei=ja` |
| [Stadt Münster: Öffentliche Toiletten](https://opendata.stadt-muenster.de/dataset/%C3%B6ffentliche-toiletten) | [dl-de-by-2.0](https://www.govdata.de/dl-de/by-2-0) | `BARRIEREFREI=J`; blank weekdays remain unspecified |

These feeds are filtered and converted to the app schema. Names, source references
and attribution travel with the locations. Oldenburg's sequential row IDs are
replaced with a name/address-derived identity to survive row reordering.

Existing IDs and specialist care entries are preserved. Source identities link
subsequent updates to the original favourite ID. New records are reconciled only
when name, available address and proximity agree; an unrelated pin within 50 m
does not suppress a new location. Different labels for the same facility can
still produce duplicates and require review. Absence from an accessibility query
alone does not establish closure.

`pnpm data:review` compares against Git HEAD, verifies existing IDs and care data,
and writes `docs/data-import-results.json`. Possible nearby duplicates are saved
separately to `.expo/partner-imports/nearby-import-review.json` for manual review.
Generated tile loaders use only the current tile index, excluding stale tile files.

`pnpm exec tsx scripts/reconcile-imports.ts` previews consolidation of **unreleased**
additions against the IDs in Git HEAD; add `--apply` to apply it and rebuild tiles.
The preview is saved to `.expo/partner-imports/reconciliation.json`. Do not use this
as a migration for already published duplicate IDs: that requires favourite-ID
redirects. No published ID is removed by this command.

Legacy `station`/`sanifair`/typed `hbiz` IDs retain their OSM type. The original
`fuel`, `biz`, numeric `hbiz`, `osm_fuel` and `osm_mall` importers queried nodes only,
so those prefixes can be reconciled without spatial guessing. Numeric `mall` IDs
mixed ways and nodes and are deliberately left unresolved. City-suffix matches
require a separation of at most 15 metres and no conflicting addresses.
Generated names such as "Barrierefreie Toilette" are not identity evidence and
do not qualify for automatic name-based consolidation. A repeat reconciliation
preview and a repeat OSM import both leave the final snapshot unchanged.

## Die nette Toilette: review available, redistribution pending

```sh
pnpm data:nette:review
```

This reads the operator's public web-app feed and compares its `z=1` barrier-free
subset with the current bundle. Output is ignored at
`.expo/partner-imports/nette-review.json`. It does not modify app data. The feed
includes countries outside Germany and possibly obsolete entries; country and
current participation must be verified before import. Raw opening times use a
provider-specific format and must be normalized or retained as notes.

No open redistribution licence was established. Request a current licensed export
before transferring these records to the public app. The local review file is not
a normalized, approved partner export.

## Licensed partner exports

```sh
pnpm data:partner .expo/partner-imports/approved-export.json
```

The importer accepts the contract in
[`PartnerExport`](../scripts/lib/partner-import.ts), not undocumented provider API
responses. It validates source identity, licence, a permission reference, retrieval
date, country, coordinates, WC-specific accessibility and public/customer access.
Private and unknown-access records are excluded. Bed, hoist and Eurokey are
independent optional booleans; missing equipment is not inferred.

Example structure (illustrative; replace with actual data and reuse evidence):

```json
{
  "source": {
    "id": "provider-name",
    "name": "Provider name",
    "url": "https://provider.example/directory",
    "license": "Licence supplied by the provider",
    "permissionReference": "Provider export agreement reference",
    "retrievedAt": "2026-09-06T12:00:00Z"
  },
  "toilets": [{
    "id": "stable-provider-id",
    "name": "Public WC",
    "lat": 52.5,
    "lon": 13.4,
    "country": "DE",
    "wheelchairToilet": true,
    "access": "public"
  }]
}
```

The permission reference documents the maintainer's reuse evidence; writing a
licence string does not itself grant permission. Keep credentials out of exports.

## Freshness dates

The app shows one "last checked" date per entry, chosen in this order:

1. `verifiedAt` (calendar date) — a visitor confirmed the entry via the **Stimmt so**
   report; moderators set it from the `verified` issue and it survives OSM refreshes.
2. `care.checkedAt` — the specialist directory check.
3. `sources[].editedAt` — the OSM element's own last edit (`out meta`), filled on
   the next `fetch-overpass-toilets.ts` run.
4. `sources[].updatedAt` / `retrievedAt` — database snapshot or download time. This is
   labelled "Datenstand", never as a check.

Entries without any of these show "Prüfdatum unbekannt".

| Provider | Remaining external requirement |
| --- | --- |
| [Die nette Toilette](https://die-nette-toilette.de/) | Current export, reuse permission, country and freshness metadata |
| [accessibility.cloud](https://github.com/sozialhelden/accessibility-cloud/blob/main/app/docs/json-api.md) | Organization/app registration, API token and an approved export route; inspect each partner source's licence and WC fields. OSM coverage is already handled directly. |
| [Reisen für Alle](https://reisen-fuer-alle.de/barrierefreie-angebote/) / [DZT](https://open-data-germany.org/service-portal/) | Approved data package and API access; first confirm WC-specific survey fields are included. Overall venue certification is insufficient. |
| [CBF Darmstadt, Der Locus](https://shop.cbf-da.de/product_info.php?products_id=72) | Current digital export and redistribution agreement; the advertised book is the 2022 edition. |
| [SANIFAIR](https://www.sanifair.de/db/) / [HERING rail & fresh](https://www.wc-fresh.com/) | Licensed operator export with coordinates and installation-specific access rules; public station lists alone do not provide a validated import feed. Operator locations represented in OSM enter through the expanded query. |
| [abilityX / HandicapX](https://handicapx.de/abilityx-barrierefreie-toiletten/) | Partner export and redistribution terms; no public bulk API was established. |

No provider has been contacted, account created or partner token configured by this
change. Request drafts are in [partner-data-requests.md](partner-data-requests.md).
