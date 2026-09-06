import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';

interface Dataset {
  count: number;
  toilets: Record<string, unknown>[];
  [key: string]: unknown;
}

const sha256 = (value: string | Buffer) => createHash('sha256').update(value).digest('hex');

export function exportApi(dataset: Dataset, outputDir: string, builtAt = new Date().toISOString(), pageSize = 1000) {
  if (!Array.isArray(dataset.toilets) || dataset.count !== dataset.toilets.length || !dataset.count) {
    throw new Error('API export requires a complete, nonempty directory with a matching count.');
  }
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid page size.');
  const snapshot = sha256(JSON.stringify(dataset));
  const pagesDir = `snapshots/${snapshot}/pages`;
  fs.mkdirSync(path.join(outputDir, pagesDir), { recursive: true });
  const full = JSON.stringify({ ...dataset, apiVersion: '1', snapshot });
  const compressed = gzipSync(full, { level: 9 });
  fs.writeFileSync(path.join(outputDir, 'toilets.json'), full);
  fs.writeFileSync(path.join(outputDir, 'toilets.json.gz'), compressed);
  const pageCount = Math.ceil(dataset.count / pageSize);
  for (let page = 1; page <= pageCount; page++) {
    const records = dataset.toilets.slice((page - 1) * pageSize, page * pageSize);
    fs.writeFileSync(path.join(outputDir, pagesDir, `${page}.json`), JSON.stringify({
      apiVersion: '1', snapshot, page, pageSize, pageCount,
      count: records.length, totalCount: dataset.count,
      next: page < pageCount ? `${page + 1}.json` : null,
      toilets: records,
    }));
  }
  const { toilets: _toilets, ...sourceMetadata } = dataset;
  const manifest = {
    apiVersion: '1', snapshot, builtAt, count: dataset.count,
    pageSize, pageCount, sourceMetadata,
    links: {
      full: 'toilets.json', compressed: 'toilets.json.gz',
      firstPage: `${pagesDir}/1.json`, openapi: 'openapi.json', documentation: '../',
    },
    downloads: {
      full: { bytes: Buffer.byteLength(full), sha256: sha256(full) },
      compressed: { bytes: compressed.length, sha256: sha256(compressed) },
    },
    usage: {
      authentication: 'none', methods: ['GET', 'HEAD'], queryParameters: false,
      updates: 'Published directory snapshot; refreshed by website deployments, not live availability.',
      reuse: 'Mixed source terms apply. Preserve sources and care.sourceUrls; the MIT code licence does not license all location data.',
      pagination: 'Resolve links against the document URL. If a snapshot page returns 404, reload index.json and restart.',
    },
  };
  fs.writeFileSync(path.join(outputDir, 'index.json'), JSON.stringify(manifest, null, 2) + '\n');
  return manifest;
}
