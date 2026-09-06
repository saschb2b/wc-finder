import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gunzipSync } from 'node:zlib';
import { test } from 'node:test';
import { exportApi } from './api-export';

test('API preserves every field and duplicate row through full and paginated exports', context => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wc-api-test-'));
  context.after(() => {
    const resolved = fs.realpathSync(dir);
    assert.equal(path.dirname(resolved), fs.realpathSync(os.tmpdir()));
    assert.ok(path.basename(resolved).startsWith('wc-api-test-'));
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const record = { id: 'existing', name: 'WC Ä', lat: 52, lon: 9,
    care: { bed: 'available', sourceUrls: ['https://example.org/source'] },
    sources: [{ license: 'original terms' }], customField: { retained: true } };
  const dataset = { count: 3, generated: '2020-01-01', toilets: [record, record, { ...record, id: 'last' }] };
  const manifest = exportApi(dataset, dir, '2026-09-06T00:00:00Z', 2);
  const read = (name: string) => JSON.parse(fs.readFileSync(path.join(dir, name), 'utf8'));
  const full = read(manifest.links.full);
  assert.deepEqual(full.toilets, dataset.toilets);
  assert.equal(full.generated, dataset.generated, 'export time must not replace source dates');
  const gz = fs.readFileSync(path.join(dir, manifest.links.compressed));
  assert.deepEqual(JSON.parse(gunzipSync(gz).toString()), full);
  assert.equal(createHash('sha256').update(gz).digest('hex'), manifest.downloads.compressed.sha256);
  assert.equal(manifest.downloads.full.bytes, fs.statSync(path.join(dir, manifest.links.full)).size);
  const first = read(manifest.links.firstPage);
  const second = read(path.join(path.dirname(manifest.links.firstPage), first.next));
  assert.deepEqual([...first.toilets, ...second.toilets], dataset.toilets);
  assert.equal(first.snapshot, manifest.snapshot);
  assert.equal(second.next, null);
  assert.equal(second.count, 1);
  assert.equal(exportApi(dataset, dir, '2027-01-01T00:00:00Z', 2).snapshot, manifest.snapshot);
  assert.notEqual(exportApi({ ...dataset, generated: '2021-01-01' }, dir).snapshot, manifest.snapshot);
  assert.throws(() => exportApi({ ...dataset, count: 4 }, dir), /matching count/);
});
