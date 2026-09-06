/** Compare the working bundle with HEAD; proximity candidates are review-only. */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import type { Toilet } from "../src/types/toilet";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseline: Toilet[] = JSON.parse(execFileSync("git", ["show", "HEAD:src/data/toilets.json"], {
  cwd: root, encoding: "utf8", maxBuffer: 200 * 1024 * 1024,
})).toilets;
const current: Toilet[] = JSON.parse(fs.readFileSync(path.join(root, "src/data/toilets.json"), "utf8")).toilets;
const ids = new Set(baseline.map(t => t.id));
const currentIds = new Set(current.map(t => t.id));
assert(baseline.every(t => currentIds.has(t.id)), "An existing favourite identity was removed");
assert(current.length - currentIds.size <= baseline.length - ids.size, "New duplicate IDs introduced");
assert.deepEqual(current.filter(t => ids.has(t.id) && t.care), baseline.filter(t => t.care), "Existing care data changed");
const added = current.filter(t => !ids.has(t.id));
const grid = new Map<string, Toilet[]>();
const cell = (n: number) => Math.floor(n * 1000);
for (const t of baseline) {
  const key = `${cell(t.lat)}_${cell(t.lon)}`;
  grid.set(key, [...(grid.get(key) || []), t]);
}
const nearby: { added: string; existing: string; metres: number; addedName: string; existingName: string }[] = [];
for (const t of added) {
  assert(t.sources?.length && Number.isFinite(t.lat) && Number.isFinite(t.lon), `Missing provenance/coordinates: ${t.id}`);
  for (let y = -1; y <= 1; y++) for (let x = -1; x <= 1; x++) {
    for (const other of grid.get(`${cell(t.lat) + y}_${cell(t.lon) + x}`) || []) {
      const metres = Math.hypot((t.lat - other.lat) * 111195, (t.lon - other.lon) * 111195 * Math.cos(t.lat * Math.PI / 180));
      if (metres < 50) nearby.push({ added: t.id, existing: other.id, metres: Math.round(metres), addedName: t.name, existingName: other.name });
    }
  }
}
const sourceCounts: Record<string, number> = {};
for (const t of added) {
  const source = t.sources![0].name;
  sourceCounts[source] = (sourceCounts[source] || 0) + 1;
}
const summary = { baseline: baseline.length, current: current.length, added: added.length, removedIds: 0,
  preservedCareRecords: baseline.filter(t => t.care).length, addedBySource: sourceCounts,
  additionsWithin50mOfExisting: new Set(nearby.map(t => t.added)).size,
  note: "Nearby candidates can be separate venues or duplicates. No automatic identity match was inferred from distance alone." };
const reviewDir = path.join(root, ".expo/partner-imports");
fs.mkdirSync(reviewDir, { recursive: true });
fs.writeFileSync(path.join(reviewDir, "nearby-import-review.json"), JSON.stringify(nearby, null, 2));
fs.writeFileSync(path.join(root, "docs/data-import-results.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(JSON.stringify(summary, null, 2));
