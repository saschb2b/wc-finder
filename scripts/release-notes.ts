/**
 * Print the GitHub release body for a version from CHANGELOG.md.
 *
 * Usage: tsx scripts/release-notes.ts v0.2.0 [--check]
 *
 * Exits non-zero when the section is missing or empty so a release cannot ship
 * without user-facing notes. --check only validates.
 */
import fs from "node:fs";

const [tag, flag] = process.argv.slice(2);
if (!tag) { console.error("Usage: tsx scripts/release-notes.ts <vX.Y.Z> [--check]"); process.exit(2); }
const version = tag.replace(/^v/, "");

export function changelogSection(markdown: string, version: string): string | null {
  const lines = markdown.split("\n");
  const start = lines.findIndex(line => new RegExp(`^## \\[${version.replace(/\./g, "\\.")}\\]`).test(line));
  if (start === -1) return null;
  let end = lines.findIndex((line, i) => i > start && /^## /.test(line));
  if (end === -1) end = lines.findIndex((line, i) => i > start && /^\[[^\]]+\]: /.test(line));
  const body = lines.slice(start + 1, end === -1 ? undefined : end).join("\n").trim();
  return body || null;
}

const section = changelogSection(fs.readFileSync("CHANGELOG.md", "utf8"), version);
if (!section) {
  console.error(`CHANGELOG.md has no filled section for ${version}. Move the Unreleased entries under "## [${version}] – YYYY-MM-DD" first.`);
  process.exit(1);
}
if (flag === "--check") { console.error(`Changelog section for ${version} found.`); process.exit(0); }

process.stdout.write(`${section}

---

### Install on Android
Download \`wc-finder.apk\` below, open it on your phone, and allow the installation if Android asks.
Requires Android 7.0 or newer and location permission to find toilets near you. The map background loads online; the toilet directory is included.

[Use it in the browser](https://saschb2b.github.io/wc-finder/app/) · [All changes](https://github.com/saschb2b/wc-finder/blob/main/CHANGELOG.md)
`);
