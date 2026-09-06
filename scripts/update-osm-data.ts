/** Apply a completed national fetch, preserving curated and specialist data. */
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { mergeOsm } from "./lib/merge-osm";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data");
const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), "utf8"));
const source = read("osm-toilets.json");
const dataset = read("toilets.json");
assert(source.count === source.toilets?.length, "OSM source count mismatch");
assert(source.sourceTimestamps && Object.keys(source.sourceTimestamps).length === 4
  && Object.values(source.sourceTimestamps).every(stamp => typeof stamp === "string" && Number.isFinite(Date.parse(stamp))),
"A complete four-band OSM fetch is required");
const before = dataset.count;
dataset.toilets = mergeOsm(dataset.toilets, source.toilets);
dataset.count = dataset.toilets.length;
dataset.osmUpdate = { source: source.source, sourceTimestamps: source.sourceTimestamps, count: source.count };
fs.writeFileSync(path.join(dir, "toilets.json"), JSON.stringify(dataset, null, 2));
console.log(`Refreshed OSM records; ${before} -> ${dataset.count} toilets. Curated identities preserved.`);
