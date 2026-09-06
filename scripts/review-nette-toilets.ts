/** Produces an ignored review file; never republishes an unlicensed directory. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseNette } from "./lib/nette-toilets";
import type { Toilet } from "../src/types/toilet";

async function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const get = async (action: string) => {
    const response = await fetch(`https://app.die-nette-toilette.de/deploy/?action=${action}`, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`Nette ${action}: HTTP ${response.status}`);
    return response.json();
  };
  const [locations, towns] = await Promise.all([get("loat"), get("loac")]);
  const candidates = parseNette(locations, towns);
  const existing: Toilet[] = JSON.parse(fs.readFileSync(path.join(root, "src/data/toilets.json"), "utf8")).toilets;
  const rows = candidates.map(t => {
    let distance = Infinity;
    for (const other of existing) {
      if (Math.abs(t.lat - other.lat) > .01 || Math.abs(t.lon - other.lon) > .02) continue;
      const dy = (t.lat - other.lat) * 111195;
      const dx = (t.lon - other.lon) * 111195 * Math.cos(t.lat * Math.PI / 180);
      distance = Math.min(distance, Math.hypot(dx, dy));
    }
    return { ...t, existingWithin100m: distance <= 100 };
  });
  const report = { retrievedAt: new Date().toISOString(), status: "Review only: export licence, country and freshness unverified",
    candidates: rows.length, noExistingWithin100m: rows.filter(t => !t.existingWithin100m).length, rows };
  const dir = path.join(root, ".expo/partner-imports");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "nette-review.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ ...report, rows: undefined }));
  console.log("Review saved to .expo/partner-imports/nette-review.json; app data unchanged.");
}
main().catch(error => { console.error(error); process.exitCode = 1; });
