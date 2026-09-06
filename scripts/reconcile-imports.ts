/** Consolidate unreleased additions while retaining every identity from Git HEAD. */
import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import type { Toilet } from "../src/types/toilet";
import { mergeImported } from "./lib/merge-osm";

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const baseline: Toilet[] = JSON.parse(execFileSync("git", ["show", "HEAD:src/data/toilets.json"], {
    cwd: root, encoding: "utf8", maxBuffer: 200 * 1024 * 1024,
  })).toilets;
  const ids = new Set(baseline.map(t => t.id));
  const file = path.join(root, "src/data/toilets.json");
  const dataset = JSON.parse(fs.readFileSync(file, "utf8"));
  const before: Toilet[] = dataset.toilets;
  const published = before.filter(t => ids.has(t.id));
  const additions = before.filter(t => !ids.has(t.id));
  assert(published.length === baseline.length, "Published identities missing; inspect manually");
  assert(additions.every(t => t.sources?.length), "Only additions with source provenance can be reconciled");
  const after = additions.length ? mergeImported(published, additions) : before;
  assert.deepEqual(after.filter(t => t.care && ids.has(t.id)), published.filter(t => t.care), "Published care data changed");
  const kept = new Set(after.map(t => t.id));
  const removed = before.filter(t => !kept.has(t.id));
  const previous = new Map(before.map(t => [t.id, t]));
  const summary = { before: before.length, after: after.length, consolidatedUnreleasedRecords: removed.length,
    correctedSourceReferences: after.filter(t => JSON.stringify(t.sources) !== JSON.stringify(previous.get(t.id)?.sources)).length,
    preservedPublishedIds: ids.size, removed: removed.map(t => ({ id: t.id, name: t.name })) };
  const output = path.join(root, ".expo/partner-imports/reconciliation.json");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.writeFileSync(output, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, removed: summary.removed.slice(0, 15) }, null, 2));
  if (!process.argv.includes("--apply")) { console.log("Preview only. Use --apply to consolidate unreleased additions."); return; }
  dataset.toilets = after;
  dataset.count = after.length;
  fs.writeFileSync(file + ".tmp", JSON.stringify(dataset, null, 2));
  fs.renameSync(file + ".tmp", file);
  await import("./split-tiles");
  await import("./gen-tile-loader");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
