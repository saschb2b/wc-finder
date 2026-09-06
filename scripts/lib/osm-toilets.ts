import assert from "node:assert/strict";
import type { Toilet } from "../../src/types/toilet";

export interface OsmElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

export function accessibleToiletQuery(bbox: string): string {
  return `[out:json][timeout:40];(
    nwr["amenity"="toilets"]["wheelchair"~"^(yes|designated)$"](${bbox});
    nwr["toilets:wheelchair"="yes"][!"route"]["type"!="route_master"](${bbox});
    nwr["amenity"="toilets"]["centralkey"="eurokey"](${bbox});
    nwr["amenity"="toilets"]["toilets:centralkey"="eurokey"](${bbox});
    nwr["amenity"="toilets"]["eurokey"="yes"](${bbox});
  );out center qt;`;
}

export function osmToilet(el: OsmElement, retrievedAt: string, updatedAt: string): Toilet | undefined {
  const t = el.tags || {};
  if (t.route || ["route", "route_master"].includes(t.type)) return;
  const dedicated = t.amenity === "toilets";
  if ([t.access, t["toilets:access"]].some(v => ["no", "private", "employees", "permit", "residents", "members"].includes(v))) return;
  if (t.toilets === "no" || t["toilets:wheelchair"] === "no" || (dedicated && t.wheelchair === "no")) return;
  if (Object.keys(t).some(k => /^(disused|abandoned|demolished|construction):/.test(k))
    || t.disused === "yes" || t.abandoned === "yes") return;
  // An accessible bathroom in a school, home, or guest room is not a public WC.
  if (!dedicated && (["school", "kindergarten", "childcare", "nursing_home", "prison"].includes(t.amenity)
    || ["hotel", "motel", "guest_house", "apartment"].includes(t.tourism)
    || (t.office && !["townhall", "library", "community_centre"].includes(t.amenity))
    || ["house", "apartments", "residential", "dormitory"].includes(t.building)
    || t.healthcare || ["hospital", "doctors", "dentist", "social_facility"].includes(t.amenity))) return;
  const wheelchair = t["toilets:wheelchair"] === "yes" || (dedicated && ["yes", "designated"].includes(t.wheelchair));
  const eurokey = t.eurokey === "yes" || t.centralkey === "eurokey" || t["toilets:centralkey"] === "eurokey";
  if (!wheelchair && !(dedicated && eurokey)) return;
  const coords = el.type === "node" ? { lat: el.lat!, lon: el.lon! } : el.center;
  assert(coords && Number.isFinite(coords.lat) && Number.isFinite(coords.lon) && Number.isSafeInteger(el.id), "Invalid OSM geometry");
  // A boundary-crossing building may intersect the query while its centre is outside coverage.
  if (coords.lat < 45 || coords.lat > 55.5 || coords.lon < 5.5 || coords.lon > 17.5) return;
  const hours = t["toilets:opening_hours"] || t.opening_hours;
  // Venue admission is not automatically a toilet fee.
  const fee = t["toilets:fee"] || (dedicated ? t.fee : undefined);
  const access = t["toilets:access"] || t.access;
  const notes = [access === "customers" ? "Nur für Gäste/Kunden; Zugang vor Ort klären." :
    access === "permissive" ? "Zugang mit Erlaubnis des Betreibers." : undefined,
  !dedicated ? "WC im Gebäude; Zugang und mögliche Eintrittskosten vor Ort klären." : undefined,
  t["toilets:description"], t["access:description"]].filter(Boolean);
  const category: Toilet["category"] = ["restaurant", "cafe", "fast_food", "bar", "pub", "food_court"].includes(t.amenity)
    ? "gastro" : t.amenity === "fuel" ? "tankstelle" : dedicated && hours === "24/7" && [undefined, "yes", "public"].includes(access)
      ? "public_24h" : "other";
  return {
    id: `osm_${el.type}_${el.id}`, ...coords,
    name: t.name || (dedicated ? "Barrierefreie Toilette" : t.operator ? `WC bei ${t.operator}` : "Barrierefreies WC im Gebäude"),
    city: t["addr:city"] || "", category,
    tags: [...(wheelchair ? ["barrierefrei"] : []), ...(eurokey ? ["eurokey"] : []), ...(fee === "no" ? ["kostenlos"] : [])],
    opening_hours: hours, operator: t.operator, fee,
    address: [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" ") || undefined,
    accessNote: notes.join(" ") || undefined,
    locationNote: el.type !== "node" ? "Position des Gebäudes/Areals; genauer WC-Eingang unbekannt." : undefined,
    sources: [{ id: `osm/${el.type}/${el.id}`, name: "OpenStreetMap", url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
      license: "ODbL-1.0", retrievedAt, updatedAt }],
  };
}
