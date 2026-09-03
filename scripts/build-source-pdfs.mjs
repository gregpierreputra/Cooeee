// Renders each official source page a pack cites to a PDF, so the pack can
// carry the page itself and open it with no signal. Writes
// public/data/sources/<page>.v<date>.pdf and registers each under "sources" in
// index.json. Run: npm run build:data:sources (whenever a source page changes,
// and after build:data:nsp, whose snapshot names the CFA page).

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';

const dataDir = new URL('../public/data/', import.meta.url);
const indexUrl = new URL('index.json', dataDir);
const index = JSON.parse(readFileSync(indexUrl, 'utf8'));

// The pages: the CFA list page the NSP snapshot names, and the DTP dataset page
// named in core/constants.ts — read from there, never retyped.
const nsp = JSON.parse(readFileSync(new URL(index.nsp.file, dataDir), 'utf8'));
const constants = readFileSync(new URL('../src/core/constants.ts', import.meta.url), 'utf8');
const dtpUrl = constants.match(/DTP_DATASET_URL =\s*'([^']+)'/)?.[1];
if (!dtpUrl) throw new Error('DTP_DATASET_URL not found in src/core/constants.ts');

const retrievedAt = Date.now();
const date = new Date(retrievedAt).toISOString().slice(0, 10);
mkdirSync(new URL('sources/', dataDir), { recursive: true });

const browser = await chromium.launch();
const sources = [];
for (const url of [nsp.source.url, dtpUrl]) {
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
  // A site's own pop-up (a location prompt, a cookie notice) is not the page.
  await page.locator('[role="dialog"], [aria-modal="true"]').evaluateAll((dialogs) =>
    dialogs.forEach((dialog) => dialog.remove()));
  const pdf = await page.pdf({ format: 'A4', printBackground: true });
  await page.close();
  const name = `${new URL(url).pathname.split('/').filter(Boolean).pop()}.v${date}.pdf`;
  writeFileSync(new URL(`sources/${name}`, dataDir), pdf);
  sources.push({ url, name, retrievedAt });
  console.log(`sources: wrote ${name} (${pdf.length} bytes)`);
}
await browser.close();

index.sources = sources;
writeFileSync(indexUrl, `${JSON.stringify(index, null, 2)}\n`);
