/** All feeds must validate before either the source snapshot or bundle changes. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { municipalSources, parseMunicipal } from "./lib/municipal";
import { mergeImported } from "./lib/merge-osm";
import type { Toilet } from "../src/types/toilet";

async function main() {
  const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../src/data");
  const retrievedAt = new Date().toISOString();
  const toilets: Toilet[] = [];
  const counts: Record<string, number> = {};
  for (const source of municipalSources) {
    const response = await fetch(source.url, { signal: AbortSignal.timeout(45000) });
    if (!response.ok) throw new Error(`${source.id}: HTTP ${response.status}`);
    const fresh = parseMunicipal(await response.json(), source, retrievedAt);
    counts[source.id] = fresh.length;
    toilets.push(...fresh);
    console.log(`${source.id}: ${fresh.length} explicitly accessible toilets`);
  }
  const dataset = JSON.parse(fs.readFileSync(path.join(dir, "toilets.json"), "utf8"));
  const before = dataset.toilets.length;
  dataset.toilets = mergeImported(dataset.toilets, toilets);
  dataset.count = dataset.toilets.length;
  dataset.municipalUpdate = { retrievedAt, counts, added: dataset.count - before };
  for (const [name, data] of [["municipal-toilets.json", { retrievedAt, count: toilets.length, counts, toilets }], ["toilets.json", dataset]] as const) {
    const target = path.join(dir, name);
    fs.writeFileSync(target + ".tmp", JSON.stringify(data, null, 2));
    fs.renameSync(target + ".tmp", target);
  }
  console.log(JSON.stringify(dataset.municipalUpdate));
  await import("./split-tiles");
  await import("./gen-tile-loader");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
