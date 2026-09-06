import assert from "node:assert/strict";

/** Public-feed schema observed in the operator's web app. Review only. */
export function parseNette(locations: unknown, towns: unknown) {
  assert(Array.isArray(locations) && locations.length > 0 && Array.isArray(towns) && towns.length > 0, "Invalid Nette feed");
  const cities = new Map(towns.map(t => [String(t.oid), String(t.n)]));
  const ids = new Set<string>();
  const rows = locations.flatMap(t => {
    assert(t && typeof t === "object" && t.i != null && typeof t.b === "string", "Invalid Nette entry");
    if (t.z !== "1") return [];
    const id = String(t.i);
    assert(!ids.has(id), `Duplicate Nette identity: ${id}`);
    ids.add(id);
    const lat = Number(t.lat), lon = Number(t.lng);
    assert(Number.isFinite(lat) && Number.isFinite(lon) && lat > 45 && lat < 56 && lon > 5 && lon < 18, `Invalid Nette coordinates: ${id}`);
    assert(cities.has(String(t.oid)), `Missing Nette town: ${t.oid}`);
    return [{ sourceId: id, name: t.b as string, address: String(t.s || ""), city: cities.get(String(t.oid))!, lat, lon,
      rawHours: String(t.o || ""), wheelchair: true,
      needsStatusReview: /ehemalig|geschlossen|außer Betrieb/i.test(t.b),
      country: "unverified", access: "Network WC access without purchase; hours and current participation need verification." }];
  });
  assert(rows.length > 0, "No accessible Nette entries; inspect feed schema");
  return rows;
}
