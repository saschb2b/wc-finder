import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import './prepare-web-data';
import './build-api';

const require = createRequire(import.meta.url);
// PAGES_BASE_PATH comes from configure-pages, supporting custom domains too.
const siteBase = (process.env.PAGES_BASE_PATH ?? '/wc-finder').replace(/\/$/, '');
const appBase = `${siteBase}/app`;
execFileSync(process.execPath, [require.resolve('expo/bin/cli'), 'export',
  '--platform', 'web', '--output-dir', 'dist/app', '--max-workers', '2'], {
  stdio: 'inherit', env: { ...process.env, WEB_BASE_PATH: appBase },
});
// Paint the theme background before the bundle runs so dark-mode users see no white flash.
const preloadStyle = '<style>html{background:#f8f9fa;color-scheme:light dark}'
  + '@media (prefers-color-scheme:dark){html{background:#121212}}</style>';
const appHtml = fs.readFileSync('dist/app/index.html', 'utf8')
  .replace('<html lang="en">', '<html lang="de">')
  .replace('</head>', `${preloadStyle}</head>`)
  .replace('You need to enable JavaScript to run this app.',
    'Bitte aktiviere JavaScript, um WC Finder im Browser zu verwenden.');
fs.writeFileSync('dist/app/index.html', appHtml);
// Retain the landing page and its assets beside the runnable Expo app.
for (const entry of fs.readdirSync('docs', { withFileTypes: true })) {
  if (entry.isFile() && entry.name !== 'api.html' && /\.(html|png|jpg|jpeg|svg|ico|webp)$/.test(entry.name)) {
    fs.copyFileSync(path.join('docs', entry.name), path.join('dist', entry.name));
  }
}
// Landing page screenshots live in a subfolder so they can be regenerated as a set.
if (fs.existsSync('docs/screens')) {
  fs.mkdirSync('dist/screens', { recursive: true });
  for (const name of fs.readdirSync('docs/screens')) fs.copyFileSync(path.join('docs/screens', name), path.join('dist/screens', name));
}
fs.writeFileSync('dist/.nojekyll', '');
console.log(`Pages site ready: ${siteBase}/ (website), ${appBase}/ (app).`);
