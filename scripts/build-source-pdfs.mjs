// Renders each official source page a pack cites to a PDF, so the pack can
// carry the page itself and open it with no signal. Writes
// public/data/sources/<name>.v<date>.pdf and registers each in
// src/data/sources.json — under src, because the app imports that register
// into its bundle (Vite will not bundle from public). Run:
// npm run build:data:sources (whenever a source page changes, and after
// build:data:nsp, whose snapshot names the Country Fire Authority page).

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright';
import { DTP_DATASET_URL, VIC_EXTENT } from '../src/core/constants.ts';

const dataDir = new URL('../public/data/', import.meta.url);
const registerUrl = new URL('../src/data/sources.json', import.meta.url);
const index = JSON.parse(readFileSync(new URL('index.json', dataDir), 'utf8'));
const nsp = JSON.parse(readFileSync(new URL(index.nsp.file, dataDir), 'utf8'));

// The pages: the Country Fire Authority list page the site snapshot names, and
// the Department of Transport and Planning dataset page. `mustContain` is a phrase
// the rendered page must carry: a block page, a sign-in wall or an error
// document is not the page, and is never hashed and shipped.
const pages = [
  { url: nsp.source.url, name: 'neighbourhood-safer-places', mustContain: 'Neighbourhood Safer Places' },
  { url: DTP_DATASET_URL, name: 'designated-bushfire-prone-area', mustContain: 'Designated Bushfire Prone Area' },
];
// The official page of every recovery program, so a pack can carry the pages
// of the programs the user kept. A publisher that blocks the render is skipped
// with a warning: that program keeps its web link only, and the two pages
// above still gate the build.
const programs = JSON.parse(readFileSync(new URL('recovery-sources.json', import.meta.url), 'utf8'));
for (const program of programs) {
  // A program with no page marker is link only: its publisher allows no copy.
  if (!program.pageContains) continue;
  pages.push({ url: program.officialUrl, name: program.id, mustContain: program.pageContains, optional: true });
}

// The dataset page previews its map in a Digital Twin Victoria frame, which
// answers a headless browser with a block page: a tester once found that 403
// printed in the middle of the PDF. The same layer from the Department's own
// Web Map Service is a plain picture of Victoria: the designated area over the
// council boundaries.
const STATE_MAP_URL = `https://opendata.maps.vic.gov.au/geoserver/wms?${new URLSearchParams({
  service: 'WMS',
  version: '1.1.1',
  request: 'GetMap',
  styles: '',
  format: 'image/png',
  srs: 'EPSG:4326',
  layers: 'open-data-platform:vmlite_victoria_polygon,open-data-platform:bushfire_prone_area,open-data-platform:vmlite_lga',
  bbox: `${VIC_EXTENT.minLon},${VIC_EXTENT.minLat},${VIC_EXTENT.maxLon},${VIC_EXTENT.maxLat}`,
  // The largest picture the service draws; the dpi option keeps council names
  // and lines at their size, so the bigger picture is simply sharper.
  format_options: 'dpi:180',
  width: '2048',
  height: '1280',
})}`;
const STATE_MAP_CAPTION =
  'Map: the Designated Bushfire Prone Area, in yellow, over council boundaries, drawn from the Department of Transport and Planning Web Map Service when this copy was made.';

const retrievedAt = Date.now();
const date = new Date(retrievedAt).toISOString().slice(0, 10);
mkdirSync(new URL('sources/', dataDir), { recursive: true });

const browser = await chromium.launch();
const sources = [];
for (const { url, name, mustContain, optional } of pages) {
  try {
    await render(url, name, mustContain);
  } catch (error) {
    if (!optional) throw error;
    console.warn(`sources: skipped ${name}: ${error.message}`);
  }
}
await browser.close();

writeFileSync(registerUrl, `${JSON.stringify(sources, null, 2)}\n`);

/** The page as a PDF, or a thrown reason; the browser page is always closed. */
async function renderPdf(url, mustContain, name) {
  // A desktop-width layout, printed to A4 at three quarters, so the copy is the
  // page a reader sees on a computer rather than a narrow tablet cut of it. The
  // page's own content security policy is set aside for this render only: it
  // lists the hosts its pictures may come from, and the map below is ours.
  const page = await browser.newPage({ viewport: { width: 1060, height: 1400 }, bypassCSP: true });
  try {
    await page.route(/digitaltwin/, (route) => route.abort()); // never even loaded
    await page.goto(url, { waitUntil: 'load', timeout: 90_000 });
    // A site's own pop-up (a location prompt, a cookie notice) is not the page.
    await page.locator('[role="dialog"], [aria-modal="true"]').evaluateAll((dialogs) =>
      dialogs.forEach((dialog) => dialog.remove()));
    // The map frame becomes the Web Map Service picture; every other frame goes,
    // so nothing a frame answers with can end up printed.
    await page.locator('iframe').evaluateAll((frames, [src, caption]) => {
      for (const frame of frames) {
        if (!frame.src.includes('digitaltwin')) {
          frame.remove();
          continue;
        }
        const doc = frame.ownerDocument;
        const figure = doc.createElement('figure');
        figure.style.cssText = 'margin:0;break-inside:avoid';
        const img = doc.createElement('img');
        img.id = 'state-map';
        img.src = src;
        img.style.cssText = 'display:block;width:100%;height:auto';
        const figcaption = doc.createElement('figcaption');
        figcaption.textContent = caption;
        figcaption.style.cssText = 'margin-top:8px;font-size:14px;color:#444';
        figure.append(img, figcaption);
        frame.replaceWith(figure);
      }
    }, [STATE_MAP_URL, STATE_MAP_CAPTION]);
    const map = page.locator('#state-map');
    if (await map.count()) await map.evaluate((img) => img.decode()); // a map that did not load fails the build
    const text = await page.innerText('body');
    if (!text.includes(mustContain)) throw new Error(`${name}: the rendered page does not read as "${mustContain}"`);
    if (/\b403\b|Request blocked/.test(text)) throw new Error(`${name}: the rendered page carries a block page`);
    return await page.pdf({ format: 'A4', scale: 0.75, printBackground: true });
  } finally {
    await page.close();
  }
}

/** Render one page and register its copy. */
async function render(url, name, mustContain) {
  const pdf = await renderPdf(url, mustContain, name);
  // The service worker precaches these; a copy past its 2 MiB limit would be
  // dropped without a word, so it fails here instead.
  if (pdf.length >= 2_097_152) throw new Error(`${name}: ${pdf.length} bytes is past the precache limit`);
  const file = `${name}.v${date}.pdf`;
  writeFileSync(new URL(`sources/${file}`, dataDir), pdf);
  // The fingerprint travels with the register, so the app can refuse a copy
  // that is not the page this build rendered.
  sources.push({ url, name: file, retrievedAt, sha256: createHash('sha256').update(pdf).digest('hex') });
  console.log(`sources: wrote ${file} (${pdf.length} bytes)`);
}
