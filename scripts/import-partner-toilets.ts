import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parsePartnerExport } from "./lib/partner-import";
import { mergeImported } from "./lib/merge-osm";

async function main() {
  assert(process.argv[2], "Usage: pnpm data:partner <licensed-normalized-export.json>");
  const input = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const toilets = parsePartnerExport(input);
  assert(toilets.length > 0, "No eligible partner toilets; app data unchanged");
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const file = path.join(root, "src/data/toilets.json");
  const dataset = JSON.parse(fs.readFileSync(file, "utf8"));
  const before = dataset.toilets.length;
  dataset.toilets = mergeImported(dataset.toilets, toilets);
  dataset.count = dataset.toilets.length;
  dataset.partnerUpdates = { ...dataset.partnerUpdates, [input.source.id]: { ...input.source, count: toilets.length } };
  fs.writeFileSync(file + ".tmp", JSON.stringify(dataset, null, 2));
  fs.renameSync(file + ".tmp", file);
  console.log(`Partner import: ${toilets.length} eligible; ${dataset.count - before} added`);
  await import("./split-tiles");
  await import("./gen-tile-loader");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
