import assert from 'node:assert/strict';
import { test } from 'node:test';
import { loadNearbyTiles, loadTilesInBounds } from './tileLoader.web';

test('web tiles use the Pages subpath, reuse downloads, and retry failures', async context => {
  Object.defineProperty(globalThis, 'document', {
    configurable: true, value: { baseURI: 'https://example.org/wc-finder/app/' },
  });
  context.after(() => { Reflect.deleteProperty(globalThis, 'document'); });
  const urls: string[] = [];
  let fail = true;
  context.mock.method(globalThis, 'fetch', async (input: URL) => {
    urls.push(input.href);
    if (fail && input.pathname.endsWith('tile_52_9.json')) {
      return new Response('Unavailable', { status: 503 });
    }
    return new Response(JSON.stringify([{ id: input.pathname }]));
  });

  assert.deepEqual(await loadNearbyTiles(0, 0), []);
  assert.equal(urls.length, 0, 'outside coverage makes no requests');
  await assert.rejects(loadNearbyTiles(52.37, 9.73), /HTTP 503/);
  assert.equal(urls.length, 9);
  assert.ok(urls.every(url => /^https:\/\/example.org\/wc-finder\/app\/data\/tiles\/tile_5[123]_(8|9|10)\.json$/.test(url)));

  fail = false;
  assert.equal((await loadNearbyTiles(52.37, 9.73)).length, 9);
  assert.equal(urls.length, 10, 'only the failed tile is retried');
  const bounded = await loadTilesInBounds(52.3, 52.5, 9.6, 9.9);
  assert.equal(bounded.length, 1);
  assert.equal(urls.length, 10, 'loaded regions are cached');
});
