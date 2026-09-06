import { test } from "node:test";
import assert from "node:assert/strict";
import type { Toilet } from "../../src/types/toilet";
import { mergeOsm } from "./merge-osm";

const entry = (id: string, changes: Partial<Toilet> = {}): Toilet => ({
  id, name: "Toilet", lat: 51, lon: 10, category: "other", tags: ["barrierefrei"], ...changes,
});

test("updates known nodes and normalized hours while keeping favorites and missing records", () => {
  const original = [entry("osm_node_1", { opening_hours: "24/7", operator: "Old operator" }), entry("osm_2")];
  const result = mergeOsm(original, [entry("osm_1", { name: "Updated", opening_hours: "Mo-Fr 09:00-17:00" })]);
  assert.deepEqual(result.map(t => t.id), ["osm_node_1", "osm_2"]);
  assert.equal(result[0].name, "Updated");
  assert.equal(result[0].hours?.type, "weekly");
  assert.equal(result[0].operator, undefined);
  assert.deepEqual(result[1], original[1]);
  assert.equal(original[0].name, "Toilet");
});

test("preserves specialist care and curated nearby venues, adds distinct locations once", () => {
  const care = entry("osm_1", { care: { bed: "available", hoist: "available", eurokey: true,
    sourceId: "care-1", sourceUrls: ["https://example.org"], checkedAt: "2026-09-06" } });
  const curated = entry("curated_2", { lat: 52, availability: { from: "2026-08-01", through: "2026-08-31" } });
  const original = [care, curated];
  const fresh = [entry("osm_1", { name: "Generic OSM name" }), entry("osm_3", { lat: 52.0001 }),
    entry("osm_4", { lat: 53, opening_hours: "24/7" })];
  const result = mergeOsm(original, fresh);
  assert.deepEqual(result.slice(0, 2), original);
  assert.deepEqual(result.map(t => t.id), ["osm_1", "curated_2", "osm_4"]);
  assert.equal(result[2].hours?.type, "24_7");
  assert.deepEqual(mergeOsm(result, fresh), result);
});

test("rejects empty, invalid and duplicate input without changing original data", () => {
  const original = [entry("osm_1")];
  for (const fresh of [[], [entry("osm_2", { lat: NaN })], [entry("osm_2"), entry("osm_2")]]) {
    assert.throws(() => mergeOsm(original, fresh));
    assert.deepEqual(original, [entry("osm_1")]);
  }
});

test("node, way and relation numeric IDs are distinct; legacy node aliases are stable", () => {
  const result = mergeOsm([entry("osm_1")], [entry("osm_node_1"), entry("osm_way_1", { name: "Library" }),
    entry("osm_relation_1", { name: "Museum" })]);
  assert.deepEqual(result.map(t => t.id), ["osm_1", "osm_way_1", "osm_relation_1"]);
  assert.throws(() => mergeOsm([], [entry("osm_1"), entry("osm_node_1")]), /Duplicate/);
});
