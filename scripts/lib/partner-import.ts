import assert from "node:assert/strict";
import type { Toilet } from "../../src/types/toilet";
import { importHours } from "./import-hours";

export interface PartnerExport {
  source: { id: string; name: string; url: string; license: string; permissionReference: string; retrievedAt: string };
  toilets: {
    id: string; name: string; lat: number; lon: number; country: "DE" | "AT" | "CH";
    wheelchairToilet: boolean; access: "public" | "customers" | "permissive" | "private" | "unknown";
    city?: string; address?: string; openingHours?: string; accessNote?: string;
    eurokey?: boolean; fee?: string; bed?: boolean; hoist?: boolean;
  }[];
}

/** Boundary for licensed, normalized exports; never assumes partner schemas. */
export function parsePartnerExport(value: unknown): Toilet[] {
  const data = value as PartnerExport;
  const s = data?.source;
  assert(s && typeof s.id === "string" && /^[a-z][a-z0-9-]+$/.test(s.id)
    && typeof s.name === "string" && s.name.trim() && typeof s.url === "string", "Invalid partner source");
  const url = new URL(s.url);
  assert(url.protocol === "https:" && !url.username && !url.password, "Source URL must be HTTPS without credentials");
  assert(typeof s.license === "string" && s.license.trim() && !/^(unknown|pending|none)$/i.test(s.license), "Document the export's reuse licence");
  assert(typeof s.permissionReference === "string" && s.permissionReference.trim(), "Document permission to redistribute the dataset in the app");
  assert(typeof s.retrievedAt === "string" && Number.isFinite(Date.parse(s.retrievedAt)), "Missing retrieval date");
  assert(Array.isArray(data.toilets) && data.toilets.length > 0, "Empty partner export");
  const ids = new Set<string>();
  return data.toilets.flatMap(t => {
    assert(t && typeof t.id === "string" && t.id.trim() && typeof t.name === "string" && t.name.trim() && !ids.has(t.id), "Missing/duplicate partner identity");
    ids.add(t.id);
    assert(["DE", "AT", "CH"].includes(t.country), "Country must be verified as DE, AT or CH");
    assert(typeof t.wheelchairToilet === "boolean" && ["public", "customers", "permissive", "private", "unknown"].includes(t.access), "Explicit WC accessibility and access are required");
    assert(Number.isFinite(t.lat) && Number.isFinite(t.lon) && t.lat >= 45 && t.lat <= 55.5 && t.lon >= 5.5 && t.lon <= 17.5, "Invalid partner coordinates");
    for (const flag of [t.eurokey, t.bed, t.hoist]) assert(flag === undefined || typeof flag === "boolean", "Equipment flags must be boolean");
    for (const value of [t.city, t.address, t.openingHours, t.accessNote, t.fee]) assert(value === undefined || typeof value === "string", "Partner notes must be text");
    if (!t.wheelchairToilet || ["private", "unknown"].includes(t.access)) return [];
    const hours = importHours(t.openingHours);
    const accessNote = [t.access === "customers" ? "Nur für Gäste/Kunden." : t.access === "permissive" ? "Zugang mit Erlaubnis des Betreibers." : undefined, t.accessNote].filter(Boolean).join(" ") || undefined;
    const id = `partner_${s.id}_${t.id}`;
    return [{ id, lat: t.lat, lon: t.lon, name: t.name, city: t.city, address: t.address,
      category: hours.type === "24_7" && t.access === "public" ? "public_24h" : "other", hours, opening_hours: t.openingHours, fee: t.fee,
      tags: ["barrierefrei", ...(t.eurokey ? ["eurokey"] : []), ...(t.fee === "no" ? ["kostenlos"] : []), ...(t.bed ? ["pflegeliege"] : [])],
      accessNote, sources: [{ id: `${s.id}/${t.id}`, name: s.name, url: s.url, license: s.license, retrievedAt: s.retrievedAt }],
      ...(t.bed || t.hoist ? { care: { bed: t.bed === undefined ? "unknown" : t.bed ? "available" : "absent",
        hoist: t.hoist === undefined ? "unknown" : t.hoist ? "available" : "absent", eurokey: t.eurokey ?? null,
        access: accessNote, hoursNote: t.openingHours, sourceId: id, sourceUrls: [s.url], checkedAt: s.retrievedAt.slice(0, 10) } } : {}),
    } satisfies Toilet];
  });
}
