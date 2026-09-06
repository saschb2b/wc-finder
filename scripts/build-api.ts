import fs from 'node:fs';
import { exportApi } from './lib/api-export';

const dataset = JSON.parse(fs.readFileSync('src/data/toilets.json', 'utf8'));
const manifest = exportApi(dataset, 'dist/api/v1');
fs.copyFileSync('docs/api.html', 'dist/api/index.html');
fs.copyFileSync('docs/api-openapi.json', 'dist/api/v1/openapi.json');
console.log(`API ready: ${manifest.count} records, ${manifest.pageCount} pages, ${(manifest.downloads.compressed.bytes / 1024 / 1024).toFixed(1)} MiB gzip.`);
